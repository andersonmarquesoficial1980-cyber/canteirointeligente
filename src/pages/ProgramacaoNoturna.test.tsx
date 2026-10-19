import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProgramacaoNoturna from "./ProgramacaoNoturna";

const state = vi.hoisted(() => ({
  rows: [{ id: "com-1", data: "2026-10-19", created_at: "2026-10-19T08:00:00Z", revisao: 1, itens: [
    { equipe: "CBUQ01", situacao: "TRABALHO", local: "Obra A", ogs: "2529", cliente: "GRU", periodo: "DIURNO", observacao: "" },
  ] }],
  childRows: [{ equipe: "CBUQ01", status_equipe: "TRABALHOU", motivo_cancelamento: null as string | null }],
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => () => {} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: notify }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  from: (table: string) => {
    const q = {
      select: () => q, eq: () => q, gte: () => q, lte: () => q,
      or: () => q, not: () => q, order: () => q,
      maybeSingle: async () => ({ data: { company_id: "company-1" }, error: null }),
      single: async () => ({ data: state.rows[0], error: null }),
      limit: async () => {
        const data = table === "employees" ? [{ equipe: "CBUQ01", id: "employee-1", name: "Ana", is_encarregado: true, is_engenheiro: true }]
          : table === "ogs_reference" ? [{ ogs_number: "2529", client_name: "GRU", location_address: "Obra A" }]
          : table === "programacao_comunicados" ? state.rows : [];
        return { data, error: null, count: data.length };
      },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: state.childRows, error: null }).then(resolve),
    };
    return q;
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    state.calls.push({ name, args });
    if (name === "programador_editar_comunicado") {
      const items = args.p_itens as typeof state.rows[0]["itens"];
      state.rows[0] = { ...state.rows[0], revisao: 2, itens: items };
      state.childRows = items.map(item => ({ equipe: item.equipe, status_equipe: item.situacao === "TRABALHO" ? "TRABALHOU" : item.situacao, motivo_cancelamento: (item as {motivo_cancelamento?: string}).motivo_cancelamento || null }));
    }
    return { data: 2, error: null };
  },
} }));
afterEach(() => { cleanup(); state.calls = []; notify.mockClear(); state.rows[0] = { id: "com-1", data: "2026-10-19", created_at: "2026-10-19T08:00:00Z", revisao: 1, itens: [{ equipe: "CBUQ01", situacao: "TRABALHO", local: "Obra A", ogs: "2529", cliente: "GRU", periodo: "DIURNO", observacao: "" }] }; state.childRows = [{ equipe: "CBUQ01", status_equipe: "TRABALHOU", motivo_cancelamento: null }]; });

it("abre o comunicado salvo para corrigir uma equipe sem mudar a data ou equipe", async () => {
  render(<MemoryRouter><ProgramacaoNoturna /></MemoryRouter>);
  await screen.findByText("Programação de Obras · 19/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Editar comunicado" }));
  expect(screen.getByRole("heading", { name: /Editando comunicado/ })).toBeTruthy();
  expect(screen.getByLabelText("Dia de trabalho")).toBeDisabled();
  expect(screen.getByLabelText("Equipe programada")).toBeDisabled();
  expect(screen.getByDisplayValue("Obra A")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Descartar edição" })).toBeTruthy();
});

it("bloqueia salvar cancelamento sem motivo antes de chamar a RPC", async () => {
  render(<MemoryRouter><ProgramacaoNoturna /></MemoryRouter>);
  await screen.findByText("Programação de Obras · 19/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Editar comunicado" }));
  fireEvent.change(screen.getByLabelText("Situação da equipe"), { target: { value: "CANCELADO" } });
  expect(screen.getByLabelText("Motivo do cancelamento *")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Salvar correção/ }));
  expect(state.calls).toEqual([]);
});

it("salva revisão de cancelamento e confere a linha atual antes de anunciar sucesso", async () => {
  render(<MemoryRouter><ProgramacaoNoturna /></MemoryRouter>);
  await screen.findByText("Programação de Obras · 19/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Editar comunicado" }));
  fireEvent.change(screen.getByLabelText("Situação da equipe"), { target: { value: "CANCELADO" } });
  fireEvent.change(screen.getByLabelText("Motivo do cancelamento *"), { target: { value: "Chuva forte" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(state.calls[0]?.name).toBe("programador_editar_comunicado"));
  expect(state.calls[0].args.p_revisao).toBe(1);
  expect((state.calls[0].args.p_itens as Array<{ motivo_cancelamento: string }>)[0].motivo_cancelamento).toBe("Chuva forte");
  await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Correção registrada no histórico" })));
  expect(screen.getAllByText(/Revisão 2/i).length).toBeGreaterThan(0);
});

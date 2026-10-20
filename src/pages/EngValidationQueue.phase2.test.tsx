import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const state = vi.hoisted(() => ({ admin: true, failPage: false, rows: [] as Record<string, unknown>[], ranges: [] as number[] }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => true }));
vi.mock("@/components/ProgramacoesDoDia", () => ({ default: () => null }));
vi.mock("@/components/IntegracaoObrasCard", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "eng1" } } }) },
  from: (table: string) => {
    let start = 0, end = 999;
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const result = () => {
      const data = table === "profiles" ? { company_id: "c1", nome_completo: "Ana Engenharia", perfil: state.admin ? "administrador" : "engenheiro", role: "engenheiro" }
        : table === "user_permissions" ? { is_admin: state.admin }
        : table === "rdo_diarios" ? state.rows.filter(r => filters.every(f => f(r))).slice(start, end + 1) : [];
      return { data: state.failPage && start >= 500 ? null : data, error: state.failPage && start >= 500 ? { message: "Falha na segunda página" } : null };
    };
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { if (table === "rdo_diarios") filters.push(r => r[key] === value); return q; },
      in: (key: string, values: unknown[]) => { filters.push(r => values.includes(r[key])); return q; },
      is: (key: string, value: unknown) => { filters.push(r => r[key] === value); return q; },
      gte: (key: string, value: string) => { filters.push(r => String(r[key]) >= value); return q; },
      lte: (key: string, value: string) => { filters.push(r => String(r[key]) <= value); return q; },
      order: () => q,
      limit: (n: number) => { end = n - 1; return q; },
      range: (a: number, b: number) => { start = a; end = b; state.ranges.push(a); return q; },
      maybeSingle: () => Promise.resolve(result()),
      then: (resolve: (r: ReturnType<typeof result>) => void) => Promise.resolve(result()).then(resolve),
    };
    return q;
  },
} }));
import EngHome from "./EngHome";
import EngValidacoes from "./EngValidacoes";
async function mount(home: boolean) {
  await act(async () => { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{home ? <EngHome /> : <EngValidacoes />}</MemoryRouter>); });
}
beforeEach(() => {
  state.admin = true; state.failPage = false; state.ranges = [];
  state.rows = Array.from({ length: 1201 }, (_, i) => ({ id: `r${i}`, company_id: "c1", data: "2026-10-01", obra_nome: `Obra ${i}`,
    status_validacao: "enviado", validado_por: null, engenheiro_responsavel_user_id: i === 1200 ? "eng1" : "outro", engenheiro_responsavel: "Outro" }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); });
describe.each([true, false])("fila de validação completa — home=%s", home => {
  it("conta 1201 pendências sem truncar o total em 20, 500 ou 1000", async () => {
    await mount(home);
    expect(screen.getByText(home ? "Aguardando sua validação (1201)" : "1201 RDOs aguardando")).toBeInTheDocument();
    expect(state.ranges).toEqual([0, 500, 1000]);
    if (home) expect(screen.queryByText("Obra 1200")).not.toBeInTheDocument();
  });
  it("encontra a pendência do engenheiro depois da primeira página sem vazar outras", async () => {
    state.admin = false;
    await mount(home);
    expect(screen.getByText("Obra 1200")).toBeInTheDocument();
    expect(screen.queryByText("Obra 0")).not.toBeInTheDocument();
  });
  it("informa erro sem apresentar fila parcial nem Tudo em dia", async () => {
    state.failPage = true;
    await mount(home);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar a fila completa");
    expect(screen.queryByText("Tudo em dia!")).not.toBeInTheDocument();
    expect(screen.queryByText("Obra 0")).not.toBeInTheDocument();
  });
});

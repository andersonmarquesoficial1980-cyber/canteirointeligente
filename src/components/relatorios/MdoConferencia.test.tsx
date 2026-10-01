import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MdoConferencia } from "./MdoConferencia";
import type { MdoBaseDay } from "@/lib/mdoWorkbench";

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));

const period = { id: "draft-1", company_id: "fremix", data_inicio: "2026-09-01", data_fim: "2026-09-30", versao: 1,
  status: "rascunho", revisao: 0, aprovado_em: null, total_linhas: null };
const ogs = [{ id: "ogs-1", ogs_number: "OGS-101" }];
const team = "CBUQ03 - GIVANILDO";
const day = (employee_id: string, data: string, equipe: string): MdoBaseDay => ({
  employee_id, data, equipe, funcionario: employee_id, funcao: "Auxiliar", matricula: employee_id,
  status: "ativo", presenca_rdo: "NAO", ogs: "-", rdo_ids: "-",
});
const grade = [day("Givanildo-1", "2026-09-01", team), day("Givanildo-2", "2026-09-02", team),
  day("Givanildo-3", "2026-09-10", team), day("Outra-equipe", "2026-09-01", "CBUQ02")];

function query(table: string) {
  const result = () => Promise.resolve({ data: table === "mdo_custos_periodos" ? [period] : table === "ogs_reference" ? ogs : [], error: null });
  const chain: any = { then: (resolve: any, reject: any) => result().then(resolve, reject) };
  for (const name of ["select", "eq", "order", "range"]) chain[name] = () => chain;
  return chain;
}

describe("conferência MDO por equipe", () => {
  it("mostra equipe e intervalo, e salva só os dias elegíveis com confirmação", async () => {
    from.mockImplementation(query);
    rpc.mockImplementation((name: string) => name === "mdo_custos_alterar"
      ? Promise.resolve({ data: 1, error: null }) : Promise.resolve({ data: null, error: null }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MdoConferencia companyId="fremix" inicio="2026-09-01" fim="2026-09-30" grade={grade} canEdit canApprove={false} />);
    expect(screen.getByRole("heading", { name: "Editar equipe por período" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: /Rascunho v1/ })).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("combobox", { name: "OGS para período da equipe" }).querySelector('option[value="ogs-1"]')).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox", { name: "Equipe para conferência MDO" }), { target: { value: team } });
    fireEvent.change(screen.getByLabelText("Fim da edição da equipe"), { target: { value: "2026-09-02" } });
    fireEvent.change(screen.getByRole("combobox", { name: "OGS para período da equipe" }), { target: { value: "ogs-1" } });
    expect(screen.getByRole("button", { name: /Aplicar OGS à equipe · 2 dias/ })).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Givanildo-1")).toBeTruthy();
    expect(within(table).getByText("Givanildo-2")).toBeTruthy();
    expect(within(table).queryByText("Givanildo-3")).toBeNull();
    expect(within(table).queryByText("Outra-equipe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar OGS à equipe · 2 dias/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("mdo_custos_alterar", expect.objectContaining({
      p_periodo: "draft-1", p_revisao: 0,
      p_celulas: [expect.objectContaining({ employee_id: "Givanildo-1", data: "2026-09-01", ogs_id: "ogs-1" }),
        expect.objectContaining({ employee_id: "Givanildo-2", data: "2026-09-02", ogs_id: "ogs-1" })],
    })));
    expect(confirm.mock.calls[0][0]).toContain(team);
    confirm.mockRestore();
  });
});

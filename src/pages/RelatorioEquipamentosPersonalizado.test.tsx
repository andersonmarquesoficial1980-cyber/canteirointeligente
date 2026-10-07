import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RelatorioEquipamentosPersonalizado from "./RelatorioEquipamentosPersonalizado";

const state = vi.hoisted(() => ({
  company: "empresa-1",
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
  scopes: [] as string[],
  ranges: [] as number[],
}));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: state.company } }) }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    if (table !== "equipamentos") throw new Error(`Unexpected table ${table}`);
    const query = {
      select: () => query,
      eq: (field: string, value: string) => { if (field !== "company_id") throw new Error(field); state.scopes.push(value); return query; },
      order: () => query,
      range: async (start: number, end: number) => {
        state.ranges.push(start);
        return { data: state.rows.slice(start, end + 1), error: state.error };
      },
    };
    return query;
  },
} }));

beforeEach(() => { state.rows = []; state.error = null; state.scopes = []; state.ranges = []; });

describe("Relatório personalizado de equipamentos", () => {
  it("lê somente a empresa atual, filtra e monta uma lista manual", async () => {
    state.rows = [
      { id: "a", frota: "CC01", tipo: "CAMINHÃO", setor: "EQUIPE A", status: "ativo", placa: "AAA1A23" },
      { id: "b", frota: "CC02", tipo: "CAMINHÃO", setor: "EQUIPE B", status: "inativo" },
    ];
    render(<RelatorioEquipamentosPersonalizado />);
    await waitFor(() => expect(screen.getByText(/Cadastro de Equipamentos \(1\)/)).toBeTruthy());
    expect(state.scopes).toEqual(["empresa-1"]);
    expect(screen.queryByText(/CC02 · CAMINHÃO/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Selecionar filtrados/ }));
    expect(screen.getByText("Selecionados (1)")).toBeTruthy();
    expect(screen.getByText("Pré-visualização do relatório")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ocultar inativos/ }));
    expect(screen.getByText(/Cadastro de Equipamentos \(2\)/)).toBeTruthy();
  });

  it("não oferece exportação parcial quando a consulta falha", async () => {
    state.error = { message: "sem acesso" };
    render(<RelatorioEquipamentosPersonalizado />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "CSV" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Selecionar filtrados/ }).hasAttribute("disabled")).toBe(true);
  });
});

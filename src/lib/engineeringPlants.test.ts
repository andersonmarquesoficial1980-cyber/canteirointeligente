import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as Array<{ nome: string; tipo_insumos?: string[]; tipo_insumo?: string }>, error: null as null | { message: string }, select: vi.fn(), filter: vi.fn(), table: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (name: string) => {
  state.table(name);
  const q = { select: (fields: string) => { state.select(fields); return q; }, or: (filter: string) => { state.filter(filter); return q; }, order: async () => ({ data: state.rows, error: state.error }) };
  return q;
} } }));
import { loadEngineeringPlants } from "./engineeringPlants";
beforeEach(() => { state.rows = []; state.error = null; vi.clearAllMocks(); });
describe("Catálogo único de usinas de Engenharia", () => {
  it("consulta fornecedores e inclui as classificações atual e legada sem duplicar nomes", async () => {
    state.rows = [{ nome: "Zeta", tipo_insumos: ["Massa Asfáltica"] }, { nome: "Alfa", tipo_insumo: "Massa Asfáltica" }, { nome: "Zeta", tipo_insumos: ["Massa Asfáltica"] }, { nome: "Diesel", tipo_insumos: ["Óleo Diesel"] }];
    expect(await loadEngineeringPlants()).toEqual(["Alfa", "Zeta"]);
    expect(state.table).toHaveBeenCalledWith("fornecedores");
    expect(state.select).toHaveBeenCalledWith("nome, tipo_insumos, tipo_insumo");
    expect(state.filter).toHaveBeenCalledWith("vinculo_rdo.eq.CAUQ,vinculo_rdo.eq.PAVIMENTACAO");
  });
  it("não transforma erro de acesso em catálogo vazio", async () => {
    state.error = { message: "Acesso negado" };
    await expect(loadEngineeringPlants()).rejects.toThrow("Acesso negado");
  });
  it("aceita catálogo vazio sem inventar uma usina", async () => {
    expect(await loadEngineeringPlants()).toEqual([]);
  });
});

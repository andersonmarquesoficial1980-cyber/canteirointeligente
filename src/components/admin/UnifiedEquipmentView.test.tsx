import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; filters: Array<[string, unknown]>; range?: [number, number] }>,
  diaries: [] as Array<Record<string, unknown>>,
  fuel: [] as Array<Record<string, unknown>>,
  exportRows: [] as Array<Record<string, unknown>>,
  failAt: -1,
}));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: "empresa1" }, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const call: { table: string; filters: Array<[string, unknown]>; range?: [number, number] } = { table, filters: [] };
      state.calls.push(call);
      const source = () => table === "equipment_diaries" ? state.diaries : table === "abastecimentos" ? state.fuel : [];
      const q = {
        select: () => q,
        eq: (field: string, value: unknown) => { call.filters.push([field, value]); return q; },
        gte: (field: string, value: unknown) => { call.filters.push([field, value]); return q; },
        lte: (field: string, value: unknown) => { call.filters.push([field, value]); return q; },
        in: () => q,
        order: () => q,
        range: async (from: number, to: number) => { call.range = [from, to]; return from === state.failAt && table === "equipment_diaries" ? { data: null, error: Error("Falha de rede") } : { data: source().slice(from, to + 1), error: null }; },
        then: (resolve: (v: unknown) => void) => Promise.resolve({ data: source(), error: null }).then(resolve),
      };
      return q;
    },
  },
}));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (rows: Array<Record<string, unknown>>) => { state.exportRows = rows; return {}; },
    book_new: () => ({}), book_append_sheet: () => undefined,
  },
  writeFile: () => undefined,
}));
import UnifiedEquipmentView from "./UnifiedEquipmentView";

const diary = (id: string) => ({
  id, date: new Date().toISOString().slice(0, 10), equipment_fleet: "FA20", equipment_type: "fresadora",
  operator_name: "Ana", ogs_number: "OGS1", meter_initial: 10, meter_final: 20, fuel_liters: 5,
});
afterEach(() => { cleanup(); state.calls = []; state.diaries = []; state.fuel = []; state.exportRows = []; state.failAt = -1; });

describe("visão unificada dos equipamentos", () => {
  it("lê comboio pela data/frota da empresa mesmo sem diary_id e NÃO soma com litros do operador", async () => {
    state.diaries = [diary("diario1")];
    state.fuel = [{ id: "ab1", equipment_fleet: "FA20", data: diary("diario1").date, litros: 8, diary_id: null, fonte: "comboio" }];
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByText("FA20")).toBeInTheDocument());
    fireEvent.click(screen.getByText("FA20"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("8.0 L")).toBeInTheDocument();
    expect(within(dialog).getByText("5.0 L")).toBeInTheDocument();
    expect(within(dialog).getByText(/a conciliar/i)).toBeInTheDocument();
    expect(within(dialog).queryByText("13 L")).not.toBeInTheDocument();
    expect(state.calls.find((c) => c.table === "abastecimentos")?.filters).toContainEqual(["company_id", "empresa1"]);
    expect(state.calls.find((c) => c.table === "abastecimentos")?.filters).toContainEqual(["fonte", "comboio"]);
    expect(state.calls.find((c) => c.table === "abastecimentos")?.filters).toContainEqual(["data", diary("diario1").date]);
    expect(state.calls.find((c) => c.table === "equipment_diaries")?.filters).toContainEqual(["company_id", "empresa1"]);
    expect(state.calls.map((c) => c.table)).not.toContain("fleet_refueling_logs");
  });

  it("não corta os diários no limite padrão de mil linhas", async () => {
    state.diaries = Array.from({ length: 1001 }, (_, i) => diary(`diario${i}`));
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByText(/1001 registros/)).toBeInTheDocument());
    expect(state.calls.filter((c) => c.table === "equipment_diaries").map((c) => c.range)).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("não repete os litros do Comboio no Excel quando existem dois diários da mesma frota/data", async () => {
    state.diaries = [diary("diario1"), diary("diario2")];
    state.fuel = [{ id: "ab1", equipment_fleet: "FA20", data: diary("diario1").date, litros: 8 }];
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByText(/2 registros/)).toBeInTheDocument());
    expect(screen.getByText("Comboio: 8.0 L")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Exportar Totvs/i }));
    expect(state.exportRows).toHaveLength(2);
    expect(state.exportRows.map((row) => row.COMBOIO_L_DIA)).toEqual([8, ""]);
    expect(state.exportRows.map((row) => row.COMBUSTIVEL_L)).toEqual([5, 5]);
    expect(state.exportRows[0].CONCILIACAO).toMatch(/A conferir/);
  });

  it("inclui variações de tipo já existentes nos diários de rolo, vibro e usina", async () => {
    state.diaries = [
      { ...diary("rolo"), equipment_type: "ROLO CHAPA", equipment_fleet: "RL01" },
      { ...diary("vibro"), equipment_type: "VIBRO ACABADORA", equipment_fleet: "VA01" },
      { ...diary("usina"), equipment_type: "Usina KMA", equipment_fleet: "KMA01" },
    ];
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByText(/Nenhum diário encontrado para Fresadoras/)).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Rolos/i }), { button: 0 });
    await waitFor(() => expect(screen.getByText("RL01")).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Vibroacabadoras/i }), { button: 0 });
    await waitFor(() => expect(screen.getByText("VA01")).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Usinas/i }), { button: 0 });
    await waitFor(() => expect(screen.getByText("KMA01")).toBeInTheDocument());
  });

  it("não mostra subtotal truncado nem exporta se uma página falhar", async () => {
    state.diaries = Array.from({ length: 501 }, (_, i) => diary(`diario${i}`));
    state.failAt = 500;
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/período completo/i));
    expect(screen.queryByText(/500 registros/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar Totvs/i })).not.toBeInTheDocument();
  });
});

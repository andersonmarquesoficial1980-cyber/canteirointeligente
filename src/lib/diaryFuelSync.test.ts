import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  filters: [] as Array<[string, unknown]>,
  rows: [] as Array<{ litros: number; horimetro: number | null; km_odometro: number | null }>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "abastecimentos") throw Error(`Consulta inesperada: ${table}`);
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { state.filters.push([field, value]); return query; },
        then: (resolve: (result: unknown) => void) => Promise.resolve({ data: state.rows, error: null }).then(resolve),
      };
      return query;
    },
  },
}));
import { loadComboioFuel } from "./diaryFuelSync";

afterEach(() => { state.filters = []; state.rows = []; });

describe("sincronização Abastecimento → Diário de Equipamento", () => {
  it("preenche litros e horímetro do Comboio pela empresa/frota/data sem exigir diary_id", async () => {
    state.rows = [
      { litros: 40, horimetro: 120, km_odometro: null },
      { litros: 20, horimetro: 125, km_odometro: null },
    ];
    expect(await loadComboioFuel("empresa1", "FA18", "2026-10-14", false)).toEqual({ liters: 60, meter: 125 });
    expect(state.filters).toEqual([
      ["company_id", "empresa1"], ["fonte", "comboio"],
      ["equipment_fleet", "FA18"], ["data", "2026-10-14"],
    ]);
    expect(state.filters.some(([field]) => field === "diary_id")).toBe(false);
  });

  it("usa odômetro para veículo e não inventa abastecimento quando não há registro", async () => {
    state.rows = [{ litros: 30, horimetro: null, km_odometro: 19000 }];
    expect(await loadComboioFuel("empresa1", "VT12", "2026-10-14", true)).toEqual({ liters: 30, meter: 19000 });
    state.rows = [];
    expect(await loadComboioFuel("empresa1", "VT12", "2026-10-13", true)).toBeNull();
  });
});

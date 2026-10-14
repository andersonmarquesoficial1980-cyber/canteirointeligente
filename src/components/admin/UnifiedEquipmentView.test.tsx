import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const state = vi.hoisted(() => ({ tables: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.tables.push(table);
      const query = {
        select: () => query,
        gte: () => query,
        lte: () => query,
        eq: () => query,
        order: () => query,
        then: (resolve: (result: unknown) => void) => Promise.resolve({
          data: table === "equipment_diaries" ? [{
            id: "diario1", date: new Date().toISOString().slice(0, 10),
            equipment_fleet: "FA20", equipment_type: "fresadora", operator_name: "Ana",
            ogs_number: "OGS1", meter_initial: 10, meter_final: 20, fuel_liters: 5,
          }] : table === "abastecimentos" ? [{ equipment_fleet: "FA20", litros: 8, diary_id: "diario1" }] : [],
          error: null,
        }).then(resolve),
      };
      return query;
    },
  },
}));
import UnifiedEquipmentView from "./UnifiedEquipmentView";

afterEach(() => { cleanup(); state.tables = []; });

describe("visão unificada dos equipamentos", () => {
  it("mantém litros conhecidos e não consulta tabela de abastecimento legada ausente", async () => {
    render(<UnifiedEquipmentView />);
    await waitFor(() => expect(screen.getByText("FA20")).toBeInTheDocument());
    fireEvent.click(screen.getByText("FA20"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleDescription("Dados do diário FA20, incluindo combustível conhecido e horímetro.");
    expect(within(dialog).getByText("Indisponível")).toBeInTheDocument();
    expect(within(dialog).getByText("13 L")).toBeInTheDocument();
    expect(state.tables).not.toContain("fleet_refueling_logs");
  });
});

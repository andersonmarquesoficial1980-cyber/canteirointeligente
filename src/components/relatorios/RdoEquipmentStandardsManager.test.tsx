import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RdoEquipmentStandardsManager from "./RdoEquipmentStandardsManager";

const { from, queries } = vi.hoisted(() => {
  const queries: Array<{ table: string; filters: Array<[string, unknown]>; range?: [number, number]; action?: string; payload?: unknown; onConflict?: string }> = [];
  const from = vi.fn((table: string) => {
    const query: (typeof queries)[number] = { table, filters: [] };
    queries.push(query);
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { query.filters.push([field, value]); return chain; },
      order: () => chain,
      range: async (start: number, end: number) => {
        query.range = [start, end];
        if (table === "employees") return { data: start === 0 ? [{ equipe: "Equipe A" }, { equipe: "Equipe B" }] : [], error: null };
        if (table === "equipamentos") return { data: start === 0 ? [{ tipo: "Escavadeira" }, { tipo: "Rolo" }] : [], error: null };
        return { data: start === 0 ? [{ id: "p1", equipe: "Equipe A", tipo: "Rolo", ativo: true }] : [], error: null };
      },
      maybeSingle: async () => ({ data: { is_admin: admin }, error: null }),
      upsert: (payload: unknown, options: { onConflict: string }) => { query.action = "upsert"; query.payload = payload; query.onConflict = options.onConflict; return Promise.resolve({ error: null }); },
      update: (payload: unknown) => { query.action = "update"; query.payload = payload; return chain; },
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
    };
    return chain;
  });
  return { from, queries };
});
let admin = false;
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
const props = { companyId: "company-1", userId: "user-1" };

beforeEach(() => { admin = false; queries.length = 0; from.mockClear(); });

describe("RDO equipment standards manager", () => {
  it("does not expose configuration or load catalogs for non-admin users", async () => {
    render(<RdoEquipmentStandardsManager {...props} />);
    await waitFor(() => expect(queries.some(q => q.table === "user_permissions")).toBe(true));
    expect(screen.queryByText(/Padrões de equipamentos por equipe/)).not.toBeInTheDocument();
    expect(queries.some(q => q.table === "employees" || q.table === "equipamentos")).toBe(false);
    expect(queries.find(q => q.table === "user_permissions")?.filters).toEqual([["company_id", "company-1"], ["user_id", "user-1"]]);
  });

  it("adds a selected canonical type for a selected team with company-scoped upsert", async () => {
    admin = true;
    render(<RdoEquipmentStandardsManager {...props} />);
    fireEvent.click(await screen.findByText("Padrões de equipamentos por equipe"));
    const team = await screen.findByRole("combobox", { name: "Equipe para padrões" });
    fireEvent.change(team, { target: { value: "Equipe B" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de equipamento para adicionar" }), { target: { value: "Escavadeira" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tipo" }));
    await waitFor(() => expect(queries.some(q => q.action === "upsert")).toBe(true));
    const write = queries.find(q => q.action === "upsert")!;
    expect(write.payload).toEqual({ company_id: "company-1", equipe: "Equipe B", tipo: "Escavadeira", ativo: true });
    expect(write.onConflict).toBe("company_id,equipe,tipo");
    for (const table of ["employees", "equipamentos", "rdo_equipamento_padroes"]) {
      expect(queries.find(q => q.table === table)?.filters).toContainEqual(["company_id", "company-1"]);
      expect(queries.find(q => q.table === table)?.range).toEqual([0, 499]);
    }
  });

  it("soft-disables a standard only within the selected company", async () => {
    admin = true;
    render(<RdoEquipmentStandardsManager {...props} />);
    fireEvent.click(await screen.findByText("Padrões de equipamentos por equipe"));
    const row = await screen.findByText("Rolo");
    fireEvent.click(within(row.closest("li")!).getByRole("button", { name: "Desativar Rolo" }));
    await waitFor(() => expect(queries.some(q => q.action === "update")).toBe(true));
    const write = queries.find(q => q.action === "update")!;
    expect(write.payload).toEqual({ ativo: false });
    expect(write.filters).toEqual([["company_id", "company-1"], ["id", "p1"]]);
  });
});

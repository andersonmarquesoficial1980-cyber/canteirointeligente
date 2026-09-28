import { describe, expect, it, vi } from "vitest";
import { loadFuelEquipment, loadFuelOperatorNames } from "./abastecimentoCatalog";

function fakeDb(rows: unknown[] = []) {
  const query = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null }),
  };
  for (const method of ["select", "eq", "in", "order"] as const) query[method].mockReturnValue(query);
  return { from: vi.fn(() => query), query };
}

describe("cadastros centrais no Abastecimento", () => {
  it("reads equipment only from the user's company", async () => {
    const db = fakeDb([{ id: "eq-1", frota: "CB01" }]);
    expect(await loadFuelEquipment(db, "fremix")).toEqual([{ id: "eq-1", frota: "CB01" }]);
    expect(db.from).toHaveBeenCalledWith("equipamentos");
    expect(db.query.eq).toHaveBeenCalledWith("company_id", "fremix");
    expect(db.query.in).toHaveBeenCalledWith("status", ["ativo", "Operando"]);
  });

  it("never reads equipment without a company", async () => {
    const db = fakeDb();
    await expect(loadFuelEquipment(db, null)).rejects.toThrow("Empresa não identificada");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("reads authorized operator IDs from employees in the same company", async () => {
    const db = fakeDb([{ name: "Operador" }]);
    expect(await loadFuelOperatorNames(db, "fremix", ["employee-1"])).toEqual(["Operador"]);
    expect(db.from).toHaveBeenCalledWith("employees");
    expect(db.query.eq).toHaveBeenCalledWith("company_id", "fremix");
    expect(db.query.in).toHaveBeenCalledWith("id", ["employee-1"]);
  });

  it("never reads employees without a company", async () => {
    const db = fakeDb();
    await expect(loadFuelOperatorNames(db, null, ["employee-1"])).rejects.toThrow("Empresa não identificada");
    expect(db.from).not.toHaveBeenCalled();
  });
});

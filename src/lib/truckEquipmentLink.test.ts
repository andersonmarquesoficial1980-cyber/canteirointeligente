import { describe, expect, it } from "vitest";
import { resolveTruckEquipment } from "./truckEquipmentLink";

const truck = { id: "truck-1", company_id: "fremix", placa: "ABC-1D23" };

describe("resolveTruckEquipment", () => {
  it("links an unambiguous plate within the same company", () => {
    const equipment = { id: "eq-1", company_id: "fremix", placa: "abc1d23", frota: "CB01", modelo_completo: "FMX" };
    expect(resolveTruckEquipment(truck, [equipment])).toBe(equipment);
  });

  it("does not cross company boundaries", () => {
    expect(resolveTruckEquipment(truck, [{ id: "eq-other", company_id: "other", placa: "ABC1D23" }])).toBeNull();
  });

  it("leaves ambiguous matches unresolved", () => {
    expect(resolveTruckEquipment(truck, [
      { id: "eq-1", company_id: "fremix", placa: "ABC1D23" },
      { id: "eq-2", company_id: "fremix", placa: "ABC-1D23" },
    ])).toBeNull();
  });

  it("does not infer an external truck when the plate is absent", () => {
    expect(resolveTruckEquipment({ ...truck, placa: "" }, [{ id: "eq-1", company_id: "fremix", placa: "" }])).toBeNull();
  });

  it("requires the truck company before linking", () => {
    expect(resolveTruckEquipment({ ...truck, company_id: null }, [{ id: "eq-1", company_id: "fremix", placa: "ABC1D23" }])).toBeNull();
  });
});

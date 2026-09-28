import { describe, expect, it } from "vitest";
import { buildPersonMovement, buildEquipmentMovement, summarizeTeamRental, assertNewAdmission } from "./programadorIndividual";

const person = { id: "p1", company_id: "c1", equipe: "A", status: "ativo" };
const equipment = { id: "e1", company_id: "c1", setor: "A", status: "ativo" };

describe("movimentação individual do Programador", () => {
  it("changes only the selected employee's team, leaving their status intact", () => {
    expect(buildPersonMovement(person, "c1", "transferencia", "B")).toEqual({ id: "p1", equipe: "B", status: "ativo" });
  });
  it("changes only the selected equipment's status, retaining its team", () => {
    expect(buildEquipmentMovement(equipment, "c1", "status", "em_manutencao", "A")).toEqual({ id: "e1", setor: "A", status: "em_manutencao", responsavel_destino: "A" });
  });
  it("refuses a cross-company record", () => {
    expect(() => buildPersonMovement(person, "c2", "status", "afastado")).toThrow(/empresa/);
    expect(() => buildEquipmentMovement(equipment, "c2", "transferencia", "B")).toThrow(/empresa/);
  });
  it("refuses empty targets and accidental no-op", () => {
    expect(() => buildPersonMovement(person, "c1", "transferencia", "")).toThrow(/destino/);
    expect(() => buildEquipmentMovement(equipment, "c1", "transferencia", "A")).toThrow(/alteração/);
  });
  it("sums only rentals and flags missing monthly prices instead of counting them as zero", () => {
    expect(summarizeTeamRental([
      { condicao: "TERCEIRO", valor_mensal: 1250 },
      { condicao: "terceiro", valor_mensal: null },
      { condicao: "PROPRIO", valor_mensal: 8000 },
    ])).toEqual({ rented: 2, monthlyKnown: 1250, withoutPrice: 1 });
  });
  it("does not present an explicitly zero rental price as uncatalogued", () => {
    expect(summarizeTeamRental([{ condicao: "TERCEIRO", valor_mensal: 0 }]))
      .toEqual({ rented: 1, monthlyKnown: 0, withoutPrice: 0 });
  });
  it("blocks admission if the matricula already exists instead of overwriting the employee", () => {
    expect(() => assertNewAdmission("c1", "existing-id")).toThrow(/matrícula já existe/);
    expect(() => assertNewAdmission(null, null)).toThrow(/Empresa/);
    expect(() => assertNewAdmission("c1", null)).not.toThrow();
  });
});

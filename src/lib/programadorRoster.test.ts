import { describe, expect, it } from "vitest";
import { filterRosterPeople, filterRosterEquipment, prepareRosterPersonChange, prepareRosterEquipmentChange } from "./programadorRoster";

const people = [
  { id: "1", company_id: "c1", name: "Álvaro", matricula: "10", role: "Motorista", equipe: "Equipe A", status: "ativo" },
  { id: "2", company_id: "c1", name: "Bruna", matricula: "11", role: "Operadora", equipe: "Equipe B", status: "afastado" },
  { id: "3", company_id: "c1", name: "Carlos", matricula: "12", role: "Motorista", equipe: null, status: "ativo" },
];
const equipment = [
  { id: "a", company_id: "c1", frota: "BC10", centro_custo: "CC10", placa: "AAA1A11", tipo: "Basculante", setor: "Equipe A", status: "ativo", condicao: "TERCEIRO", valor_mensal: 1000, empresa_proprietaria: "Alugadora" },
  { id: "b", company_id: "c1", frota: "BC02", centro_custo: null, placa: null, tipo: "Rolo", setor: null, status: "em_manutencao", condicao: "PROPRIO", valor_mensal: null, empresa_proprietaria: null },
];

describe("listas individuais no WF Programador", () => {
  it("shows employees alphabetically, filters by function and searches without accents", () => {
    expect(filterRosterPeople(people, {}).map(p => p.id)).toEqual(["1", "2", "3"]);
    expect(filterRosterPeople(people, { role: "Motorista", sort: "desc" }).map(p => p.id)).toEqual(["3", "1"]);
    expect(filterRosterPeople(people, { search: "alvaro" }).map(p => p.id)).toEqual(["1"]);
    expect(filterRosterPeople(people, { search: "11" }).map(p => p.id)).toEqual(["2"]);
    expect(filterRosterPeople(people, { status: "afastado" }).map(p => p.id)).toEqual(["2"]);
  });
  it("shows all equipment by fleet, type and searchable identifiers", () => {
    expect(filterRosterEquipment(equipment, {}).map(e => e.id)).toEqual(["b", "a"]);
    expect(filterRosterEquipment(equipment, { type: "Rolo" }).map(e => e.id)).toEqual(["b"]);
    expect(filterRosterEquipment(equipment, { search: "cc10" }).map(e => e.id)).toEqual(["a"]);
    expect(filterRosterEquipment(equipment, { search: "AAA1A11" }).map(e => e.id)).toEqual(["a"]);
  });
  it("prepares one auditable employee change without changing identity or another company", () => {
    expect(prepareRosterPersonChange(people[0], "c1", { equipe: "Equipe B", status: "ativo" }))
      .toEqual({ id: "1", equipe: "Equipe B", status: "ativo" });
    expect(() => prepareRosterPersonChange(people[0], "c2", { equipe: "Equipe B", status: "ativo" })).toThrow(/empresa/);
    expect(() => prepareRosterPersonChange(people[0], "c1", { equipe: "Equipe A", status: "ativo" })).toThrow(/alteração/);
  });
  it("can change only status for a person or equipment without a team", () => {
    expect(prepareRosterPersonChange(people[2], "c1", { equipe: "", status: "afastado" }))
      .toEqual({ id: "3", equipe: null, status: "afastado" });
    expect(prepareRosterEquipmentChange(equipment[1], "c1", { setor: "", status: "ativo" }, null))
      .toEqual({ id: "b", setor: null, status: "ativo", responsavel_destino: null });
  });
  it("prepares one equipment change by ID even when fleet codes repeat", () => {
    expect(prepareRosterEquipmentChange(equipment[0], "c1", { setor: "Equipe B", status: "em_manutencao" }, "Beto"))
      .toEqual({ id: "a", setor: "Equipe B", status: "em_manutencao", responsavel_destino: "Beto" });
    expect(() => prepareRosterEquipmentChange(equipment[0], "other", { setor: "Equipe B", status: "ativo" }, null)).toThrow(/empresa/);
  });
});

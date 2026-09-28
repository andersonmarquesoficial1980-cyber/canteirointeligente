import { describe, expect, it } from "vitest";
import { prepareEfficiencyMeeting } from "./programadorMeeting";

const people = [
  { id: "p1", name: "Ana", equipe: "EQUIPE A", status: "ativo", role: "Motorista" },
  { id: "p2", name: "Beto", equipe: null, status: "afastado", role: null },
];
const equipment = [
  { id: "q1", setor: "EQUIPE A", tipo: "CAMINHÃO BASCULANTE", frota: "A1", status: "em_manutencao", condicao: "TERCEIRO", valor_mensal: 1500, empresa_proprietaria: "Locadora A", locadora: null },
  { id: "q2", setor: null, tipo: "ESCAVADEIRA", frota: "B2", status: "ativo", condicao: "TERCEIRO", valor_mensal: null, empresa_proprietaria: null, locadora: "Locadora B" },
  { id: "q3", setor: "EQUIPE A", tipo: "ESCAVADEIRA", frota: "C3", status: "ativo", condicao: "PROPRIO", valor_mensal: 900, empresa_proprietaria: null, locadora: null },
];

// These are master records, never copied to a second table or modified by the meeting view.
describe("reunião de eficiência do Programador", () => {
  it("covers all teams and unallocated master records without counting own fleet rental", () => {
    const result = prepareEfficiencyMeeting(people, equipment, {});
    expect(result.people.map(p => p.id)).toEqual(["p1", "p2"]);
    expect(result.equipment.map(e => e.id)).toEqual(["q1", "q2", "q3"]);
    expect(result.rental).toEqual({ rented: 2, monthlyKnown: 1500, withoutPrice: 1 });
    expect(result.teams).toEqual(["EQUIPE A"]);
    expect(result.byLessor).toEqual([
      { name: "Locadora A", count: 1, monthlyKnown: 1500, withoutPrice: 0 },
      { name: "Locadora B", count: 1, monthlyKnown: 0, withoutPrice: 1 },
    ]);
  });
  it("shows unallocated people and equipment separately from the selected team", () => {
    const team = prepareEfficiencyMeeting(people, equipment, { team: "equipe a" });
    expect(team.people.map(p => p.id)).toEqual(["p1"]);
    expect(team.equipment.map(e => e.id)).toEqual(["q1", "q3"]);
    const free = prepareEfficiencyMeeting(people, equipment, { team: "__sem_equipe__" });
    expect(free.people.map(p => p.id)).toEqual(["p2"]);
    expect(free.equipment.map(e => e.id)).toEqual(["q2"]);
  });
  it("filters equipment by status, type and search, with KPIs derived from visible rows only", () => {
    const filtered = prepareEfficiencyMeeting(people, equipment, { status: "manutencao", type: "CAMINHÃO BASCULANTE", search: "Locadora A" });
    expect(filtered.equipment.map(e => e.id)).toEqual(["q1"]);
    expect(filtered.rental.monthlyKnown).toBe(1500);
    expect(filtered.people).toHaveLength(2); // Equipment-only filters must not silently hide people.
    const noMatch = prepareEfficiencyMeeting(people, equipment, { search: "inexistente" });
    expect(noMatch.equipment).toHaveLength(0);
    expect(noMatch.rental.monthlyKnown).toBe(0);
    expect(noMatch.people).toHaveLength(2);
  });
  it("sorts maintenance before operational and preserves explicit zero as a known price", () => {
    const list = [
      { ...equipment[0], id: "first", status: "ativo", valor_mensal: 0 },
      { ...equipment[0], id: "second", status: "em_manutencao", valor_mensal: 250 },
    ];
    const result = prepareEfficiencyMeeting([], list, {});
    expect(result.equipment.map(e => e.id)).toEqual(["second", "first"]);
    expect(result.rental).toEqual({ rented: 2, monthlyKnown: 250, withoutPrice: 0 });
  });
});

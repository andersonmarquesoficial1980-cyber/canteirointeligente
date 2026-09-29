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
  it("includes only selected roles and types, while hiding cost centers, without changing master records", () => {
    const staff = [
      { ...people[0], centro_custo: "CC 01" },
      { ...people[0], id: "p3", name: "Cris", role: "Apontador", centro_custo: "CC 02" },
    ];
    const fleet = [
      { ...equipment[0], centro_custo: "CC 01" },
      { ...equipment[1], centro_custo: "CC 02" },
      { ...equipment[2], centro_custo: null },
    ];
    const view = prepareEfficiencyMeeting(staff, fleet, {
      selectedRoles: ["MOTORISTA"], selectedTypes: ["caminhao basculante"], hiddenCostCenters: ["cc 02"],
    });
    expect(prepareEfficiencyMeeting(staff, fleet, { selectedRoles: ["motorista"], selectedTypes: ["caminhao basculante"] }).people.map(p => p.id)).toEqual(["p1"]);
    expect(view.people.map(p => p.id)).toEqual(["p1"]);
    expect(view.equipment.map(e => e.id)).toEqual(["q1"]);
    expect(view.rental).toEqual({ rented: 1, monthlyKnown: 1500, withoutPrice: 0 });
    expect(fleet).toHaveLength(3);
    expect(staff).toHaveLength(2);
  });
  it("excludes dismissed employees from every presentation and its team/category catalogs, but not the master", () => {
    const roster = [
      ...people,
      { id: "dismissed", name: "Carla", equipe: "EQUIPE DEMITIDOS", status: " DEMITIDO ", role: "Técnica" },
    ];
    for (const filters of [{}, { team: "__sem_equipe__" }, { team: "EQUIPE DEMITIDOS" }, { selectedRoles: ["tecnica"] }]) {
      const view = prepareEfficiencyMeeting(roster, equipment, filters);
      expect(view.people.map(p => p.id)).not.toContain("dismissed");
      expect(view.teams).not.toContain("EQUIPE DEMITIDOS");
    }
    expect(roster).toHaveLength(3);
  });
  it("lets presentation hide records without a cost center", () => {
    const result = prepareEfficiencyMeeting(people, equipment, { hiddenCostCenters: ["__sem_centro__"] });
    expect(result.people).toHaveLength(0);
    expect(result.equipment).toHaveLength(0);
  });
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
  it("excludes returned fleet from every meeting filter, counts, costs and team shortcuts without touching master records", () => {
    const returned = [
      { ...equipment[0], id: "returned-free", setor: null, status: "DEVOLVIDO", valor_mensal: 2000 },
      { ...equipment[0], id: "returned-team", setor: "EQUIPE B", status: "devolvido", valor_mensal: null },
      { ...equipment[0], id: "to-return", setor: null, status: "devolver", valor_mensal: 300 },
    ];
    const masters = [...equipment, ...returned];
    for (const filters of [{}, { team: "__sem_equipe__" }, { status: "terceiro" }, { team: "EQUIPE B" }]) {
      const result = prepareEfficiencyMeeting(people, masters, filters);
      expect(result.equipment.map(e => e.id)).not.toContain("returned-free");
      expect(result.equipment.map(e => e.id)).not.toContain("returned-team");
      expect(result.teams).not.toContain("EQUIPE B");
      expect(result.rental.monthlyKnown).toBe(filters.team === "EQUIPE B" ? 0 : filters.team === "__sem_equipe__" ? 300 : 1800);
      expect(result.byLessor.some(group => group.name === "Locadora A" && group.monthlyKnown > 1800)).toBe(false);
    }
    expect(prepareEfficiencyMeeting(people, masters, { team: "__sem_equipe__" }).equipment.map(e => e.id)).toContain("to-return");
    expect(masters).toHaveLength(6);
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

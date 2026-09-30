import { summarizeTeamRental } from "./programadorIndividual";
import { excludeReturnedFleet } from "./programadorTeams";

export type MeetingPerson = {
  id: string; name: string; equipe: string | null; status: string | null;
  matricula?: string | null; role?: string | null; centro_custo?: string | null;
};
export type MeetingEquipment = {
  id: string; setor: string | null; tipo: string | null; frota: string | null;
  categoria_rdo?: string | null;
  status?: string | null; condicao: string | null; valor_mensal: number | null;
  empresa_proprietaria: string | null; locadora?: string | null;
  centro_custo?: string | null; placa?: string | null;
};
export type MeetingFilters = {
  team?: string; teams?: readonly string[]; status?: string; type?: string; search?: string; personSearch?: string;
  selectedRoles?: readonly string[]; selectedTypes?: readonly string[]; selectedStatuses?: readonly string[]; hiddenCostCenters?: readonly string[];
};

const normal = (value?: string | null) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const meetingFilterKey = (value?: string | null, emptyKey = "__sem_centro__") => normal(value) || emptyKey;
export type BalloonOption = { key: string; label: string; count: number };
/** Options come only from the already company-scoped meeting rows (never the global catalog). */
export function balloonOptions<T>(rows: readonly T[], field: (row: T) => string | null | undefined, emptyKey: string, emptyLabel: string): BalloonOption[] {
  const options = new Map<string, BalloonOption>();
  for (const row of rows) {
    const value = field(row)?.trim();
    const key = meetingFilterKey(value, emptyKey);
    const current = options.get(key);
    if (current) current.count++;
    else options.set(key, { key, label: value || emptyLabel, count: 1 });
  }
  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}
const isHidden = (hidden: readonly string[] | undefined, value: string | null | undefined, emptyKey: string) =>
  hidden?.some(item => meetingFilterKey(item, emptyKey) === meetingFilterKey(value, emptyKey)) || false;
const isRental = (eq: MeetingEquipment) => normal(eq.condicao) === "terceiro";
export const meetingStatus = (eq: MeetingEquipment) => {
  const status = normal(eq.status).replace(/[_\s]/g, "");
  const setor = normal(eq.setor);
  if (status.includes("manut")) return "manutencao";
  if (status.includes("inoperante") || status.includes("inativo")) return "inoperante";
  if (status.includes("devolvido")) return "devolvido";
  if (status.includes("devolver")) return "devolver";
  if (status.includes("disposicao")) return "disposicao";
  if (status.includes("diaria")) return "diaria";
  if (status.includes("operac") || status.includes("ativo") || status.includes("operando")) return "operacional";
  if (setor.includes("manut")) return "manutencao";
  if (setor.includes("disposicao")) return "disposicao";
  return "operacional";
};

export function prepareEfficiencyMeeting<P extends MeetingPerson, E extends MeetingEquipment>(
  people: readonly P[], equipment: readonly E[], filters: MeetingFilters,
) {
  // Master records remain untouched; dismissed staff and returned fleet never enter a presentation.
  const availablePeople = people.filter(person => normal(person.status) !== "demitido");
  const availableEquipment = excludeReturnedFleet(equipment);
  const teams = [...new Set([...availablePeople.map(p => p.equipe?.trim()), ...availableEquipment.map(e => e.setor?.trim())]
    .filter((t): t is string => Boolean(t)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const matchesTeam = (selected: string, value?: string | null) => selected === "__sem_equipe__"
    ? !value?.trim() : normal(value) === normal(selected);
  const inTeam = (value?: string | null) => filters.teams?.length
    ? filters.teams.some(selected => matchesTeam(selected, value))
    : !filters.team || matchesTeam(filters.team, value);
  const personSearch = normal(filters.personSearch);
  const selectedPeople = availablePeople.filter(p => inTeam(p.equipe)
    && (!personSearch || [p.name, p.matricula, p.role, p.equipe, p.centro_custo].some(field => normal(field).includes(personSearch)))
    && (!filters.selectedRoles?.length || filters.selectedRoles.some(key => meetingFilterKey(key, "__sem_funcao__") === meetingFilterKey(p.role, "__sem_funcao__")))
    && !isHidden(filters.hiddenCostCenters, p.centro_custo, "__sem_centro__"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const search = normal(filters.search);
  const selectedEquipment = availableEquipment.filter(e => inTeam(e.setor)
    && (!filters.selectedTypes?.length || filters.selectedTypes.some(key => meetingFilterKey(key, "__sem_tipo__") === meetingFilterKey(e.tipo, "__sem_tipo__")))
    && (!filters.selectedStatuses?.length || filters.selectedStatuses.includes(meetingStatus(e)))
    && !isHidden(filters.hiddenCostCenters, e.centro_custo, "__sem_centro__")
    && (!filters.type || normal(e.tipo) === normal(filters.type))
    && (!filters.status || filters.status === "todos" || (filters.status === "terceiro" ? isRental(e) : meetingStatus(e) === filters.status))
    && (!search || [e.centro_custo, e.frota, e.placa, e.tipo, e.setor, e.empresa_proprietaria, e.locadora]
      .some(field => normal(field).includes(search))))
    .sort((a, b) => Number(meetingStatus(b) === "manutencao") - Number(meetingStatus(a) === "manutencao")
      || (a.frota || "").localeCompare(b.frota || "", "pt-BR"));
  const rental = summarizeTeamRental(selectedEquipment);
  const grouped = new Map<string, { name: string; count: number; monthlyKnown: number; withoutPrice: number }>();
  for (const eq of selectedEquipment.filter(isRental)) {
    const name = eq.empresa_proprietaria?.trim() || eq.locadora?.trim() || "Empresa não informada";
    const group = grouped.get(name) || { name, count: 0, monthlyKnown: 0, withoutPrice: 0 };
    group.count += 1;
    const amount = eq.valor_mensal;
    if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) < 0) group.withoutPrice += 1;
    else group.monthlyKnown += Number(amount);
    grouped.set(name, group);
  }
  return {
    people: selectedPeople, equipment: selectedEquipment, rental, teams,
    byLessor: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

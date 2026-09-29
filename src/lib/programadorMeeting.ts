import { summarizeTeamRental } from "./programadorIndividual";

export type MeetingPerson = {
  id: string; name: string; equipe: string | null; status: string | null;
  matricula?: string | null; role?: string | null;
};
export type MeetingEquipment = {
  id: string; setor: string | null; tipo: string | null; frota: string | null;
  categoria_rdo?: string | null;
  status?: string | null; condicao: string | null; valor_mensal: number | null;
  empresa_proprietaria: string | null; locadora?: string | null;
  centro_custo?: string | null; placa?: string | null;
};
export type MeetingFilters = { team?: string; status?: string; type?: string; search?: string };

const normal = (value?: string | null) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
  // Returned fleet remains in the master register, but is no longer available to schedule in a meeting.
  const availableEquipment = equipment.filter(e => normal(e.status) !== "devolvido");
  const teams = [...new Set([...people.map(p => p.equipe?.trim()), ...availableEquipment.map(e => e.setor?.trim())]
    .filter((t): t is string => Boolean(t)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const inTeam = (value?: string | null) => !filters.team
    || (filters.team === "__sem_equipe__" ? !value?.trim() : normal(value) === normal(filters.team));
  const selectedPeople = people.filter(p => inTeam(p.equipe)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const search = normal(filters.search);
  const selectedEquipment = availableEquipment.filter(e => inTeam(e.setor)
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

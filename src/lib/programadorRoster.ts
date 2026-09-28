export type RosterPerson = {
  id: string; company_id?: string | null; name: string; matricula: string | null;
  role: string | null; equipe: string | null; status: string | null;
};
export type RosterEquipment = {
  id: string; company_id?: string | null; frota: string | null;
  centro_custo?: string | null; placa?: string | null; tipo: string | null;
  setor: string | null; status?: string | null;
  condicao: string | null; valor_mensal: number | null;
  empresa_proprietaria?: string | null;
};
export type RosterFilter = { search?: string; role?: string; team?: string; status?: string; type?: string; sort?: "asc" | "desc" };
export type PersonDraft = { equipe: string; status: string };
export type EquipmentDraft = { setor: string; status: string };
const norm = (text?: string | null) => (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
const matchTeam = (value: string | null, wanted?: string) => !wanted || (wanted === "__sem__" ? !value?.trim() : norm(value) === norm(wanted));

export function filterRosterPeople<T extends RosterPerson>(rows: readonly T[], filter: RosterFilter): T[] {
  const search = norm(filter.search);
  return rows.filter(row => (!filter.role || norm(row.role) === norm(filter.role))
    && matchTeam(row.equipe, filter.team)
    && (!filter.status || norm(row.status) === norm(filter.status))
    && (!search || [row.name, row.matricula, row.role, row.equipe].some(value => norm(value).includes(search))))
    .sort((a, b) => (filter.sort === "desc" ? -1 : 1) * a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
}

export function filterRosterEquipment<T extends RosterEquipment>(rows: readonly T[], filter: RosterFilter): T[] {
  const search = norm(filter.search);
  return rows.filter(row => (!filter.type || norm(row.tipo) === norm(filter.type))
    && matchTeam(row.setor, filter.team)
    && (!filter.status || norm(row.status) === norm(filter.status))
    && (!search || [row.frota, row.centro_custo, row.placa, row.tipo, row.setor, row.empresa_proprietaria].some(value => norm(value).includes(search))))
    .sort((a, b) => (filter.sort === "desc" ? -1 : 1) * (a.frota || a.centro_custo || a.placa || "").localeCompare(b.frota || b.centro_custo || b.placa || "", "pt-BR", { numeric: true }) || a.id.localeCompare(b.id));
}

export function prepareRosterPersonChange(row: RosterPerson, companyId: string | null, draft: PersonDraft) {
  if (!companyId || row.company_id !== companyId) throw new Error("Funcionário fora da empresa atual");
  const equipe = draft.equipe.trim() || null;
  if (!equipe && row.equipe?.trim()) throw new Error("Selecione a equipe do funcionário");
  const status = draft.status.trim();
  if (!['ativo','afastado','demitido','ferias'].includes(status)) throw new Error("Status inválido");
  if (equipe === (row.equipe || null) && status === row.status) throw new Error("Nenhuma alteração identificada");
  return { id: row.id, equipe, status };
}

export function prepareRosterEquipmentChange(row: RosterEquipment, companyId: string | null, draft: EquipmentDraft, responsible: string | null) {
  if (!companyId || row.company_id !== companyId) throw new Error("Equipamento fora da empresa atual");
  const setor = draft.setor.trim() || null;
  if (!setor && row.setor?.trim()) throw new Error("Selecione a equipe/setor do equipamento");
  const status = draft.status.trim();
  if (!['ativo','em_manutencao','inoperante','inativo','devolver','devolvido','diaria','disposicao'].includes(status)) throw new Error("Status inválido");
  if (setor === (row.setor || null) && status === row.status) throw new Error("Nenhuma alteração identificada");
  return { id: row.id, setor, status, responsavel_destino: responsible };
}

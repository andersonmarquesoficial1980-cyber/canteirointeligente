type EmployeeTeam = { id: string; company_id?: string | null; equipe: string | null };
type EquipmentTeam = { company_id?: string | null; setor: string | null };
type Team = { id: string; nome: string; responsavel: string | null; ativa: boolean; responsavel_employee_id: string | null };

const key = (value?: string | null) => (value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Selector value is a UI sentinel, never a persisted team name. */
export function filterByTeamSelection<T>(rows: readonly T[], selected: string, teamOf: (row: T) => string | null | undefined): T[] {
  if (!selected) return [];
  if (selected === "__sem_equipe__") return rows.filter(row => !teamOf(row)?.trim());
  return rows.filter(row => key(teamOf(row)) === key(selected));
}

/** ci_equipes is a legacy global catalog WITHOUT company_id. Only display names
 * already referenced by masters of this company or teams led by its employee. */
export async function fetchTeamsForCompany(
  client: any, companyId: string,
  people: readonly EmployeeTeam[], equipment: readonly EquipmentTeam[],
): Promise<Team[]> {
  if (!companyId) throw new Error("Empresa não identificada");
  const scopedPeople = people.filter(p => p.company_id === companyId);
  const scopedEquipment = equipment.filter(e => e.company_id === companyId);
  const usedNames = new Set([
    ...scopedPeople.map(p => key(p.equipe)),
    ...scopedEquipment.map(e => key(e.setor)),
  ].filter(Boolean));
  const scopedIds = new Set(scopedPeople.map(p => p.id));
  const { data, error } = await client.from("ci_equipes")
    .select("id,nome,responsavel,ativa,responsavel_employee_id")
    .eq("ativa", true).order("nome");
  if (error) throw error;
  if (!data) throw new Error("Catálogo de equipes indisponível");
  return (data as Team[]).filter(team => team.ativa && (
    usedNames.has(key(team.nome)) || !!(team.responsavel_employee_id && scopedIds.has(team.responsavel_employee_id))
  ));
}

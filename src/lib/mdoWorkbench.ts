export type MdoDisposition = "ogs" | "exception" | "exclude";

export type MdoBaseDay = {
  employee_id: string;
  data: string;
  funcionario: string;
  equipe: string;
  funcao: string;
  matricula: string;
  status: string;
  presenca_rdo: string;
  ogs: string;
  rdo_ids: string;
};

export type MdoDecision = {
  employee_id: string;
  data: string;
  disposition: MdoDisposition;
  ogs_id: string | null;
  ogs_number?: string | null;
  reason: string;
  include: boolean;
};

export function eligibleOnDay(
  employee: { status: string | null; data_admissao: string | null; data_demissao: string | null },
  day: string,
): boolean {
  if (employee.data_admissao && employee.data_admissao > day) return false;
  if (employee.data_demissao && employee.data_demissao < day) return false;
  return employee.status === "ativo" || Boolean(employee.data_demissao && employee.data_demissao >= day);
}

export function buildEligibleDays<T extends { id: string; status: string | null; data_admissao: string | null; data_demissao: string | null }>(
  employees: T[], days: string[],
) {
  return employees.flatMap((e) => days.filter((day) => eligibleOnDay(e, day))
    .map((data) => ({ employee_id: e.id, data })));
}

export function applyDraftDecisions<T extends MdoBaseDay>(rows: T[], decisions: MdoDecision[]) {
  const byCell = new Map(decisions.map((d) => [`${d.employee_id}|${d.data}`, d]));
  return rows.map((r) => {
    const d = byCell.get(`${r.employee_id}|${r.data}`);
    const source = r.ogs && r.ogs !== "-" ? r.ogs : "-";
    const sourceUnambiguous = source !== "-" && !source.includes(" | ");
    const ogs_custos = d?.disposition === "ogs" ? (d.ogs_number || "-") : d ? "-" : sourceUnambiguous ? source : "-";
    const situacao = d?.disposition === "exclude" ? "FORA DE CUSTOS"
      : d?.disposition === "exception" ? "JUSTIFICADO"
      : ogs_custos !== "-" ? "ALOCADO" : "PENDENTE";
    return { ...r, ogs_rdo: source, ogs_custos, situacao, motivo: d?.reason || "", include: d?.include ?? true };
  });
}

export function mapPastedOgs<T extends MdoBaseDay>(
  rows: T[], input: string, catalog: { id: string; ogs_number: string | null }[],
): MdoDecision[] {
  const tokens = input.trim().split(/\r?\n/).map((line) => line.split("\t")[0].trim()).filter(Boolean);
  if (tokens.length !== rows.length) throw new Error(`Quantidade de OGS (${tokens.length}) difere das células selecionadas (${rows.length})`);
  return rows.map((row, index) => {
    const matches = catalog.filter((ogs) => ogs.ogs_number?.trim().toUpperCase() === tokens[index].toUpperCase());
    if (matches.length !== 1) throw new Error(`OGS ${tokens[index]} não encontrada ou ambígua no cadastro`);
    return { employee_id: row.employee_id, data: row.data, disposition: "ogs", ogs_id: matches[0].id,
      ogs_number: matches[0].ogs_number, reason: "", include: true };
  });
}

export function buildBulkChanges<T extends MdoBaseDay>(
  rows: T[], selected: Set<string>, input: Omit<MdoDecision, "employee_id" | "data">,
): MdoDecision[] {
  return rows.filter((r) => selected.has(`${r.employee_id}|${r.data}`))
    .map((r) => ({ employee_id: r.employee_id, data: r.data, ...input }));
}

/** A equipe é a equipe atual de employees; dias de outro grupo ou fora do intervalo nunca entram. */
export function buildTeamPeriodChanges<T extends MdoBaseDay & { situacao: string }>(
  rows: T[], team: string, start: string, end: string,
  ogs: { id: string; ogs_number: string | null }, replaceAllocated = false,
): MdoDecision[] {
  if (!team || !start || !end || start > end || !ogs.id || !ogs.ogs_number?.trim()) return [];
  return rows.filter((r) => r.equipe === team && r.data >= start && r.data <= end
    && (r.situacao === "PENDENTE" || (replaceAllocated && r.situacao === "ALOCADO")))
    .map((r) => ({ employee_id: r.employee_id, data: r.data, disposition: "ogs",
      ogs_id: ogs.id, ogs_number: ogs.ogs_number, reason: "", include: true }));
}

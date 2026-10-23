export interface VacationPeriodInput {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  dias_direito: number;
  dias_gozados: number;
  dias_coletiva: number;
}

export interface VacationRecordInput {
  id: string;
  vacation_period_id: string | null;
  data_inicio: string;
  data_fim: string;
  dias: number;
  workflow_status?: string | null;
}

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const pt = (date: string) => date.split("-").reverse().join("/");

export function concessionDeadline(acquisitionEnd: string): string {
  const date = parseDate(acquisitionEnd);
  if (!date) throw new Error("Data aquisitiva inválida");
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return iso(date);
}

export function activeVacation(records: VacationRecordInput[], today: string): boolean {
  // Uma programação ainda não confirmada não equivale a gozo efetivo.
  return records.some((r) => r.workflow_status === "confirmada" && r.data_inicio <= today && r.data_fim >= today);
}

export function assessVacationPlan({ start, end, period, records, today, admission, kind = "individual",
 }: {
 start: string;
 end: string;
 period: VacationPeriodInput | null;
 records: VacationRecordInput[];
 today: string;
 admission?: string | null;
 kind?: "individual" | "coletiva";
 }): { errors: string[]; warnings: string[]; days: number; available: number | null; deadline: string | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to || to < from) errors.push("Informe datas válidas, com fim igual ou posterior ao início.");
  const days = from && to && to >= from ? Math.round((to.getTime() - from.getTime()) / 86400000) + 1 : 0;
  if (!period) warnings.push("Período aquisitivo e saldo não conferidos: esta programação depende de validação do RH.");
  const admissionDate = admission ? parseDate(admission) : null;
  if (!period && kind === "individual" && admissionDate && from && start < concessionDeadline(admission!)) {
    errors.push("Férias individuais antes de completar 12 meses de admissão: encaminhe ao RH.");
  }
  const deadline = period ? concessionDeadline(period.periodo_fim) : null;
  const futureRecords = period ? records.filter((r) => r.vacation_period_id === period.id && r.data_inicio > today && r.workflow_status !== "nao_confirmada") : [];
  // O legado pode ter debitado a programação futura diretamente dos contadores.
  // Sem conciliação não é possível subtrair novamente com segurança.
  if (period && futureRecords.length > 0 && period.dias_gozados + period.dias_coletiva > 0) {
    errors.push("Saldo histórico inconciliado com programação futura: solicite conferência do RH.");
  }
  const available = period ? period.dias_direito - period.dias_gozados - period.dias_coletiva
    - futureRecords.reduce((total, r) => total + r.dias, 0) : null;
  if (from && period && start <= period.periodo_fim) errors.push("O início do gozo antecede a aquisição deste período.");
  if (to && deadline && end > deadline) errors.push(`O fim das férias ultrapassa o prazo concessivo (${pt(deadline)}). Encaminhe ao RH.`);
  if (days > 0 && available !== null && days > available) errors.push(`Saldo insuficiente: ${available} dias disponíveis neste período, ${days} solicitados.`);
  if (from && to && records.some((r) => r.workflow_status !== "nao_confirmada" && start <= r.data_fim && end >= r.data_inicio)) {
    errors.push("Já existe programação que coincide com as datas escolhidas.");
  }
  if (deadline && start <= deadline && today <= deadline && Math.round((parseDate(deadline)!.getTime() - parseDate(today)!.getTime()) / 86400000) <= 60) {
    warnings.push(`Prazo concessivo próximo: ${pt(deadline)}.`);
  }
  return { errors, warnings, days, available, deadline };
}

export function summarizeVacation({ name, matricula, start, end, period, replacement }: {
  name: string;
  matricula: string | null;
  start: string;
  end: string;
  period: VacationPeriodInput | null;
  replacement: string | null;
}): string {
  return [
    "PROGRAMAÇÃO DE FÉRIAS — para conferência do RH",
    `Funcionário: ${name} | Matrícula: ${matricula || "—"}`,
    `Período de férias: ${pt(start)} a ${pt(end)}`,
    `Período aquisitivo: ${period ? `${pt(period.periodo_inicio)} a ${pt(period.periodo_fim)}` : "não vinculado — conferir"}`,
    `Cobertura: ${replacement || "a definir"}`,
    "Verificar confirmação, aviso ao empregado e demais obrigações no Workflux.",
  ].join("\n");
}

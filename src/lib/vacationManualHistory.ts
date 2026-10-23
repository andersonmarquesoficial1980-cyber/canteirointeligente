export interface PastVacationInput {
  start: string;
  end: string;
  today: string;
  kind: "individual" | "coletiva";
  source: string;
  acquisitionStart?: string | null;
  acquisitionEnd?: string | null;
  admission?: string | null;
  existing: { start: string; end: string }[];
}

const validDate = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
};

export function validatePastVacation(input: PastVacationInput): { days: number; errors: string[] } {
  const errors: string[] = [];
  const { start, end, today, source, acquisitionStart, acquisitionEnd, admission, existing } = input;
  const validInterval = validDate(start) && validDate(end) && end >= start;
  const days = validInterval ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1 : 0;
  if (!validInterval) errors.push("Informe datas de início e fim válidas.");
  if (validInterval && end >= today) errors.push("Gozo histórico exige data final anterior a hoje.");
  if (source.trim().length < 8) errors.push("Informe de onde veio a informação (mínimo 8 caracteres).");
  if (Boolean(acquisitionStart) !== Boolean(acquisitionEnd)) {
    errors.push("Informe ambas as datas do período aquisitivo ou deixe ambas em branco.");
  } else if (acquisitionStart && acquisitionEnd && (!validDate(acquisitionStart) || !validDate(acquisitionEnd) || acquisitionEnd < acquisitionStart)) {
    errors.push("Período aquisitivo inválido.");
  }
  if (validInterval && existing.some((r) => start <= r.end && end >= r.start)) {
    errors.push("Já há férias cadastradas nesse intervalo; revise antes de registrar novamente.");
  }
  if (validInterval && admission && validDate(admission) && start < admission) {
    errors.push("O gozo informado é anterior à admissão cadastrada.");
  }
  return { days, errors };
}

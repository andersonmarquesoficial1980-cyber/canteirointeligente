interface VacationReadinessInput {
  admission: string | null;
  periods: { periodo_inicio: string; periodo_fim: string }[];
  history: { periodo_inicio: string | null }[];
  records: { vacation_period_id: string | null }[];
}

/** Triagem de qualidade dos dados, não cálculo nem homologação de direito. */
export function vacationReadiness({ admission, periods, history, records }: VacationReadinessInput) {
  const reasons: string[] = [];
  if (!admission) reasons.push("Data de admissão ausente no cadastro.");
  if (!periods.length) reasons.push("Nenhum período aquisitivo cadastrado no RH.");
  else reasons.push("Período cadastrado não comprova, sozinho, o saldo de férias.");
  if (history.some((h) => !h.periodo_inicio)) reasons.push("Última saída informada sem período aquisitivo identificado.");
  if (records.some((r) => !r.vacation_period_id)) reasons.push("Programações sem período aquisitivo vinculado.");
  return { label: periods.length ? "Saldo a conferir" : "Histórico a conferir", reasons };
}

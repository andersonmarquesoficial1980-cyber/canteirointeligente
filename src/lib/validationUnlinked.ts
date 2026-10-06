export type ValidationRdoRow = { id: string; data: string; obra_nome: string | null; status_validacao: string | null; encarregado: string | null; encarregado_employee_id: string | null; validado_encarregado: boolean; nao_aprovado_encarregado: boolean; engenheiro_responsavel: string | null; engenheiro_responsavel_user_id: string | null; validado_por: string | null };
export function classifyUnlinkedValidationRdos(rows: ValidationRdoRow[]): { encarregado: ValidationRdoRow[]; engenharia: ValidationRdoRow[] } {
  const submitted = rows.filter(r => r.status_validacao !== "rascunho");
  return {
    encarregado: submitted.filter(r => r.validado_encarregado === false && r.nao_aprovado_encarregado === false && !r.encarregado_employee_id),
    engenharia: submitted.filter(r => ["enviado", "aguardando_validacao"].includes(r.status_validacao || "") && !r.validado_por && !r.engenheiro_responsavel_user_id),
  };
}

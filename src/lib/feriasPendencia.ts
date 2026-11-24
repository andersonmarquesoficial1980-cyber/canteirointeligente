/** Liga a pendência "Dar férias" (Quadro do Programador) à Programação de Férias da Gestão de Pessoas. */
export type PendenciaFeriasRow = {
  id: string; employee_id: string; tipo: string; status: string;
  justificativa: string | null; data_efetiva: string | null;
  payload: Record<string, unknown> | null; solicitado_por_nome?: string | null; prioridade?: string | null;
};

export const isPendenciaFerias = (p: Pick<PendenciaFeriasRow, "tipo" | "payload">) =>
  p.tipo === "outros" && (p.payload?.subtipo === "ferias" || String(p.payload?.outro_tipo_solicitacao ?? "").trim().toLowerCase() === "dar férias");

export function diasPendenciaFerias(p: Pick<PendenciaFeriasRow, "justificativa" | "payload">): number {
  const direto = Number(p.payload?.dias_ferias);
  if (Number.isInteger(direto) && direto > 0 && direto <= 60) return direto;
  const texto = `${p.justificativa ?? ""} ${String(p.payload?.observacao_extra ?? "")}`;
  const m = texto.match(/(\d{1,2})\s*dias?\b/i);
  const n = m ? Number(m[1]) : 0;
  return n > 0 && n <= 60 ? n : 30;
}

const addDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Período sugerido para o modal de programação (vazio se a pendência não tem data prevista). */
export function periodoSugeridoFerias(p: Pick<PendenciaFeriasRow, "data_efetiva" | "justificativa" | "payload">) {
  if (!p.data_efetiva) return { inicio: "", fim: "", dias: diasPendenciaFerias(p) };
  const dias = diasPendenciaFerias(p);
  return { inicio: p.data_efetiva, fim: addDias(p.data_efetiva, dias - 1), dias };
}

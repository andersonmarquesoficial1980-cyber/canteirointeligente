/** "Atingiu meta contratual?" do RDO Técnico: motivos e métricas do Dashboard (puro, testável). */

/** Texto exato gravado em `rdo_engenheiro.meta_contratual_motivo` (usado também pelo Dashboard). */
export const MOTIVOS_META_CONTRATUAL = [
  "Chuva / condições climáticas",
  "Concessionária (CCO/PMR/Motiva) – liberação",
  "Sinalização / Siga e Pare",
  "Usina / Massa (atraso, manutenção, transporte)",
  "Equipamento quebrado / falta de material",
  "Equipe / estrutura insuficiente",
  "Projeto sem frente suficiente",
  "Outro",
] as const;

export interface MetaRow {
  houve_producao: boolean;
  ogs_number?: string | null;
  meta_contratual_atingida?: boolean | null;
  meta_contratual_motivo?: string | null;
  meta_contratual_outro?: string | null;
}

/** Motivo para exibição: "Outro" mostra o texto digitado. */
export const motivoMetaLabel = (r: Pick<MetaRow, "meta_contratual_motivo" | "meta_contratual_outro">): string => {
  const m = (r.meta_contratual_motivo || "").trim();
  if (!m) return "Sem motivo informado";
  if (m === "Outro") return r.meta_contratual_outro?.trim() ? `Outro: ${r.meta_contratual_outro.trim()}` : "Outro";
  return m;
};

/** Só dias com produção entram; % só sobre quem respondeu (null = sem dados, nunca 0). */
export function computeMetaContratual(all: MetaRow[]) {
  const prod = all.filter(r => r.houve_producao);
  const respondidos = prod.filter(r => r.meta_contratual_atingida != null);
  const sim = respondidos.filter(r => r.meta_contratual_atingida === true).length;
  const naoRows = respondidos.filter(r => r.meta_contratual_atingida === false);

  const motivosMap = new Map<string, number>();
  naoRows.forEach(r => {
    const k = (r.meta_contratual_motivo || "").trim() || "Sem motivo informado";
    motivosMap.set(k, (motivosMap.get(k) || 0) + 1);
  });
  const motivos = [...motivosMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const ogsMap = new Map<string, { ogs: string; sim: number; nao: number }>();
  respondidos.forEach(r => {
    const k = r.ogs_number || "Sem OGS";
    const e = ogsMap.get(k) || { ogs: k, sim: 0, nao: 0 };
    if (r.meta_contratual_atingida) e.sim += 1; else e.nao += 1;
    ogsMap.set(k, e);
  });
  const porOgs = [...ogsMap.values()]
    .map(e => ({ ...e, total: e.sim + e.nao, pct: (e.sim / (e.sim + e.nao)) * 100 }))
    .sort((a, b) => a.pct - b.pct || b.nao - a.nao);

  return {
    comProducao: prod.length,
    respondidos: respondidos.length,
    semResposta: prod.length - respondidos.length,
    sim,
    nao: naoRows.length,
    pct: respondidos.length ? (sim / respondidos.length) * 100 : null,
    motivos,
    porOgs,
  };
}

/** Indicadores de Apoio e Qualidade, Retrabalho e Caminhões do RDO Técnico (cálculo puro, testável). */
export interface ApoioRow {
  houve_producao: boolean;
  ogs_number?: string | null;
  retrabalho?: boolean | null;
  retrabalho_oficio?: string | null;
  qtd_caminhoes_basculante?: number | null;
  autorizacao_no_horario?: boolean | null;
  sinalizacao_presente?: boolean | null;
  sinalizacao_nota?: number | null;
  controle_tecnologico_presente?: boolean | null;
  sinalizacao_vertical_nota?: number | null;
}

export interface SimNaoStat { sim: number; nao: number; avaliados: number; pct: number | null }
const stat = (rows: ApoioRow[], pick: (r: ApoioRow) => boolean | null | undefined): SimNaoStat => {
  const vals = rows.map(pick).filter((v): v is boolean => v != null);
  const sim = vals.filter(Boolean).length;
  return { sim, nao: vals.length - sim, avaliados: vals.length, pct: vals.length ? (sim / vals.length) * 100 : null };
};
const media = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
const distribuicao = (vals: number[]) => [1, 2, 3, 4, 5].map(n => ({ nota: String(n), value: vals.filter(v => v === n).length }));

/** Só dias com produção entram: sem produção a seção não é preenchida. */
export function computeApoioMetrics(all: ApoioRow[]) {
  const rows = all.filter(r => r.houve_producao);
  const notasSin = rows.map(r => r.sinalizacao_nota).filter((n): n is number => typeof n === "number" && n > 0);
  const notasVert = rows.map(r => r.sinalizacao_vertical_nota).filter((n): n is number => typeof n === "number" && n > 0);
  const caminhoes = rows.map(r => r.qtd_caminhoes_basculante).filter((n): n is number => typeof n === "number");
  const porOgs = new Map<string, { ogs: string; sin: number[]; vert: number[] }>();
  rows.forEach(r => {
    const k = r.ogs_number || "Sem OGS";
    const e = porOgs.get(k) || { ogs: k, sin: [], vert: [] };
    if (r.sinalizacao_nota) e.sin.push(r.sinalizacao_nota);
    if (r.sinalizacao_vertical_nota) e.vert.push(r.sinalizacao_vertical_nota);
    porOgs.set(k, e);
  });
  return {
    diasComProducao: rows.length,
    autorizacao: stat(rows, r => r.autorizacao_no_horario),
    sinalizacaoPresente: stat(rows, r => r.sinalizacao_presente),
    controleTecnologico: stat(rows, r => r.controle_tecnologico_presente),
    notaSinalizacao: { media: media(notasSin), avaliados: notasSin.length, distribuicao: distribuicao(notasSin) },
    notaVertical: { media: media(notasVert), avaliados: notasVert.length, distribuicao: distribuicao(notasVert) },
    retrabalho: { total: rows.filter(r => r.retrabalho).length, semOficio: rows.filter(r => r.retrabalho && !r.retrabalho_oficio?.trim()).length },
    caminhoes: { total: caminhoes.reduce((a, b) => a + b, 0), registros: caminhoes.length, mediaDia: media(caminhoes) },
    notaPorOgs: [...porOgs.values()]
      .filter(e => e.sin.length || e.vert.length)
      .map(e => ({ name: e.ogs, sinalizacao: media(e.sin), vertical: media(e.vert) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })),
  };
}

export const NOTA_BAIXA = 2;

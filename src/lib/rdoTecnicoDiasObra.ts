/**
 * Visão "Dias da Obra" do Dashboard RDO Técnico (cálculo puro).
 * Unidade de análise = DIA da obra (OGS), não RDO: uma obra com 2 engenheiros gera 2 RDOs por dia.
 * - Trabalhado: pelo menos um RDO do dia com produção.
 * - Sem produção: RDOs do dia sem produção, com o motivo classificado.
 * - Sem RDO: engenheiro que vinha lançando na obra e não lançou naquele dia (regra de janela abaixo).
 */

export interface DiaRdoRow {
  id: string;
  ogs_number: string | null;
  data: string; // YYYY-MM-DD
  status: string;
  equipe?: string | null;
  engenheiro_id: string | null;
  houve_producao: boolean;
  motivo_sem_producao?: string | null;
  outro_motivo_sem_producao?: string | null;
  usina_nao_atendeu_motivo?: string | null;
  observacoes?: string | null;
  choveu?: boolean | null;
  intensidade_chuva?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [campo: string]: any;
}

export type StatusDia = "trabalhado" | "sem_producao" | "sem_rdo";

export const CATEGORIAS_SEM_PRODUCAO = [
  "Chuva", "Usina", "Equipamento", "Combustível", "Transporte", "Autorização / Liberação",
  "Folga / Feriado", "Sem atividade", "Outro motivo", "Motivo não informado",
] as const;
export type CategoriaSemProducao = (typeof CATEGORIAS_SEM_PRODUCAO)[number];

/** Categorias que não são perda de produção (não entram em "dias perdidos"). */
export const CATEGORIAS_NAO_PERDA: CategoriaSemProducao[] = ["Folga / Feriado", "Sem atividade"];

const TON_FIELDS = ["binder_ton", "cbuq_fx3_ton", "gap_ton", "bgs_ton", "sma_ton", "cauq_rima_ton", "bm25_ton", "egl_ton", "rachao_ton", "fx_c_ton"];
const M2_FIELDS = ["fresagem_m2", "rap_espumado_m2", "geogrelha_m2"];
const M3_FIELDS = ["bgtc_m3", "macadame_m3"];

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const soma = (r: DiaRdoRow, campos: string[]) => campos.reduce((a, c) => a + num(r[c]), 0);

export interface Producao { ton: number; m2: number; m3: number }
export const producaoDoRdo = (r: DiaRdoRow): Producao =>
  r.houve_producao ? { ton: soma(r, TON_FIELDS), m2: soma(r, M2_FIELDS), m3: soma(r, M3_FIELDS) } : { ton: 0, m2: 0, m3: 0 };

/** Nomes dos serviços produzidos (para a coluna "o que produziu"). */
const SERVICOS: { campo: string; rotulo: string; un: string }[] = [
  { campo: "cbuq_fx3_ton", rotulo: "CBUQ", un: "t" }, { campo: "binder_ton", rotulo: "Binder", un: "t" },
  { campo: "gap_ton", rotulo: "Gap", un: "t" }, { campo: "bgs_ton", rotulo: "BGS", un: "t" },
  { campo: "sma_ton", rotulo: "SMA", un: "t" }, { campo: "cauq_rima_ton", rotulo: "CAUQ/RIMA", un: "t" },
  { campo: "bm25_ton", rotulo: "BM25", un: "t" }, { campo: "egl_ton", rotulo: "EGL", un: "t" },
  { campo: "rachao_ton", rotulo: "Rachão", un: "t" }, { campo: "fx_c_ton", rotulo: "Faixa C", un: "t" },
  { campo: "fresagem_m2", rotulo: "Fresagem", un: "m²" }, { campo: "rap_espumado_m2", rotulo: "RAP espumado", un: "m²" },
  { campo: "geogrelha_m2", rotulo: "Geogrelha", un: "m²" }, { campo: "bgtc_m3", rotulo: "BGTC", un: "m³" },
  { campo: "macadame_m3", rotulo: "Macadame", un: "m³" },
];
export function servicosDoRdo(r: DiaRdoRow): { rotulo: string; valor: number; un: string }[] {
  if (!r.houve_producao) return [];
  return SERVICOS.map(s => ({ rotulo: s.rotulo, valor: num(r[s.campo]), un: s.un })).filter(s => s.valor > 0);
}

const CHUVA_TXT = /chuv|embarg|climát|climat|precipita|temporal|garoa|pancada/i;
const USINA_TXT = /usina|usinag|motiva|usicity|cap\s+(estava\s+)?frio/i;
const EQUIP_TXT = /equipament|quebr|manuten|avaria|pane\b|caminh[aã]o quebrad/i;
const COMB_TXT = /combust|diesel/i;
const TRANSP_TXT = /transport|caminh|carreta/i;
const AUTOR_TXT = /autoriz|liber|pmr|embargo/i;

/** Escolhe a categoria cujo termo aparece primeiro no texto livre. */
function categoriaPorTexto(txt: string): CategoriaSemProducao | null {
  const cand: [CategoriaSemProducao, RegExp][] = [
    ["Chuva", CHUVA_TXT], ["Usina", USINA_TXT], ["Equipamento", EQUIP_TXT], ["Combustível", COMB_TXT],
    ["Transporte", TRANSP_TXT], ["Autorização / Liberação", AUTOR_TXT],
  ];
  let melhor: { cat: CategoriaSemProducao; pos: number } | null = null;
  for (const [cat, re] of cand) {
    const m = re.exec(txt);
    if (m && (!melhor || m.index < melhor.pos)) melhor = { cat, pos: m.index };
  }
  // "Obra não liberada pela PMR por condições climáticas": o fator real é a chuva/clima.
  if (melhor?.cat === "Autorização / Liberação" && CHUVA_TXT.test(txt)) return "Chuva";
  return melhor?.cat ?? null;
}

export interface MotivoClassificado { categoria: CategoriaSemProducao; texto: string; porTexto: boolean }

/** Classifica o motivo de um RDO sem produção (campo estruturado primeiro, texto livre quando "Outro"). */
export function classificarMotivo(r: DiaRdoRow): MotivoClassificado {
  const m = (r.motivo_sem_producao || "").trim();
  const texto = [r.outro_motivo_sem_producao, r.usina_nao_atendeu_motivo, r.observacoes].map(t => (t || "").trim()).filter(Boolean)[0] || "";
  const direto: Record<string, CategoriaSemProducao> = {
    "Chuva": "Chuva", "Usina Não Atendeu": "Usina", "Indisponibilidade de Equipamento": "Equipamento",
    "Problema de Transporte": "Transporte", "Falha de Combustível": "Combustível",
    "Falta de Autorização": "Autorização / Liberação", "Folga / Feriado": "Folga / Feriado", "Sem Atividade": "Sem atividade",
  };
  if (direto[m]) return { categoria: direto[m], texto, porTexto: false };
  const porTexto = categoriaPorTexto(texto);
  if (porTexto) return { categoria: porTexto, texto, porTexto: true };
  if (r.choveu) return { categoria: "Chuva", texto, porTexto: true };
  return { categoria: m || texto ? "Outro motivo" : "Motivo não informado", texto, porTexto: false };
}

// ---------- datas ----------
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDias = (iso: string, n: number) => fromMs(toMs(iso) + n * 86400000);
export const diffDias = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 86400000);
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const diaSemana = (iso: string) => SEMANA[new Date(toMs(iso)).getUTCDay()];

// ---------- estrutura do resultado ----------
export interface RdoDoDia {
  id: string; engenheiroId: string | null; equipe: string; status: string;
  houveProducao: boolean; producao: Producao; servicos: { rotulo: string; valor: number; un: string }[];
  motivo: MotivoClassificado | null; choveu: boolean; intensidade: string;
}
export interface DiaObra {
  ogs: string; data: string; dow: string; status: StatusDia;
  categoria: CategoriaSemProducao | null; // só em sem_producao
  motivoTexto: string; producao: Producao; rdos: RdoDoDia[];
  faltantes: string[]; // engenheiros esperados sem RDO neste dia
  choveuMasProduziu: boolean;
}
export interface FaltaRdo { ogs: string; engenheiroId: string; datas: string[] }

export interface ResumoObra {
  ogs: string; inicio: string; fim: string;
  diasNoPeriodo: number; diasTrabalhados: number; diasSemProducao: number; diasSemRdo: number;
  rdosFaltantes: number; producao: Producao;
  porCategoria: { categoria: CategoriaSemProducao; dias: number; perda: boolean }[];
  dias: DiaObra[]; faltas: FaltaRdo[];
}

export interface OpcoesDias {
  periodo: { inicio: string; fim: string };
  /** Último dia em que já se espera RDO (normalmente ontem). */
  ultimoDiaEsperado: string;
  /** Lookback: RDOs do período anterior ajudam a saber desde quando o engenheiro atua na obra. */
  historico?: DiaRdoRow[];
  /** Hiato maior que isso (dias seguidos sem RDO) = engenheiro fora da obra, não falta. */
  hiatoMaximo?: number;
  /** Se o último RDO do engenheiro foi há até N dias do fim do período, ele continua esperado até o fim. */
  toleranciaFim?: number;
}

const diasEntre = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = addDias(d, 1)) out.push(d); return out; };
const ehEnviado = (r: DiaRdoRow) => r.status === "enviado";

export function calcularDiasPorObra(rows: DiaRdoRow[], op: OpcoesDias): ResumoObra[] {
  const { periodo, ultimoDiaEsperado } = op;
  const hiatoMax = op.hiatoMaximo ?? 14;
  const tolFim = op.toleranciaFim ?? 3;
  const noPeriodo = rows.filter(r => r.ogs_number && r.data >= periodo.inicio && r.data <= periodo.fim);
  const historico = [...rows, ...(op.historico || [])].filter(r => r.ogs_number && r.engenheiro_id);
  const fimEfetivo = periodo.fim < ultimoDiaEsperado ? periodo.fim : ultimoDiaEsperado;

  const ogsList = [...new Set(noPeriodo.map(r => r.ogs_number as string))];
  return ogsList.map(ogs => {
    const rdosOgs = noPeriodo.filter(r => r.ogs_number === ogs);
    const porDia = new Map<string, DiaRdoRow[]>();
    rdosOgs.forEach(r => porDia.set(r.data, [...(porDia.get(r.data) || []), r]));

    // Engenheiros esperados: janela = 1º RDO (histórico) .. fim (se atuante recente) ou último RDO
    const engs = [...new Set(historico.filter(r => r.ogs_number === ogs).map(r => r.engenheiro_id as string))];
    const esperado = new Map<string, Set<string>>(); // data -> engenheiros esperados
    engs.forEach(eng => {
      const datas = [...new Set(historico.filter(r => r.ogs_number === ogs && r.engenheiro_id === eng).map(r => r.data))].sort();
      const primeira = datas[0], ultima = datas[datas.length - 1];
      const ini = primeira > periodo.inicio ? primeira : periodo.inicio;
      if (ini > fimEfetivo) return;
      const atuante = diffDias(ultima, periodo.fim) <= tolFim || ultima >= periodo.fim;
      const fimJanela = atuante ? fimEfetivo : (ultima < fimEfetivo ? ultima : fimEfetivo);
      const set = new Set(datas);
      // dias sem RDO consecutivos > hiatoMax = engenheiro fora da obra naquele trecho
      let seq: string[] = [];
      const flush = () => { if (seq.length && seq.length <= hiatoMax) seq.forEach(d => { (esperado.get(d) || esperado.set(d, new Set()).get(d)!).add(eng); }); seq = []; };
      diasEntre(ini, fimJanela).forEach(d => {
        if (set.has(d)) { flush(); (esperado.get(d) || esperado.set(d, new Set()).get(d)!).add(eng); } else seq.push(d);
      });
      // trecho final sem RDO só conta se curto (já limitado por fimJanela)
      flush();
    });

    const datasObra = [...new Set([...porDia.keys(), ...esperado.keys()])].filter(d => d >= periodo.inicio && d <= fimEfetivo).sort();
    const dias: DiaObra[] = datasObra.map(data => {
      const lista = porDia.get(data) || [];
      const rdos: RdoDoDia[] = lista.map(r => {
        const motivo = r.houve_producao ? null : classificarMotivo(r);
        return {
          id: r.id, engenheiroId: r.engenheiro_id, equipe: (r.equipe || "").trim(), status: r.status,
          houveProducao: !!r.houve_producao, producao: producaoDoRdo(r), servicos: servicosDoRdo(r),
          motivo, choveu: !!r.choveu, intensidade: r.intensidade_chuva || "",
        };
      });
      const enviadosEng = new Set(lista.filter(ehEnviado).map(r => r.engenheiro_id));
      const faltantes = [...(esperado.get(data) || [])].filter(e => !enviadosEng.has(e));
      const prod = rdos.reduce((a, r) => ({ ton: a.ton + r.producao.ton, m2: a.m2 + r.producao.m2, m3: a.m3 + r.producao.m3 }), { ton: 0, m2: 0, m3: 0 });
      const trabalhou = rdos.some(r => r.houveProducao);
      let status: StatusDia; let categoria: CategoriaSemProducao | null = null; let motivoTexto = "";
      if (trabalhou) status = "trabalhado";
      else if (rdos.length) {
        status = "sem_producao";
        const cats = rdos.map(r => r.motivo!).filter(Boolean);
        const preferido = cats.find(c => !CATEGORIAS_NAO_PERDA.includes(c.categoria)) || cats[0];
        categoria = preferido.categoria; motivoTexto = preferido.texto;
        if (!motivoTexto) motivoTexto = cats.map(c => c.texto).find(Boolean) || "";
      } else status = "sem_rdo";
      return {
        ogs, data, dow: diaSemana(data), status, categoria, motivoTexto, producao: prod, rdos, faltantes,
        choveuMasProduziu: trabalhou && rdos.some(r => r.choveu),
      };
    });

    const faltasMap = new Map<string, string[]>();
    dias.forEach(d => d.faltantes.forEach(e => faltasMap.set(e, [...(faltasMap.get(e) || []), d.data])));
    const faltas: FaltaRdo[] = [...faltasMap].map(([engenheiroId, datas]) => ({ ogs, engenheiroId, datas }));

    const porCat = new Map<CategoriaSemProducao, number>();
    dias.filter(d => d.status === "sem_producao").forEach(d => porCat.set(d.categoria!, (porCat.get(d.categoria!) || 0) + 1));
    const producao = dias.reduce((a, d) => ({ ton: a.ton + d.producao.ton, m2: a.m2 + d.producao.m2, m3: a.m3 + d.producao.m3 }), { ton: 0, m2: 0, m3: 0 });
    return {
      ogs, inicio: datasObra[0] || periodo.inicio, fim: datasObra[datasObra.length - 1] || periodo.fim,
      diasNoPeriodo: dias.length,
      diasTrabalhados: dias.filter(d => d.status === "trabalhado").length,
      diasSemProducao: dias.filter(d => d.status === "sem_producao").length,
      diasSemRdo: dias.filter(d => d.status === "sem_rdo").length,
      rdosFaltantes: faltas.reduce((a, f) => a + f.datas.length, 0),
      producao,
      porCategoria: CATEGORIAS_SEM_PRODUCAO.filter(c => porCat.has(c)).map(c => ({ categoria: c, dias: porCat.get(c)!, perda: !CATEGORIAS_NAO_PERDA.includes(c) }))
        .sort((a, b) => b.dias - a.dias),
      dias: dias.sort((a, b) => (a.data < b.data ? 1 : -1)), faltas,
    };
  }).sort((a, b) => Number(b.ogs) - Number(a.ogs) || a.ogs.localeCompare(b.ogs));
}

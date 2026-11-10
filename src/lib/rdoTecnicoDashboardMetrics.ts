/** Indicadores adicionais do Dashboard RDO Técnico (cálculo puro, sem unidades misturadas). */
import { TECHNICAL_QUANTITIES } from "@/lib/technicalProduction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DashRow = Record<string, any> & { houve_producao: boolean };

/** Motivos que não são perda de produção por causa externa. */
export const MOTIVOS_NAO_PERDA = ["Folga / Feriado", "Sem Atividade"];
export const MOTIVOS_SEM_PRODUCAO = ["Chuva", "Usina Não Atendeu", "Indisponibilidade de Equipamento", "Problema de Transporte",
  "Falha de Combustível", "Falta de Autorização", "Outro", ...MOTIVOS_NAO_PERDA];

/** Explicação mostrada ao clicar numa barra do gráfico de dias sem produção. */
export const MOTIVO_EXPLICACAO: Record<string, string> = {
  "Chuva": "Chuva impediu a execução do serviço no dia. Causa externa (clima): conta como dia perdido.",
  "Usina Não Atendeu": "A usina não forneceu a massa programada (não entregou ou entregou fora das condições). Causa externa: conta como dia perdido.",
  "Indisponibilidade de Equipamento": "Equipamento necessário parado, quebrado ou sem operador. Conta como dia perdido; confira a Manutenção.",
  "Problema de Transporte": "Falta ou atraso de caminhões/transporte de material. Conta como dia perdido.",
  "Falha de Combustível": "Falta de combustível para equipamentos ou comboio. Conta como dia perdido.",
  "Falta de Autorização": "Cliente/fiscalização não liberou a pista ou a frente de serviço. Causa externa: conta como dia perdido.",
  "Folga / Feriado": "Dia sem trabalho programado por folga da equipe ou feriado. NÃO é perda de produção.",
  "Sem Atividade": "Dia sem serviço programado para a equipe nesta obra (sem frente liberada ou aguardando programação). NÃO conta como perda por causa externa.",
  "Outro": "Motivo que não está na lista padrão. O engenheiro descreveu o que aconteceu — veja os textos abaixo. Conta como dia perdido.",
  "Sem motivo": "RDO sem produção em que o engenheiro não informou o motivo. Vale cobrar o preenchimento.",
};

export const motivoLabel = (r: DashRow) => (r.motivo_sem_producao === "Outro" ? "Outro" : r.motivo_sem_producao || "Sem motivo");

export function perdasPorMotivo(rows: DashRow[]) {
  const sem = rows.filter(r => !r.houve_producao);
  const cont = new Map<string, number>();
  sem.forEach(r => cont.set(motivoLabel(r), (cont.get(motivoLabel(r)) || 0) + 1));
  const lista = [...cont].map(([name, value]) => ({ name, value, perda: !MOTIVOS_NAO_PERDA.includes(name) }))
    .sort((a, b) => b.value - a.value);
  const porOgs = new Map<string, number>();
  sem.filter(r => !MOTIVOS_NAO_PERDA.includes(motivoLabel(r))).forEach(r => {
    const k = r.ogs_number || "Sem OGS"; porOgs.set(k, (porOgs.get(k) || 0) + 1);
  });
  return {
    porMotivo: lista,
    diasPerdidos: lista.filter(l => l.perda).reduce((a, l) => a + l.value, 0),
    diasNaoPerda: lista.filter(l => !l.perda).reduce((a, l) => a + l.value, 0),
    porOgs: [...porOgs].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
  };
}

const UNIDADE = (label: string) => /\(([^)]+)\)\s*$/.exec(label)?.[1] ?? "";

/** Total por tipo de serviço, sempre dentro da própria unidade. */
export function producaoPorServico(rows: DashRow[]) {
  return TECHNICAL_QUANTITIES.map(q => {
    const vals = rows.filter(r => r.houve_producao).map(r => r[q.field]).filter((v): v is number => typeof v === "number" && v > 0);
    return { servico: q.label.replace(/\s*\([^)]*\)\s*$/, ""), unidade: UNIDADE(q.label), total: vals.reduce((a, b) => a + b, 0), rdos: vals.length, field: q.field as string };
  }).filter(x => x.rdos > 0).sort((a, b) => a.unidade.localeCompare(b.unidade) || b.total - a.total);
}

/** Soma simples de um campo (para cards de Massa Fria, Demolição, PV, caminhões). */
export const somaCampo = (rows: DashRow[], field: string) =>
  rows.reduce((a, r) => a + (typeof r[field] === "number" ? (r[field] as number) : 0), 0);

/** Seção da obra só existe em contratos PMSP: ogsPmsp (quando informado) descarta RDOs antigos de outros clientes. */
export function secaoDaObra(rows: DashRow[], ogsPmsp?: ReadonlySet<string>) {
  const cont: Record<string, number> = { Funcional: 0, "Intermediário": 0, Estrutural: 0 };
  let comSecao = 0;
  const ogs = new Set<string>();
  rows.filter(r => r.houve_producao && r.tipo_secao && (!ogsPmsp || ogsPmsp.has(String(r.ogs_number)))).forEach(r => {
    comSecao++;
    if (r.ogs_number) ogs.add(String(r.ogs_number));
    String(r.tipo_secao).split(",").map(s => s.trim()).filter(s => s in cont).forEach(s => { cont[s]++; });
  });
  return { comSecao, ogs: [...ogs].sort(), itens: Object.entries(cont).map(([name, value]) => ({ name, value })) };
}

/** Resumo por OGS: retrabalho (nº e %), caminhões e última conclusão da via informada. */
export function resumoPorOgs(rows: DashRow[]) {
  const prod = rows.filter(r => r.houve_producao);
  const map = new Map<string, { ogs: string; rdos: number; retrabalhos: number; obs: string[]; caminhoes: number; conclusao: number | null; conclusaoData: string }>();
  prod.forEach(r => {
    const k = r.ogs_number || "Sem OGS";
    const e = map.get(k) || { ogs: k, rdos: 0, retrabalhos: 0, obs: [], caminhoes: 0, conclusao: null, conclusaoData: "" };
    e.rdos++;
    if (r.retrabalho) { e.retrabalhos++; if (r.retrabalho_oficio?.trim()) e.obs.push(r.retrabalho_oficio.trim()); }
    if (typeof r.qtd_caminhoes_basculante === "number") e.caminhoes += r.qtd_caminhoes_basculante;
    if (typeof r.perc_conclusao_via === "number" && (r.data || "") >= e.conclusaoData) { e.conclusao = r.perc_conclusao_via; e.conclusaoData = r.data || ""; }
    map.set(k, e);
  });
  return [...map.values()].map(e => ({ ...e, pctRetrabalho: e.rdos ? (e.retrabalhos / e.rdos) * 100 : 0 }))
    .sort((a, b) => b.retrabalhos - a.retrabalhos || a.ogs.localeCompare(b.ogs, "pt-BR", { numeric: true }));
}

/** Clima: separa chuva que parou a produção da chuva em dia produtivo (com intensidade). */
export function climaSplit(rows: DashRow[]) {
  const chuva = rows.filter(r => r.choveu);
  return {
    pararam: chuva.filter(r => !r.houve_producao).length,
    comProducao: chuva.filter(r => r.houve_producao).length,
    semIntensidadeComProducao: chuva.filter(r => r.houve_producao && !r.intensidade_chuva).length,
  };
}

/** Situação da usina em um RDO (para filtros da aba Usina). */
export const situacaoUsina = (r: DashRow): "Atendeu" | "Não atendeu" | "Sem avaliação" =>
  r.usina_atendeu === false || (!r.houve_producao && r.motivo_sem_producao === "Usina Não Atendeu") ? "Não atendeu"
    : r.usina_atendeu === true ? "Atendeu" : "Sem avaliação";

/** Situação da chuva em um RDO (para filtros da aba Clima). */
export const situacaoClima = (r: DashRow): "Choveu e houve produção" | "Choveu e parou a produção" =>
  r.houve_producao ? "Choveu e houve produção" : "Choveu e parou a produção";

/** Equipes do filtro: oculta as desmarcadas no RDO Técnico, preservando as que têm histórico. */
export function equipesVisiveisFiltro(cadastro: { nome: string; exibir?: boolean | null }[], historico: string[], atual = ""): string[] {
  const hist = new Set(historico.map(h => h.trim().toLowerCase()));
  const base = cadastro.filter(e => e.exibir !== false || hist.has(e.nome.trim().toLowerCase())).map(e => e.nome.trim());
  const todas = [...base, ...historico.map(h => h.trim()).filter(Boolean)];
  if (atual && !todas.some(e => e.toLowerCase() === atual.toLowerCase())) todas.push(atual);
  return [...new Set(todas)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

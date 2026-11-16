/**
 * Relatório "Quadro de Hoje" (RH) — lógica pura, sem I/O.
 * Linhas saem do MESMO resultado de `projetarPessoas` que o Quadro Pessoas do WF Programador desenha,
 * então o relatório nunca diverge do quadro. Só pessoas (vagas "A contratar" ficam de fora).
 */
import { chaveEquipe, estaDemitido, SEM_EQUIPE, type PessoaQuadro } from "@/lib/quadroEquipes";
import { COLUNA_AFASTADOS, COLUNA_FERIAS, ehColunaDoRH, type PessoaProjetada } from "@/lib/quadroAlocacao";

export type OgsEquipe = { ogs: string | null; atualizadoEm: string | null; atualizadoPor?: string | null };
export type OgsPorEquipe = Record<string, OgsEquipe>;

export type LinhaQuadroHoje = {
  id: string;
  equipe: string;
  /** OGS da equipe-coluna (vazia em Sem equipe, Férias e Afastados). */
  ogs: string;
  matricula: string;
  nome: string;
  funcao: string;
  situacao: string;
  /** Equipe de origem quando a pessoa está emprestada, de férias ou afastada. */
  origem: string;
  /** Última movimentação no quadro (ISO date/datetime) ou "". */
  ultimaMov: string;
};

export type PessoaHoje = PessoaQuadro & PessoaProjetada;

/** Mesma normalização de status que o WF Programador aplica ao carregar `employees` (ProgramadorHome). */
export function statusComoProgramador(value?: string | null): string {
  const t = (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]/g, "").toLowerCase().trim();
  if (!t || t === "trabalhou" || t === "ativo") return "ativo";
  if (t === "afastado" || t === "falta" || t === "disposicao") return "afastado";
  if (t === "demitido" || t === "demissao") return "demitido";
  if (t === "ferias") return "ferias";
  return "ativo";
}

export const ROTULO_SEM_EQUIPE = "Sem equipe";

const ROTULO_SITUACAO: Record<string, string> = { ferias: "Férias", afastado: "Afastado", emprestado: "Emprestado" };

/** Chave da OGS de uma equipe (mesma normalização do quadro). */
export const chaveOgs = (equipe: string | null | undefined) => chaveEquipe(equipe);

/** Mantém só dígitos e hífen/letras comuns de OGS e corta em 40; vazio vira null. */
export function normalizarOgs(valor: string | null | undefined): string | null {
  const v = (valor || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return v || null;
}

export const equipeTemOgs = (equipe: string) => !!equipe && equipe !== ROTULO_SEM_EQUIPE && !ehColunaDoRH(equipe);

/** Maior entre as datas (ISO) informadas; ignora vazias. */
export function maisRecente(...datas: (string | null | undefined)[]): string {
  return datas.filter((d): d is string => !!d).sort().pop() || "";
}

export function montarLinhasQuadroHoje(args: {
  pessoas: readonly PessoaHoje[];
  ogs: OgsPorEquipe;
  /** employee_id → data da última "Mudança rápida de equipe" no histórico. */
  ultimaMovHistorico?: Readonly<Record<string, string>>;
  /** employee_id → data_inicio da alocação temporária ativa. */
  ultimaMovAlocacao?: Readonly<Record<string, string>>;
}): LinhaQuadroHoje[] {
  const { pessoas, ogs, ultimaMovHistorico = {}, ultimaMovAlocacao = {} } = args;
  const linhas = pessoas
    .filter((p) => !estaDemitido(p.status))
    .map<LinhaQuadroHoje>((p) => {
      const equipe = p.equipe?.trim() || ROTULO_SEM_EQUIPE;
      const origem = p.situacao ? p.equipeOrigem?.trim() || "" : "";
      return {
        id: p.id,
        equipe,
        ogs: equipeTemOgs(equipe) ? ogs[chaveOgs(equipe)]?.ogs?.trim() || "" : "",
        matricula: p.matricula || "",
        nome: p.name || "",
        funcao: p.role || "",
        situacao: p.situacao ? ROTULO_SITUACAO[p.situacao] ?? p.situacao : "",
        origem,
        ultimaMov: maisRecente(ultimaMovHistorico[p.id], ultimaMovAlocacao[p.id]),
      };
    });
  return linhas.sort(compararLinhas);
}

const peso = (equipe: string) => {
  const k = chaveEquipe(equipe);
  if (k === chaveEquipe(ROTULO_SEM_EQUIPE) || k === SEM_EQUIPE) return 2;
  if (k === chaveEquipe(COLUNA_FERIAS) || k === chaveEquipe(COLUNA_AFASTADOS)) return 1;
  return 0;
};

/** Equipes A–Z; Férias/Afastados depois; Sem equipe por último. Dentro, por nome. */
export function compararLinhas(a: LinhaQuadroHoje, b: LinhaQuadroHoje) {
  return peso(a.equipe) - peso(b.equipe)
    || a.equipe.localeCompare(b.equipe, "pt-BR")
    || a.nome.localeCompare(b.nome, "pt-BR");
}

export type BlocoEquipe = { equipe: string; ogs: string; atualizadoEm: string | null; linhas: LinhaQuadroHoje[] };

export function agruparPorEquipe(linhas: readonly LinhaQuadroHoje[], ogs: OgsPorEquipe): BlocoEquipe[] {
  const mapa = new Map<string, BlocoEquipe>();
  for (const l of linhas) {
    const k = chaveEquipe(l.equipe);
    if (!mapa.has(k)) mapa.set(k, { equipe: l.equipe, ogs: l.ogs, atualizadoEm: ogs[chaveOgs(l.equipe)]?.atualizadoEm ?? null, linhas: [] });
    mapa.get(k)!.linhas.push(l);
  }
  return [...mapa.values()];
}

/** dd/mm/aaaa de "YYYY-MM-DD" ou ISO com hora; "" se vazio. */
export function dataBR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export const COLUNAS_EXPORTACAO = ["Equipe", "OGS", "Matrícula", "Nome", "Função", "Situação", "Equipe de origem", "Última movimentação"] as const;

export const celulasLinha = (l: LinhaQuadroHoje): string[] => [
  l.equipe, l.ogs || "-", l.matricula || "-", l.nome, l.funcao || "-", l.situacao || "Ativo", l.origem || "-", dataBR(l.ultimaMov) || "-",
];

const escCsv = (c: unknown) => `"${String(c ?? "").replace(/"/g, '""')}"`;

/** CSV (separador ;, BOM) — abre direto no Excel. */
export function gerarCsv(titulo: string, hojeISO: string, blocos: readonly BlocoEquipe[]): string {
  const linhas: string[][] = [[titulo], [`Data: ${dataBR(hojeISO)} (posição atual do Quadro Pessoas do WF Programador)`], [], [...COLUNAS_EXPORTACAO]];
  blocos.forEach((b) => b.linhas.forEach((l) => linhas.push(celulasLinha(l))));
  return "\uFEFF" + linhas.map((l) => l.map(escCsv).join(";")).join("\n");
}

export const escHtml = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML paisagem para imprimir/PDF: um bloco por equipe, OGS no título. */
export function gerarHtmlPdf(titulo: string, hojeISO: string, blocos: readonly BlocoEquipe[]): string {
  const total = blocos.reduce((n, b) => n + b.linhas.length, 0);
  const cab = ["Matrícula", "Nome", "Função", "Situação", "Equipe de origem", "Última mov."];
  const corpo = blocos.map((b) => `
    <h2>${escHtml(b.equipe)}${b.ogs ? ` — OGS ${escHtml(b.ogs)}` : ""} <span class="n">(${b.linhas.length})</span></h2>
    <table><tr>${cab.map((h) => `<th>${h}</th>`).join("")}</tr>${b.linhas.map((l) => `<tr><td>${escHtml(l.matricula || "-")}</td><td>${escHtml(l.nome)}</td><td>${escHtml(l.funcao || "-")}</td><td>${escHtml(l.situacao || "Ativo")}</td><td>${escHtml(l.origem || "-")}</td><td>${escHtml(dataBR(l.ultimaMov) || "-")}</td></tr>`).join("")}</table>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(titulo)}</title><style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:Arial,sans-serif;padding:12px;color:#333;font-size:10px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:15px}
    h2{font-size:12px;margin:14px 0 4px;color:#065f46;break-after:avoid}
    h2 .n{color:#64748b;font-weight:400}
    .meta{font-size:10px;color:#666;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:9px;break-inside:auto}
    tr{break-inside:avoid}
    th,td{border:1px solid #d1d5db;padding:3px 5px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>${escHtml(titulo)}</h1>
  <p class="meta"><strong>Data:</strong> ${dataBR(hojeISO)} | <strong>Total:</strong> ${total} pessoa(s) em ${blocos.length} equipe(s) | Posição atual do Quadro Pessoas (WF Programador)</p>
  ${corpo}</body></html>`;
}

/**
 * Equipes marcadas em Admin > Equipes ("Ocultar nas operações") saem do relatório, e também quem está em
 * Férias/Afastados/Emprestado vindo delas. "DEMITIDOS" (equipe-lixeira do cadastro) conta como oculta.
 */
export function filtrarEquipesOcultas(linhas: readonly LinhaQuadroHoje[], ocultas: ReadonlySet<string>): LinhaQuadroHoje[] {
  const oculta = (nome: string) => !!nome && (ocultas.has(nome.trim().toLocaleLowerCase("pt-BR")) || chaveEquipe(nome) === "demitidos");
  return linhas.filter((l) => !oculta(l.equipe) && !oculta(l.origem));
}

import { rotuloPendencia, type PendenciaQuadro } from "./quadroPendencias";

/** Categorias usadas no filtro do relatório (derivadas de tipo + payload; não existe coluna própria). */
export type CategoriaPendencia = "demitir" | "classificar" | "aumento" | "substituir" | "alocar" | "realocar" | "ferias" | "afastar" | "outros";

export const CATEGORIAS: { id: CategoriaPendencia; rotulo: string }[] = [
  { id: "demitir", rotulo: "Demitir" },
  { id: "classificar", rotulo: "Classificar" },
  { id: "aumento", rotulo: "Aumento salarial" },
  { id: "substituir", rotulo: "Substituir" },
  { id: "alocar", rotulo: "Alocar em equipe" },
  { id: "realocar", rotulo: "Realocar" },
  { id: "ferias", rotulo: "Dar férias" },
  { id: "afastar", rotulo: "Afastar" },
  { id: "outros", rotulo: "Outros" },
];

export const STATUS_ROTULO: Record<string, string> = {
  aberta: "Aberta", em_analise: "Em análise", aprovada: "Aprovada", reprovada: "Reprovada", cancelada: "Cancelada",
};
export const PRIORIDADE_ROTULO: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };

const TEXTO_PARA_CATEGORIA: Record<string, CategoriaPendencia> = {
  "alocar em equipe": "alocar", "realocar para outra equipe": "realocar", "dar férias": "ferias", "afastamento": "afastar",
};

export function categoriaPendencia(p: Pick<PendenciaQuadro, "tipo" | "payload">): CategoriaPendencia {
  switch (p.tipo) {
    case "demissao": return "demitir";
    case "classificacao": return "classificar";
    case "aumento_salarial": return "aumento";
    case "substituicao": return "substituir";
    default: {
      const sub = String(p.payload?.subtipo ?? "").toLowerCase();
      if (sub === "alocar" || sub === "realocar" || sub === "ferias" || sub === "afastar") return sub;
      return TEXTO_PARA_CATEGORIA[String(p.payload?.outro_tipo_solicitacao ?? "").trim().toLowerCase()] ?? "outros";
    }
  }
}

export const rotuloCategoria = (c: CategoriaPendencia) => CATEGORIAS.find((x) => x.id === c)?.rotulo ?? "Outros";

const TIPO_DEMISSAO: Record<string, string> = { sem_justa_causa: "Sem justa causa", justa_causa: "Justa causa", pedido_demissao: "Pedido de demissão", acordo: "Acordo", termino_contrato: "Término de contrato" };

/** Detalhe legível do que foi marcado (nova função, equipe, salário, tipo de demissão…). */
export function detalhePendencia(p: Pick<PendenciaQuadro, "tipo" | "payload">): string {
  const pl = p.payload || {};
  const s = (k: string) => String(pl[k] ?? "").trim();
  switch (p.tipo) {
    case "demissao": { const t = s("tipo_demissao"); return t ? (TIPO_DEMISSAO[t] ?? t.replace(/_/g, " ")) : ""; }
    case "classificacao": return s("classificacao_nova") ? `Nova função: ${s("classificacao_nova")}` : "";
    case "aumento_salarial": { const v = Number(pl.novo_salario); return v > 0 ? `Novo salário: ${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""; }
    case "substituicao": return s("substituto_sugerido") ? `Substituto sugerido: ${s("substituto_sugerido")}` : "";
    default: {
      const r = rotuloPendencia(p);
      const cat = categoriaPendencia(p);
      if (cat === "alocar" || cat === "realocar") return r;
      return s("outro_tipo_solicitacao") || "";
    }
  }
}

export type FiltrosPendencias = {
  categorias: CategoriaPendencia[]; // vazio = todas
  status: string[]; // vazio = todos
  equipe: string; // "TODAS" | "__sem__" | nome
  funcao: string; // "TODAS" | nome
  prioridade: string; // "TODAS" | valor
  de: string; // yyyy-mm-dd ou ""
  ate: string;
};

export type LinhaPendencia = { p: PendenciaQuadro; emp: { name: string; role: string | null; equipe: string | null; status: string | null } | undefined };

const dia = (iso?: string) => (iso || "").slice(0, 10);

export function filtrarPendencias(linhas: LinhaPendencia[], f: FiltrosPendencias): LinhaPendencia[] {
  return linhas.filter(({ p, emp }) => {
    if (f.categorias.length && !f.categorias.includes(categoriaPendencia(p))) return false;
    if (f.status.length && !f.status.includes(p.status)) return false;
    if (f.prioridade !== "TODAS" && p.prioridade !== f.prioridade) return false;
    const eq = (emp?.equipe || "").trim();
    if (f.equipe === "__sem__" ? eq !== "" : f.equipe !== "TODAS" && eq !== f.equipe) return false;
    if (f.funcao !== "TODAS" && (emp?.role || "").trim() !== f.funcao) return false;
    const d = dia(p.created_at);
    if (f.de && (!d || d < f.de)) return false;
    if (f.ate && (!d || d > f.ate)) return false;
    return true;
  });
}

export const fmtData = (d?: string | null) => {
  const s = dia(d || ""); if (!s) return "-";
  const [y, m, dd] = s.split("-"); return `${dd}/${m}/${y}`;
};

export const escHtml = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

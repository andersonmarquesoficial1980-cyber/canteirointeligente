/**
 * Alocação temporária no Quadro Pessoas — lógica pura, sem I/O.
 * employees.equipe segue sendo a equipe de ORIGEM. O card aparece na coluna onde a pessoa está hoje:
 *   férias vigentes (RH) > afastado (RH) > alocação temporária ativa > equipe do cadastro.
 */
import { chaveEquipe, estaDemitido, type PessoaQuadro } from "@/lib/quadroEquipes";

export const COLUNA_FERIAS = "FÉRIAS";
export const COLUNA_AFASTADOS = "AFASTADOS";
const VALIDAS_FERIAS = ["programada", "aguardando_confirmacao", "confirmada"] as const;

export type Situacao = "ferias" | "afastado" | "emprestado";

export type AlocacaoAtiva = {
  id: string;
  employee_id: string;
  equipe_origem: string;
  equipe_destino: string;
  data_inicio: string;
  data_fim_prevista: string | null;
};

export type FeriasLinha = { employee_id: string; data_inicio: string; data_fim: string; workflow_status: string | null };

export type PessoaProjetada = PessoaQuadro & {
  situacao?: Situacao;
  /** Equipe do cadastro (origem), quando o card está em outra coluna. */
  equipeOrigem?: string | null;
  alocacaoId?: string;
  fimPrevisto?: string | null;
  aguardandoRetorno?: boolean;
};

/** IDs com férias vigentes em `hoje` (YYYY-MM-DD). Ignora "nao_confirmada". */
export function feriasVigentes(linhas: readonly FeriasLinha[], hoje: string): Set<string> {
  const ids = new Set<string>();
  for (const l of linhas) {
    if (!l.employee_id || !l.data_inicio || !l.data_fim) continue;
    if (l.workflow_status && !(VALIDAS_FERIAS as readonly string[]).includes(l.workflow_status)) continue;
    if (l.data_inicio <= hoje && l.data_fim >= hoje) ids.add(l.employee_id);
  }
  return ids;
}

/** Extrai a equipe de origem de "Mudança rápida de equipe: A → B" (null se origem for "Sem equipe"). */
export function origemDoHistorico(descricao: string | null | undefined): string | null {
  const m = /:\s*(.+?)\s*→\s*(.+)$/.exec(descricao || "");
  const origem = m?.[1]?.trim();
  return origem && chaveEquipe(origem) !== "sem equipe" ? origem : null;
}

export const ehColunaDoRH = (nomeOuChave: string | null | undefined) => {
  const k = chaveEquipe(nomeOuChave);
  return k === chaveEquipe(COLUNA_FERIAS) || k === chaveEquipe(COLUNA_AFASTADOS);
};

const ehAfastado = (status?: string | null) => chaveEquipe(status) === "afastado";

type Entrada<T> = {
  funcionarios: readonly T[];
  alocacoes: readonly AlocacaoAtiva[];
  ferias: ReadonlySet<string>;
  /** Origem inferida (histórico) de quem já está na coluna AFASTADOS por cadastro. */
  origemAfastados?: Readonly<Record<string, string>>;
  hoje: string;
};

/** Devolve cada funcionário já posicionado na coluna efetiva (campo `equipe`), preservando a origem. */
export function projetarPessoas<T extends PessoaQuadro>({ funcionarios, alocacoes, ferias, origemAfastados = {}, hoje }: Entrada<T>): (T & PessoaProjetada)[] {
  const aloc = new Map(alocacoes.map((a) => [a.employee_id, a]));
  return funcionarios.map((f) => {
    if (estaDemitido(f.status)) return f;
    const origemCad = f.equipe?.trim() || null;
    if (ferias.has(f.id)) return { ...f, equipe: COLUNA_FERIAS, situacao: "ferias" as const, equipeOrigem: origemCad };
    if (ehAfastado(f.status)) {
      const jaNaColuna = chaveEquipe(origemCad) === chaveEquipe(COLUNA_AFASTADOS);
      const origem = jaNaColuna ? origemAfastados[f.id] ?? null : origemCad;
      return { ...f, equipe: COLUNA_AFASTADOS, situacao: "afastado" as const, equipeOrigem: origem };
    }
    const a = aloc.get(f.id);
    if (a && a.data_inicio <= hoje) {
      return {
        ...f, equipe: a.equipe_destino, situacao: "emprestado" as const, equipeOrigem: a.equipe_origem, alocacaoId: a.id,
        fimPrevisto: a.data_fim_prevista, aguardandoRetorno: !!a.data_fim_prevista && a.data_fim_prevista < hoje,
      };
    }
    return f;
  });
}

export type ResumoEquipe = { nominal: number; presentes: number; fora: { id: string; name: string; destino: string; situacao: Situacao }[] };

/**
 * Efetivo de uma equipe real: nominal = quem pertence a ela (origem), presentes = quem está na coluna
 * e pertence a ela, fora = quem pertence a ela mas está em outra coluna (férias, afastado, emprestado).
 * Retorna null se ninguém está fora (nada a destacar).
 */
export function resumoEquipe(chave: string, projetadas: readonly PessoaProjetada[]): ResumoEquipe | null {
  const k = chaveEquipe(chave);
  if (!k || ehColunaDoRH(chave)) return null;
  const fora: ResumoEquipe["fora"] = [];
  let nominal = 0;
  for (const p of projetadas) {
    if (estaDemitido(p.status)) continue;
    const origem = chaveEquipe(p.situacao ? p.equipeOrigem : p.equipe);
    if (origem !== k) continue;
    nominal++;
    if (p.situacao) fora.push({ id: p.id, name: p.name, destino: p.equipe || "", situacao: p.situacao });
  }
  if (fora.length === 0) return null;
  fora.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  return { nominal, presentes: nominal - fora.length, fora };
}

export const rotuloSituacao = (s: Situacao) => (s === "ferias" ? "Férias" : s === "afastado" ? "Afastado" : "Emprestado");

export const formatarDataBR = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

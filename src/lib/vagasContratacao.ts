/** Vagas de contratação por equipe — lógica pura, sem I/O. Uma linha = uma posição. */
import { chaveEquipe } from "@/lib/quadroEquipes";

export type PrioridadeVaga = "baixa" | "normal" | "alta" | "urgente";
export type MotivoVaga = "reposicao" | "aumento_efetivo";
export type StatusVaga = "aberta" | "em_selecao" | "contratada" | "cancelada";

export type Vaga = {
  id: string;
  company_id: string;
  equipe: string;
  funcao_id: string | null;
  funcao: string;
  observacao: string | null;
  prioridade: PrioridadeVaga;
  motivo: MotivoVaga;
  data_prevista: string | null;
  status: StatusVaga;
  employee_id: string | null;
  motivo_cancelamento: string | null;
  fechada_em: string | null;
  created_at: string;
};

export const PRIORIDADES: { valor: PrioridadeVaga; rotulo: string }[] = [
  { valor: "urgente", rotulo: "Urgente" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "normal", rotulo: "Normal" },
  { valor: "baixa", rotulo: "Baixa" },
];
export const MOTIVOS: { valor: MotivoVaga; rotulo: string }[] = [
  { valor: "aumento_efetivo", rotulo: "Aumento de efetivo" },
  { valor: "reposicao", rotulo: "Reposição" },
];
export const STATUS_VAGA: { valor: StatusVaga; rotulo: string }[] = [
  { valor: "aberta", rotulo: "Aberta" },
  { valor: "em_selecao", rotulo: "Em seleção" },
  { valor: "contratada", rotulo: "Contratada" },
  { valor: "cancelada", rotulo: "Cancelada" },
];

export const rotuloPrioridade = (v: string) => PRIORIDADES.find((p) => p.valor === v)?.rotulo ?? v;
export const rotuloMotivo = (v: string) => MOTIVOS.find((p) => p.valor === v)?.rotulo ?? v;
export const rotuloStatusVaga = (v: string) => STATUS_VAGA.find((p) => p.valor === v)?.rotulo ?? v;

export const vagaEstaAberta = (v: Pick<Vaga, "status">) => v.status === "aberta" || v.status === "em_selecao";

const PESO: Record<PrioridadeVaga, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/** Urgente primeiro, depois a mais antiga. */
export const ordenarVagas = (vagas: readonly Vaga[]): Vaga[] =>
  [...vagas].sort((a, b) => (PESO[a.prioridade] ?? 2) - (PESO[b.prioridade] ?? 2) || a.created_at.localeCompare(b.created_at));

/** Vagas abertas agrupadas pela equipe normalizada (sem acento/caixa), prontas para virar cartões da coluna. */
export function vagasAbertasPorEquipe(vagas: readonly Vaga[]): Map<string, Vaga[]> {
  const mapa = new Map<string, Vaga[]>();
  for (const v of ordenarVagas(vagas.filter(vagaEstaAberta))) {
    const k = chaveEquipe(v.equipe);
    mapa.set(k, [...(mapa.get(k) ?? []), v]);
  }
  return mapa;
}

/** Nomes distintos de equipes que têm vaga aberta (para a coluna existir mesmo sem funcionários). */
export function equipesComVagaAberta(vagas: readonly Vaga[]): string[] {
  const vistos = new Map<string, string>();
  for (const v of vagas) if (vagaEstaAberta(v) && !vistos.has(chaveEquipe(v.equipe))) vistos.set(chaveEquipe(v.equipe), v.equipe.trim());
  return [...vistos.values()];
}

export type LinhaResumo = { equipe: string; funcao: string; total: number };

/** Totais por equipe e função (somente abertas), ordenados por equipe e função. */
export function resumoVagas(vagas: readonly Vaga[]): { total: number; linhas: LinhaResumo[] } {
  const mapa = new Map<string, LinhaResumo>();
  let total = 0;
  for (const v of vagas) {
    if (!vagaEstaAberta(v)) continue;
    total++;
    const k = `${chaveEquipe(v.equipe)}|${chaveEquipe(v.funcao)}`;
    const atual = mapa.get(k);
    if (atual) atual.total++;
    else mapa.set(k, { equipe: v.equipe, funcao: v.funcao, total: 1 });
  }
  const linhas = [...mapa.values()].sort((a, b) => a.equipe.localeCompare(b.equipe, "pt-BR") || a.funcao.localeCompare(b.funcao, "pt-BR"));
  return { total, linhas };
}

type PessoaMin = { id: string; name: string; role: string | null; equipe: string | null; status?: string | null };

/** Candidatos a preencher a vaga: ativos (sem demitido), a mesma função primeiro, depois quem está sem equipe. */
export function candidatosParaVaga<T extends PessoaMin>(pessoas: readonly T[], vaga: Pick<Vaga, "funcao" | "equipe">): T[] {
  const demitido = (s?: string | null) => /^demiti|^demiss/.test(chaveEquipe(s).replace(/[_\s]/g, ""));
  const pontos = (p: T) =>
    (chaveEquipe(p.role) === chaveEquipe(vaga.funcao) ? 0 : 4) + (p.equipe?.trim() ? (chaveEquipe(p.equipe) === chaveEquipe(vaga.equipe) ? 0 : 2) : 0);
  return pessoas
    .filter((p) => !demitido(p.status))
    .sort((a, b) => pontos(a) - pontos(b) || a.name.localeCompare(b.name, "pt-BR"));
}

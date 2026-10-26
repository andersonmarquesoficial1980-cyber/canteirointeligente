/**
 * Pendências no Quadro de Equipes. Reaproveita rh_pendencias_funcionario (mesma fila da Gestão de Pessoas):
 * só REGISTRA o que vai acontecer com o funcionário; não altera cadastro, status nem equipe.
 */

export type TipoPendenciaDb = "classificacao" | "aumento_salarial" | "demissao" | "substituicao" | "outros";
export type PrioridadePendencia = "baixa" | "normal" | "alta" | "urgente";

export type PendenciaQuadro = {
  id: string;
  employee_id: string;
  tipo: TipoPendenciaDb;
  status: "aberta" | "em_analise" | "aprovada" | "reprovada" | "cancelada";
  prioridade: PrioridadePendencia;
  justificativa: string;
  data_efetiva: string | null;
  payload: Record<string, unknown> | null;
  solicitado_por_nome?: string | null;
  created_at?: string;
};

export const STATUS_ABERTOS = ["aberta", "em_analise"] as const;
export const estaAberta = (p: Pick<PendenciaQuadro, "status">) => (STATUS_ABERTOS as readonly string[]).includes(p.status);

/** O que o gestor escolhe no quadro → como é gravado na tabela existente (sem migration). */
export type DestinoRapido = "demitir" | "alocar" | "ferias" | "afastar" | "substituir" | "outro";

export const DESTINOS_RAPIDOS: { id: DestinoRapido; rotulo: string; dica: string }[] = [
  { id: "demitir", rotulo: "Demitir", dica: "Desligamento do funcionário" },
  { id: "alocar", rotulo: "Alocar em equipe", dica: "Definir em qual equipe vai trabalhar" },
  { id: "ferias", rotulo: "Dar férias", dica: "Programar férias" },
  { id: "afastar", rotulo: "Afastar", dica: "Afastamento (atestado, INSS, licença...)" },
  { id: "substituir", rotulo: "Substituir", dica: "Substituição por outro funcionário" },
  { id: "outro", rotulo: "Outro", dica: "Descreva o que vai acontecer" },
];

export type FormPendenciaRapida = {
  destino: DestinoRapido;
  justificativa: string;
  prioridade: PrioridadePendencia;
  dataEfetiva: string; // yyyy-mm-dd ou ""
  tipoDemissao?: string;
  equipeSugerida?: string;
  substitutoSugerido?: string;
  outroTexto?: string;
};

export type NovaPendencia = {
  tipo: TipoPendenciaDb;
  prioridade: PrioridadePendencia;
  justificativa: string;
  data_efetiva: string | null;
  payload: Record<string, unknown>;
};

const ROTULO_OUTROS: Record<string, string> = { alocar: "Alocar em equipe", ferias: "Dar férias", afastar: "Afastamento" };

/** Valida e converte o formulário rápido no registro a inserir. Lança Error com mensagem em português. */
export function montarNovaPendencia(f: FormPendenciaRapida): NovaPendencia {
  const justificativa = f.justificativa.trim();
  if (justificativa.length < 3) throw new Error("Informe o motivo (a justificativa é obrigatória)");
  if (f.dataEfetiva && !/^\d{4}-\d{2}-\d{2}$/.test(f.dataEfetiva)) throw new Error("Data prevista inválida");
  const base = { prioridade: f.prioridade, justificativa, data_efetiva: f.dataEfetiva || null, origem: "quadro_equipes" };

  if (f.destino === "demitir") {
    return { tipo: "demissao", prioridade: f.prioridade, justificativa, data_efetiva: base.data_efetiva,
      payload: { origem: base.origem, tipo_demissao: f.tipoDemissao || "sem_justa_causa" } };
  }
  if (f.destino === "substituir") {
    return { tipo: "substituicao", prioridade: f.prioridade, justificativa, data_efetiva: base.data_efetiva,
      payload: { origem: base.origem, substituto_sugerido: f.substitutoSugerido?.trim().toUpperCase() || null } };
  }
  if (f.destino === "outro") {
    const texto = f.outroTexto?.trim();
    if (!texto) throw new Error("Descreva o que vai acontecer com o funcionário");
    return { tipo: "outros", prioridade: f.prioridade, justificativa, data_efetiva: base.data_efetiva,
      payload: { origem: base.origem, outro_tipo_solicitacao: texto } };
  }
  const payload: Record<string, unknown> = { origem: base.origem, outro_tipo_solicitacao: ROTULO_OUTROS[f.destino] };
  if (f.destino === "alocar") {
    const equipe = f.equipeSugerida?.trim();
    if (!equipe) throw new Error("Escolha a equipe sugerida");
    payload.equipe_sugerida = equipe;
  }
  return { tipo: "outros", prioridade: f.prioridade, justificativa, data_efetiva: base.data_efetiva, payload };
}

/** Texto curto mostrado no card. */
export function rotuloPendencia(p: Pick<PendenciaQuadro, "tipo" | "payload">): string {
  switch (p.tipo) {
    case "demissao": return "Demitir";
    case "substituicao": return "Substituir";
    case "classificacao": return "Reclassificar";
    case "aumento_salarial": return "Aumento salarial";
    default: {
      const livre = String(p.payload?.outro_tipo_solicitacao ?? "").trim();
      const equipe = String(p.payload?.equipe_sugerida ?? "").trim();
      if (livre === ROTULO_OUTROS.alocar && equipe) return `Alocar → ${equipe}`;
      return livre || "Pendência";
    }
  }
}

export type TomPendencia = "critico" | "atencao" | "info";
const PESO_PRIORIDADE: Record<PrioridadePendencia, number> = { baixa: 0, normal: 1, alta: 2, urgente: 3 };

export const tomPendencia = (p: Pick<PendenciaQuadro, "tipo" | "prioridade">): TomPendencia =>
  p.tipo === "demissao" || p.prioridade === "urgente" ? "critico" : p.prioridade === "alta" ? "atencao" : "info";

/** Abertas de cada funcionário, mais urgentes primeiro e depois as mais antigas. Ignora aprovadas/reprovadas/canceladas. */
export function agruparAbertasPorFuncionario(lista: readonly PendenciaQuadro[]): Record<string, PendenciaQuadro[]> {
  const mapa: Record<string, PendenciaQuadro[]> = {};
  for (const p of lista) if (estaAberta(p)) (mapa[p.employee_id] ||= []).push(p);
  for (const itens of Object.values(mapa)) {
    itens.sort((a, b) =>
      (PESO_PRIORIDADE[b.prioridade] - PESO_PRIORIDADE[a.prioridade]) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  }
  return mapa;
}

/** Dica de tela: funcionário sem equipe e sem nenhuma pendência aberta não tem destino definido. */
export const semDestino = (equipe: string | null | undefined, abertas: readonly PendenciaQuadro[] | undefined) =>
  !equipe?.trim() && !(abertas && abertas.length > 0);

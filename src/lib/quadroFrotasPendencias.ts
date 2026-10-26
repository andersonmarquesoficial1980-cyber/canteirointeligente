/**
 * Pendências de equipamento no Quadro de Equipes (tabela equip_pendencias). Só REGISTRA a decisão;
 * não altera status nem setor do equipamento. Convertidas para o formato do selo do quadro de pessoas.
 */
import type { PendenciaQuadro, PrioridadePendencia } from "@/lib/quadroPendencias";

export type TipoPendenciaEquip = "devolver" | "manutencao" | "alocar" | "transferir" | "baixar" | "substituir" | "outros";

export const TIPOS_EQUIP: { id: TipoPendenciaEquip; rotulo: string; dica: string }[] = [
  { id: "devolver", rotulo: "Devolver", dica: "Devolução ao locador / fim de contrato" },
  { id: "manutencao", rotulo: "Enviar para manutenção", dica: "Parar para manutenção ou reparo" },
  { id: "alocar", rotulo: "Alocar em equipe", dica: "Definir em qual equipe vai trabalhar" },
  { id: "transferir", rotulo: "Transferir de obra", dica: "Mudar para outra obra/equipe" },
  { id: "baixar", rotulo: "Baixar / vender", dica: "Baixa patrimonial ou venda" },
  { id: "substituir", rotulo: "Substituir", dica: "Trocar por outro equipamento" },
  { id: "outros", rotulo: "Outro", dica: "Descreva o que vai acontecer" },
];

const ROTULO = Object.fromEntries(TIPOS_EQUIP.map((t) => [t.id, t.rotulo])) as Record<TipoPendenciaEquip, string>;
const CURTO: Record<TipoPendenciaEquip, string> = {
  devolver: "Devolver", manutencao: "Manutenção", alocar: "Alocar", transferir: "Transferir", baixar: "Baixar", substituir: "Substituir", outros: "Pendência",
};

export type LinhaPendenciaEquip = {
  id: string;
  equipment_id: string;
  tipo: TipoPendenciaEquip;
  status: PendenciaQuadro["status"];
  prioridade: PrioridadePendencia;
  justificativa: string;
  data_efetiva: string | null;
  payload: Record<string, unknown> | null;
  solicitado_por_nome?: string | null;
  created_at?: string;
};

export type FormPendenciaEquip = {
  tipo: TipoPendenciaEquip;
  justificativa: string;
  prioridade: PrioridadePendencia;
  dataEfetiva: string;
  equipeSugerida?: string;
  substituto?: string;
  outroTexto?: string;
};

export type NovaPendenciaEquip = {
  tipo: TipoPendenciaEquip;
  prioridade: PrioridadePendencia;
  justificativa: string;
  data_efetiva: string | null;
  payload: Record<string, unknown>;
};

/** Valida o formulário e devolve o registro. Lança Error com mensagem em português. */
export function montarNovaPendenciaEquip(f: FormPendenciaEquip): NovaPendenciaEquip {
  const justificativa = f.justificativa.trim();
  if (justificativa.length < 3) throw new Error("Informe o motivo (a justificativa é obrigatória)");
  if (f.dataEfetiva && !/^\d{4}-\d{2}-\d{2}$/.test(f.dataEfetiva)) throw new Error("Data prevista inválida");
  const payload: Record<string, unknown> = { origem: "quadro_equipes" };
  if (f.tipo === "alocar" || f.tipo === "transferir") {
    const equipe = f.equipeSugerida?.trim();
    if (!equipe) throw new Error("Escolha a equipe de destino");
    payload.equipe_sugerida = equipe;
  }
  if (f.tipo === "substituir") payload.substituto_sugerido = f.substituto?.trim().toUpperCase() || null;
  if (f.tipo === "outros") {
    const texto = f.outroTexto?.trim();
    if (!texto) throw new Error("Descreva o que vai acontecer com o equipamento");
    payload.descricao = texto;
  }
  return { tipo: f.tipo, prioridade: f.prioridade, justificativa, data_efetiva: f.dataEfetiva || null, payload };
}

export function rotuloPendenciaEquip(p: Pick<LinhaPendenciaEquip, "tipo" | "payload">): string {
  const equipe = String(p.payload?.equipe_sugerida ?? "").trim();
  if ((p.tipo === "alocar" || p.tipo === "transferir") && equipe) return `${CURTO[p.tipo]} → ${equipe}`;
  if (p.tipo === "outros") return String(p.payload?.descricao ?? "").trim() || CURTO.outros;
  return CURTO[p.tipo] ?? "Pendência";
}

export const rotuloCompletoEquip = (tipo: TipoPendenciaEquip) => ROTULO[tipo] ?? "Pendência";

/**
 * Converte para o formato do selo do quadro (tipo 'outros' + rótulo no payload). O tom do selo
 * vem da prioridade; 'baixar' e 'devolver' são tratados como de atenção mínima (laranja) mesmo se normais.
 */
export function paraPendenciaQuadro(l: LinhaPendenciaEquip): PendenciaQuadro {
  const prioridade: PrioridadePendencia =
    (l.tipo === "baixar" || l.tipo === "devolver") && (l.prioridade === "baixa" || l.prioridade === "normal") ? "alta" : l.prioridade;
  return {
    id: l.id,
    employee_id: l.equipment_id, // chave do quadro: id do card
    tipo: "outros",
    status: l.status,
    prioridade,
    justificativa: l.justificativa,
    data_efetiva: l.data_efetiva,
    payload: { outro_tipo_solicitacao: rotuloPendenciaEquip(l) },
    solicitado_por_nome: l.solicitado_por_nome,
    created_at: l.created_at,
  };
}

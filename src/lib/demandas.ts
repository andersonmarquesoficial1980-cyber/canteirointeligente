export type TipoDemanda =
  | "manutencao"
  | "transporte"
  | "troca_funcionario"
  | "acessorio"
  | "rh"
  | "reclamacao"
  | "sugestao"
  | "comunicado"
  | "geral";

export type SetorDestinatario =
  | "manutencao"
  | "programador"
  | "rh"
  | "engenharia"
  | "admin";

export type UrgenciaDemanda = "baixa" | "normal" | "alta" | "urgente";

export const TIPOS_DEMANDA: Array<{ value: TipoDemanda; icon: string; label: string }> = [
  { value: "manutencao", icon: "🔧", label: "Manutenção de Equipamento" },
  { value: "transporte", icon: "🚛", label: "Transporte de Equipamento" },
  { value: "troca_funcionario", icon: "👷", label: "Troca / Reforço de Funcionário" },
  { value: "acessorio", icon: "📦", label: "Acessório / Material" },
  { value: "rh", icon: "📋", label: "Dúvida RH (salário, VT, benefício)" },
  { value: "reclamacao", icon: "⚠️", label: "Reclamação" },
  { value: "sugestao", icon: "💡", label: "Sugestão" },
  { value: "comunicado", icon: "📢", label: "Comunicado / Engenharia" },
  { value: "geral", icon: "📝", label: "Geral" },
];

export const SETORES_DESTINATARIOS: Array<{ value: SetorDestinatario; label: string }> = [
  { value: "manutencao", label: "Manutenção" },
  { value: "programador", label: "Programador de Obras" },
  { value: "rh", label: "RH" },
  { value: "engenharia", label: "Engenharia" },
  { value: "admin", label: "Administração" },
];

export const URGENCIAS: Array<{ value: UrgenciaDemanda; label: string; badgeClass: string }> = [
  { value: "baixa", label: "Baixa", badgeClass: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "normal", label: "Normal", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "alta", label: "Alta", badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "urgente", label: "Urgente", badgeClass: "bg-red-100 text-red-700 border-red-200" },
];

export const URGENCIA_ORDEM: Record<UrgenciaDemanda, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
};

export function getTipoMeta(tipo?: string | null) {
  return TIPOS_DEMANDA.find((item) => item.value === tipo) ?? { value: "geral", icon: "📝", label: "Geral" };
}

export function getSetorLabel(setor?: string | null) {
  return SETORES_DESTINATARIOS.find((item) => item.value === setor)?.label ?? "Não definido";
}

export function getUrgenciaMeta(urgencia?: string | null) {
  return URGENCIAS.find((item) => item.value === urgencia) ?? URGENCIAS[1];
}

export function getStatusLabel(status?: string | null) {
  if (status === "pendente") return "Aberta";
  if (status === "em_execucao") return "Em andamento";
  if (status === "concluida") return "Concluída";
  if (status === "cancelada") return "Cancelada";
  if (status === "aberta") return "Aberta";
  if (status === "aceita") return "Em andamento";
  return status || "Pendente";
}

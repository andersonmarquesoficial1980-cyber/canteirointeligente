export const STATUS_PAINEL_OPTIONS = ["OPERACIONAL", "MANUTENÇÃO", "INOPERANTE", "DEVOLVER", "DEVOLVIDO"] as const;
export type StatusPainel = (typeof STATUS_PAINEL_OPTIONS)[number];

const STATUS_PAINEL_TO_DB: Record<StatusPainel, string> = {
  OPERACIONAL: "ativo",
  "MANUTENÇÃO": "em_manutencao",
  INOPERANTE: "inativo",
  DEVOLVER: "devolver",
  DEVOLVIDO: "devolvido",
};

export function painelStatusToDb(statusPainel: StatusPainel): string {
  return STATUS_PAINEL_TO_DB[statusPainel];
}

export function dbStatusToPainel(statusDb?: string | null): StatusPainel {
  const s = (statusDb || "").toLowerCase();
  if (s === "em_manutencao" || s.includes("manut")) return "MANUTENÇÃO";
  if (s === "inativo" || s.includes("inoperante")) return "INOPERANTE";
  if (s === "devolvido") return "DEVOLVIDO";
  if (s === "devolver" || s === "disposicao") return "DEVOLVER";
  return "OPERACIONAL";
}

/** Quadro (Kanban) de equipes da Gestão de Frotas — adaptação de equipamentos para o quadro compartilhado. Sem I/O. */
import { SEM_EQUIPE, chaveEquipe, type PessoaQuadro } from "@/lib/quadroEquipes";

/** Status aceitos pelo RPC `programador_aplicar_lote` para equipamentos. */
const STATUS_RPC = ["ativo", "em_manutencao", "inoperante", "inativo", "devolver", "devolvido", "diaria", "disposicao"] as const;

export type EquipamentoQuadro = {
  id: string;
  frota: string | null;
  placa?: string | null;
  tipo?: string | null;
  setor?: string | null;
  status?: string | null;
  condicao?: string | null;
  categoria?: string | null;
  valor_mensal?: number | string | null;
  company_id?: string | null;
};

const semAcento = (v?: string | null) => (v || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Status canônico do banco. 'operando' (legado aceito no diário) equivale a 'ativo'. Retorna null se não reconhecido. */
export function statusCanonicoEquipamento(status?: string | null): string | null {
  const s = semAcento(status).replace(/\s+/g, "_");
  if (s === "operando") return "ativo";
  return (STATUS_RPC as readonly string[]).includes(s) ? s : null;
}

export const estaDevolvido = (status?: string | null) => semAcento(status) === "devolvido";

/** Equipamento no formato do quadro: frota = título, placa = linha de matrícula, tipo = "função". */
export function equipamentoParaCard<T extends EquipamentoQuadro>(e: T): PessoaQuadro & { equip: T } {
  return {
    id: e.id,
    name: (e.frota || e.placa || "SEM FROTA").trim(),
    matricula: e.placa?.trim() || null,
    role: e.tipo?.trim() || null,
    equipe: e.setor?.trim() || null,
    status: e.status ?? null,
    company_id: e.company_id ?? null,
    equip: e,
  };
}

export type MovimentoEquipamento = { id: string; setor: string | null; status: string; responsavel_destino: null };

/**
 * Valida e prepara o item do RPC. Como o RPC regrava o status, só segue quem já tem status canônico:
 * nada é "normalizado" escondido (ex.: NULL ou texto livre) — o usuário ajusta na ficha.
 */
export function prepararMovimentoEquipamento(e: EquipamentoQuadro, destino: string, companyId: string | null): MovimentoEquipamento {
  if (!companyId || e.company_id !== companyId) throw new Error("Equipamento fora da empresa atual");
  if (estaDevolvido(e.status)) throw new Error("Equipamento devolvido não pode ser movido de equipe");
  const status = statusCanonicoEquipamento(e.status);
  if (!status) throw new Error("Status do equipamento fora do padrão; ajuste o status na ficha antes de mover");
  const setor = destino === SEM_EQUIPE ? null : destino.trim() || null;
  if (chaveEquipe(setor) === chaveEquipe(e.setor)) throw new Error("O equipamento já está nesta equipe");
  return { id: e.id, setor, status, responsavel_destino: null };
}

export type BadgeStatus = { label: string; bg: string; text: string };

/** Selo do card: sem selo para operacional; destaque para manutenção/inoperante/etc. */
export function badgeStatusEquipamento(status?: string | null): BadgeStatus | null {
  const s = statusCanonicoEquipamento(status);
  switch (s) {
    case "em_manutencao": return { label: "🔧 Manutenção", bg: "#ffedd5", text: "#9a3412" };
    case "inativo":
    case "inoperante": return { label: "🚫 Inoperante", bg: "#fee2e2", text: "#991b1b" };
    case "devolver":
    case "disposicao": return { label: "↩ Devolver", bg: "#e2e8f0", text: "#334155" };
    case "diaria": return { label: "Diária", bg: "#e0f2fe", text: "#075985" };
    case "ativo": return null;
    default: return { label: "Status a ajustar", bg: "#fef9c3", text: "#854d0e" };
  }
}

export const ehTerceiro = (e: EquipamentoQuadro) =>
  semAcento(e.condicao) === "terceiro" || semAcento(e.categoria) === "locado";

/** Custo mensal de locados (próprios não entram: o valor mensal só é cadastrado para terceiros). */
export function custoMensalEquipamento(e: EquipamentoQuadro): number {
  if (!ehTerceiro(e)) return 0;
  const v = Number(e.valor_mensal);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

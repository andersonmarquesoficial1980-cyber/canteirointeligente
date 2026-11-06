import { supabase } from "@/integrations/supabase/client";

/** Apontamento de produção: vibroacabadora (t) e fresadora (m). Tabelas novas ainda fora dos tipos gerados. */
const db = supabase as any;

export type TipoProducao = "vibroacabadora" | "fresadora";
export type TurnoProducao = "diurno" | "noturno";

export interface LinhaProducao {
  equipamento_id: string; frota: string; ogs_number: string; data: string; turno: TurnoProducao;
  tipo: TipoProducao; valor: number | null; unidade: "t" | "m"; fonte: "apontamento" | "diario";
  lancado: boolean; apontamento_id: string | null;
}

export const MAX_TONELADAS = 5000;

/** "1.234,5" / "1234,5" / "1234.5" → número; vazio ou inválido → null. */
export function parseNumeroBR(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  let s = texto.trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Mensagem de erro (PT) ou null se válido. Zero é aceito (dia trabalhado sem descarga). */
export function validarToneladas(texto: string): string | null {
  const n = parseNumeroBR(texto);
  if (n === null) return "Informe as toneladas descarregadas (ex.: 312,45).";
  if (n < 0) return "As toneladas não podem ser negativas.";
  if (n > MAX_TONELADAS) return `Valor acima de ${MAX_TONELADAS.toLocaleString("pt-BR")} t por equipamento/turno. Confira o lançamento.`;
  return null;
}

export const fmtNumero = (n: number | null | undefined, casas = 2): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "Sem dados"
    : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export interface ResumoProducao {
  toneladas: number; metros: number; vibroPendentes: number; fresaPendentes: number; vibroLancados: number; fresaLancados: number;
}

/** Totais só somam o que foi lançado; pendente é contado à parte, nunca vira zero. */
export function resumirProducao(linhas: LinhaProducao[]): ResumoProducao {
  const r: ResumoProducao = { toneladas: 0, metros: 0, vibroPendentes: 0, fresaPendentes: 0, vibroLancados: 0, fresaLancados: 0 };
  for (const l of linhas) {
    if (l.tipo === "vibroacabadora") {
      if (l.lancado && l.valor !== null) { r.toneladas += Number(l.valor); r.vibroLancados++; } else r.vibroPendentes++;
    } else {
      if (l.lancado && l.valor !== null) { r.metros += Number(l.valor); r.fresaLancados++; } else r.fresaPendentes++;
    }
  }
  r.toneladas = Math.round(r.toneladas * 100) / 100;
  r.metros = Math.round(r.metros * 100) / 100;
  return r;
}

export async function listarProducao(p: { companyId: string; de: string; ate: string; ogs?: string; equipamentoId?: string }): Promise<LinhaProducao[]> {
  const { data, error } = await db.rpc("equip_producao_periodo", {
    p_company_id: p.companyId, p_inicio: p.de, p_fim: p.ate, p_ogs: p.ogs || null, p_equipamento_id: p.equipamentoId || null,
  });
  if (error) throw error;
  return ((data || []) as any[]).map(l => ({ ...l, valor: l.valor === null ? null : Number(l.valor) })) as LinhaProducao[];
}

export async function salvarToneladas(p: {
  companyId: string; userId: string; equipamentoId: string; ogs: string; data: string; turno: TurnoProducao;
  toneladas: number; observacao?: string; apontamentoId?: string | null;
}): Promise<void> {
  if (p.apontamentoId) {
    const { data, error } = await db.from("equip_producao_vibro")
      .update({ toneladas: p.toneladas, observacao: p.observacao?.trim() || null }).eq("id", p.apontamentoId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Sem permissão para corrigir este apontamento (apenas o autor ou a gestão).");
    return;
  }
  const { error } = await db.from("equip_producao_vibro").insert({
    company_id: p.companyId, equipamento_id: p.equipamentoId, ogs_number: p.ogs, data: p.data, turno: p.turno,
    toneladas: p.toneladas, observacao: p.observacao?.trim() || null, created_by: p.userId,
  });
  if (error) {
    if (/equip_producao_vibro_uk|duplicate/i.test(error.message || "")) {
      throw new Error("Já existe apontamento para este equipamento, obra, dia e turno. Corrija o existente.");
    }
    throw error;
  }
}

export async function removerApontamento(id: string): Promise<void> {
  const { data, error } = await db.from("equip_producao_vibro").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Sem permissão para remover este apontamento.");
}

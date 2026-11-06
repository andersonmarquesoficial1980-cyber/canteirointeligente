import { supabase } from "@/integrations/supabase/client";
import type { LinhaProducao } from "@/lib/equipProducao";

/**
 * Dashboard de confiabilidade: disponibilidade operacional, MTBF, MTTR, falhas, horas paradas e
 * Produção × Disponibilidade. O cálculo base fica no banco (equip_indicadores_manutencao);
 * aqui só se combinam linhas por obra em um valor por equipamento / total geral.
 */
const db = supabase as any;

export interface IndicadorLinha {
  equipamento_id: string; frota: string; ogs_number: string;
  dias_programados: number; tempo_programado_h: number; tempo_parado_h: number;
  disponibilidade_pct: number | null; qtd_falhas: number; tempo_operacao_h: number; mtbf_h: number | null;
  qtd_reparadas: number; tempo_reparo_h: number; mttr_h: number | null;
  falhas_em_aberto: number; falhas_sem_reparo: number;
  dias_sem_horario: number; dias_sem_operacao: number; dias_excluidos_rdo: number;
}

export interface Indicadores {
  programadoH: number; paradoH: number; operacaoH: number; falhas: number; reparadas: number; reparoH: number;
  /** null = sem tempo programado (sem horário cadastrado ou dia sem operação). */
  disponibilidade: number | null;
  /** null = sem falhas registradas (evita divisão por zero). */
  mtbf: number | null;
  /** null = nenhuma falha reparada com tempo de reparo informado. */
  mttr: number | null;
  falhasEmAberto: number; falhasSemReparo: number; diasSemHorario: number; diasProgramados: number;
}

export interface IndicadoresEquipamento extends Indicadores { equipamentoId: string; frota: string; obras: string[] }

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOuNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const arred = (n: number, c = 2) => Math.round(n * 10 ** c) / 10 ** c;

export function normalizarLinha(r: any): IndicadorLinha {
  return {
    equipamento_id: r.equipamento_id, frota: r.frota, ogs_number: r.ogs_number,
    dias_programados: num(r.dias_programados), tempo_programado_h: num(r.tempo_programado_h), tempo_parado_h: num(r.tempo_parado_h),
    disponibilidade_pct: numOuNull(r.disponibilidade_pct), qtd_falhas: num(r.qtd_falhas), tempo_operacao_h: num(r.tempo_operacao_h),
    mtbf_h: numOuNull(r.mtbf_h), qtd_reparadas: num(r.qtd_reparadas), tempo_reparo_h: num(r.tempo_reparo_h), mttr_h: numOuNull(r.mttr_h),
    falhas_em_aberto: num(r.falhas_em_aberto), falhas_sem_reparo: num(r.falhas_sem_reparo),
    dias_sem_horario: num(r.dias_sem_horario), dias_sem_operacao: num(r.dias_sem_operacao), dias_excluidos_rdo: num(r.dias_excluidos_rdo),
  };
}

/** Deriva os indicadores das SOMAS (nunca média de médias). */
export function somarLinhas(linhas: IndicadorLinha[]): Indicadores {
  const s = linhas.reduce((a, l) => ({
    prog: a.prog + l.tempo_programado_h, parado: a.parado + l.tempo_parado_h, op: a.op + l.tempo_operacao_h,
    falhas: a.falhas + l.qtd_falhas, rep: a.rep + l.qtd_reparadas, repH: a.repH + l.tempo_reparo_h,
    aberto: a.aberto + l.falhas_em_aberto, semRep: a.semRep + l.falhas_sem_reparo,
    semHor: a.semHor + l.dias_sem_horario, dias: a.dias + l.dias_programados,
  }), { prog: 0, parado: 0, op: 0, falhas: 0, rep: 0, repH: 0, aberto: 0, semRep: 0, semHor: 0, dias: 0 });
  return {
    programadoH: arred(s.prog), paradoH: arred(s.parado), operacaoH: arred(s.op), falhas: s.falhas, reparadas: s.rep, reparoH: arred(s.repH),
    disponibilidade: s.prog > 0 ? arred(((s.prog - s.parado) / s.prog) * 100) : null,
    mtbf: s.falhas > 0 ? arred(s.op / s.falhas) : null,
    mttr: s.rep > 0 ? arred(s.repH / s.rep) : null,
    falhasEmAberto: s.aberto, falhasSemReparo: s.semRep, diasSemHorario: s.semHor, diasProgramados: s.dias,
  };
}

export function agregarPorEquipamento(linhas: IndicadorLinha[]): IndicadoresEquipamento[] {
  const grupos = new Map<string, IndicadorLinha[]>();
  for (const l of linhas) grupos.set(l.equipamento_id, [...(grupos.get(l.equipamento_id) || []), l]);
  return [...grupos.entries()]
    .map(([equipamentoId, ls]) => ({
      equipamentoId, frota: ls[0].frota, obras: [...new Set(ls.map(l => l.ogs_number))].sort(), ...somarLinhas(ls),
    }))
    .sort((a, b) => a.frota.localeCompare(b.frota, "pt-BR", { numeric: true }));
}

export interface ProducaoDisponibilidade {
  equipamentoId: string; frota: string; tipo: "vibroacabadora" | "fresadora"; unidade: "t" | "m";
  producao: number; disponibilidade: number | null; diasLancados: number; diasPendentes: number;
}

/** Produção lançada por equipamento + disponibilidade, só para vibroacabadoras e fresadoras. */
export function produzirXDisponibilidade(equips: IndicadoresEquipamento[], producao: LinhaProducao[]): ProducaoDisponibilidade[] {
  const porEq = new Map<string, { tipo: "vibroacabadora" | "fresadora"; unidade: "t" | "m"; frota: string; total: number; ok: number; pend: number }>();
  for (const p of producao) {
    const a = porEq.get(p.equipamento_id) || { tipo: p.tipo, unidade: p.unidade, frota: p.frota, total: 0, ok: 0, pend: 0 };
    if (p.lancado && p.valor !== null) { a.total += Number(p.valor); a.ok++; } else a.pend++;
    porEq.set(p.equipamento_id, a);
  }
  const dispo = new Map(equips.map(e => [e.equipamentoId, e.disponibilidade]));
  return [...porEq.entries()]
    .map(([equipamentoId, a]) => ({
      equipamentoId, frota: a.frota, tipo: a.tipo, unidade: a.unidade, producao: arred(a.total),
      disponibilidade: dispo.get(equipamentoId) ?? null, diasLancados: a.ok, diasPendentes: a.pend,
    }))
    .sort((x, y) => x.frota.localeCompare(y.frota, "pt-BR", { numeric: true }));
}

export const fmtPct = (v: number | null): string =>
  v === null || !Number.isFinite(v) ? "Sem horário" : `${v.toFixed(2).replace(".", ",")}%`;
export const fmtHoras = (v: number | null): string =>
  v === null || !Number.isFinite(v) ? "Sem dados" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;

/** Faixas de cor para disponibilidade (referência visual; metas ainda não definidas pelo time). */
export function corDisponibilidade(v: number | null): "neutro" | "verde" | "amarelo" | "vermelho" {
  if (v === null) return "neutro";
  if (v >= 90) return "verde";
  if (v >= 75) return "amarelo";
  return "vermelho";
}

export async function buscarIndicadores(p: { companyId: string; de: string; ate: string; ogs?: string; equipamentoId?: string }): Promise<IndicadorLinha[]> {
  const { data, error } = await db.rpc("equip_indicadores_manutencao", {
    p_company_id: p.companyId, p_inicio: p.de, p_fim: p.ate, p_ogs: p.ogs || null, p_equipamento_id: p.equipamentoId || null,
  });
  if (error) throw error;
  return ((data || []) as any[]).map(normalizarLinha);
}

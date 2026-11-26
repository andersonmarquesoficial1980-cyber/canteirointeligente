// Sugestão de localização/uso do equipamento a partir dos RDOs (rdo_diarios + rdo_equipamentos).
// Lógica pura: usada pelo Controle de Lançamentos para sugerir onde estava a frota nos dias sem diário
// e para montar o payload de um diário criado a partir do RDO (ação manual de admin/programador).

export interface RdoHeader {
  id: string;
  data: string | null;
  turno: string | null;
  clima: string | null;
  status_validacao: string | null;
  tipo_rdo: string | null;
  obra_nome: string | null;
  ogs_id: string | null;
  local: string | null;
  encarregado: string | null;
  preenchido_por: string | null;
}

export interface RdoEquipRef { rdo_id: string | null; frota: string | null }

export interface RdoSuggestion {
  rdoId: string;
  date: string;
  fleet: string;
  period: "diurno" | "noturno" | null;
  ogs: string | null;
  local: string | null;
  apontador: string | null;
  encarregado: string | null;
  clima: string | null;
  workStatus: WorkStatusSuggestion | null;
}

export type WorkStatusSuggestion = "Trabalhando" | "Folga" | "Cancelou";

const norm = (v: string | null | undefined) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export const normFleet = (v: string | null | undefined) => (v || "").trim().toUpperCase();

/** Rascunho, cancelado/rejeitado e RDO automático não indicam localização real. */
export function isUsableRdo(r: Pick<RdoHeader, "status_validacao" | "tipo_rdo">): boolean {
  const status = norm(r.status_validacao);
  if (["RASCUNHO", "CANCELADO", "REJEITADO"].includes(status)) return false;
  return norm(r.tipo_rdo) !== "AUTOMATICO";
}

export function climaToWorkStatus(clima: string | null | undefined): WorkStatusSuggestion | null {
  switch (norm(clima)) {
    case "TRABALHOU": return "Trabalhando";
    case "FOLGA": return "Folga";
    case "CANCELOU": return "Cancelou";
    default: return null;
  }
}

function toPeriod(turno: string | null | undefined): "diurno" | "noturno" | null {
  const t = norm(turno);
  return t === "DIURNO" ? "diurno" : t === "NOTURNO" ? "noturno" : null;
}

/** Mapa frota → data → RDOs em que a frota está apontada (todos, inclusive vários no mesmo dia). */
export function buildRdoSuggestions(
  rdos: RdoHeader[],
  equips: RdoEquipRef[],
  ogsNumberById: Map<string, string>,
): Map<string, Map<string, RdoSuggestion[]>> {
  const byId = new Map<string, RdoHeader>();
  rdos.filter(r => r.data && isUsableRdo(r)).forEach(r => byId.set(r.id, r));

  const result = new Map<string, Map<string, RdoSuggestion[]>>();
  const seen = new Set<string>();
  equips.forEach(e => {
    const rdo = e.rdo_id ? byId.get(e.rdo_id) : undefined;
    const fleet = normFleet(e.frota);
    if (!rdo || !fleet || !rdo.data) return;
    const dedupe = `${fleet}|${rdo.id}`;
    if (seen.has(dedupe)) return; // mesma frota repetida no mesmo RDO
    seen.add(dedupe);

    const suggestion: RdoSuggestion = {
      rdoId: rdo.id,
      date: rdo.data,
      fleet,
      period: toPeriod(rdo.turno),
      ogs: (rdo.ogs_id && ogsNumberById.get(rdo.ogs_id)) || rdo.obra_nome || null,
      local: rdo.local || null,
      apontador: rdo.preenchido_por || null,
      encarregado: rdo.encarregado || null,
      clima: rdo.clima || null,
      workStatus: climaToWorkStatus(rdo.clima),
    };
    const byDate = result.get(fleet) || new Map<string, RdoSuggestion[]>();
    byDate.set(rdo.data, [...(byDate.get(rdo.data) || []), suggestion]);
    result.set(fleet, byDate);
  });

  result.forEach(byDate => byDate.forEach(list => list.sort((a, b) =>
    (a.period || "").localeCompare(b.period || "") || a.rdoId.localeCompare(b.rdoId))));
  return result;
}

/** "Turno noturno · OGS 2539 · RODOVIA SP-280 · William Silva (Trabalhou)" */
export function describeSuggestion(s: RdoSuggestion): string {
  return [
    s.period ? `turno ${s.period}` : null,
    s.ogs ? `OGS ${s.ogs}` : null,
    s.local,
    s.apontador ? `apontador ${s.apontador}` : null,
    s.clima ? `(${s.clima})` : null,
  ].filter(Boolean).join(" · ");
}

// ─── Medidor ────────────────────────────────────────────────────────────────

export interface MeterRow {
  date: string;
  period: string | null;
  created_at?: string | null;
  meter_final: number | null;
  odometer_final: number | null;
  equipment_type?: string | null;
}

export interface PreviousMeter { kind: "odometer" | "hourmeter"; value: number | null; equipmentType: string | null }

const shift = (p: string | null) => (p === "noturno" ? 1 : 0);

/** Último final enviado ANTES do dia/turno informado (para preencher inicial=final sem inventar horas). */
export function previousMeter(rows: MeterRow[], date: string, period: string | null): PreviousMeter {
  const ordered = rows
    .filter(r => r.date < date || (r.date === date && shift(r.period) < shift(period)))
    .sort((a, b) => a.date.localeCompare(b.date) || shift(a.period) - shift(b.period) ||
      String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const last = ordered[ordered.length - 1];
  const anyType = [...rows].reverse().find(r => r.equipment_type)?.equipment_type ?? null;
  if (!last) return { kind: "hourmeter", value: null, equipmentType: anyType };
  const usesOdo = last.odometer_final != null && last.meter_final == null;
  return {
    kind: usesOdo ? "odometer" : "hourmeter",
    value: usesOdo ? last.odometer_final : last.meter_final,
    equipmentType: last.equipment_type || anyType,
  };
}

// ─── Payload do diário criado a partir do RDO ───────────────────────────────

export interface CreateFromRdoInput {
  suggestion: RdoSuggestion;
  workStatus: WorkStatusSuggestion | "Disposição" | "Manutenção";
  period: "diurno" | "noturno";
  equipmentType: string;
  meterKind: "odometer" | "hourmeter";
  meterInitial: number | null;
  meterFinal: number | null;
  companyId: string;
  userId: string;
  creatorName: string;
  createdOn: string; // dd/mm/aaaa
}

export function buildDiaryFromRdoPayload(i: CreateFromRdoInput) {
  const { suggestion: s } = i;
  const tag = `[Gerado a partir do RDO${s.apontador ? ` de ${s.apontador}` : ""} por ${i.creatorName} em ${i.createdOn}${
    i.meterInitial == null ? " — medidor não informado" : ""}]`;
  const observations = i.workStatus === "Cancelou" ? `[CANCELOU: conforme RDO]\n${tag}` : tag;
  const meters = i.meterKind === "odometer"
    ? { odometer_initial: i.meterInitial, odometer_final: i.meterFinal }
    : { meter_initial: i.meterInitial, meter_final: i.meterFinal };
  return {
    equipment_fleet: s.fleet,
    equipment_type: i.equipmentType,
    date: s.date,
    period: i.period,
    work_status: i.workStatus,
    ogs_number: s.ogs,
    location_address: s.local,
    observations,
    status: "enviado",
    is_auto: false,
    company_id: i.companyId,
    user_id: i.userId,
    created_by: i.userId,
    ...meters,
  };
}

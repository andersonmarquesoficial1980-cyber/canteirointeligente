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
  /** true = nenhum RDO apontou a frota; OGS/local vêm do último diário conhecido (só como ponto de partida). */
  noRdo?: boolean;
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

/** Sugestão para dia sem RDO: parte do último local conhecido e assume "Disposição" até o admin conferir. */
export function fallbackSuggestion(
  fleet: string, date: string, last: { ogs: string | null; local: string | null } | null,
): RdoSuggestion {
  return {
    rdoId: "", date, fleet: normFleet(fleet), period: null, ogs: last?.ogs ?? null, local: last?.local ?? null,
    apontador: null, encarregado: null, clima: null, workStatus: null, noRdo: true,
  };
}

/** "Turno noturno · OGS 2539 · RODOVIA SP-280 · William Silva (Trabalhou)" */
export function describeSuggestion(s: RdoSuggestion): string {
  if (s.noRdo) {
    const last = [s.ogs ? `OGS ${s.ogs}` : null, s.local].filter(Boolean).join(" · ");
    return `sem RDO${last ? ` · último local conhecido: ${last}` : ""}`;
  }
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
  operatorName?: string | null; // opcional: operador informado pelo gestor
  clientName?: string | null;
}

export function buildDiaryFromRdoPayload(i: CreateFromRdoInput) {
  const { suggestion: s } = i;
  const tag = `[Gerado ${s.noRdo ? "sem RDO (conferido pelo gestor)" : `a partir do RDO${s.apontador ? ` de ${s.apontador}` : ""}`} por ${i.creatorName} em ${i.createdOn}${
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
    operator_name: i.operatorName || null,
    client_name: i.clientName || null,
    status: "enviado",
    is_auto: false,
    company_id: i.companyId,
    user_id: i.userId,
    created_by: i.userId,
    ...meters,
  };
}

// ─── Rateio do intervalo sem medição + lote ─────────────────────────────────

export interface LastKnownRow extends MeterRow {
  ogs_number?: string | null;
  location_address?: string | null;
  meter_initial?: number | null;
  odometer_initial?: number | null;
}

/** Último local/turno conhecido da frota antes da data (ponto de partida para dias sem RDO). */
export function lastKnown(rows: LastKnownRow[], date: string) {
  const last = rows
    .filter(r => r.date < date && (r.ogs_number || r.location_address))
    .sort((a, b) => a.date.localeCompare(b.date) || shift(a.period) - shift(b.period) ||
      String(a.created_at || "").localeCompare(String(b.created_at || "")))
    .pop();
  return last
    ? { ogs: last.ogs_number || null, local: last.location_address || null,
        period: (last.period === "noturno" ? "noturno" : last.period === "diurno" ? "diurno" : null) as "diurno" | "noturno" | null }
    : null;
}

export interface MeterAnchor { date: string; period: string | null; created_at?: string | null; initial: number | null; final: number | null }

export function anchorsFrom(rows: LastKnownRow[], kind: "odometer" | "hourmeter"): MeterAnchor[] {
  return rows.map(r => ({
    date: r.date, period: r.period, created_at: r.created_at,
    initial: (kind === "odometer" ? r.odometer_initial : r.meter_initial) ?? null,
    final: (kind === "odometer" ? r.odometer_final : r.meter_final) ?? null,
  }));
}

export interface PlanEntry { key: string; date: string; period: string | null; working: boolean }
export interface PlannedMeter { ini: number | null; fin: number | null; hours: number; note?: string }

const pos = (d: { date: string; period: string | null }) => `${d.date}:${shift(d.period)}`;
const T = (n: number) => Math.round(n * 10); // décimos (horímetro 0,1 h)

/**
 * Dilui a diferença entre o último final anterior e o primeiro inicial posterior
 * (ex.: 5682 → 5732 = 50 h) igualmente entre os dias "Trabalhando" do intervalo; demais dias ficam parados
 * (inicial = final). O resto de arredondamento vai para o último dia trabalhado. Encadeia inicial = final anterior.
 */
export function planMeters(entries: PlanEntry[], anchorsIn: MeterAnchor[]): Map<string, PlannedMeter> {
  const anchors = [...anchorsIn].sort((a, b) => pos(a).localeCompare(pos(b)) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const ordered = [...entries].sort((a, b) => pos(a).localeCompare(pos(b)));
  const groups = new Map<string, PlanEntry[]>();
  const bounds = new Map<string, { prev?: MeterAnchor; next?: MeterAnchor }>();
  ordered.forEach(e => {
    const p = pos(e);
    const prev = [...anchors].reverse().find(a => pos(a) < p);
    const next = anchors.find(a => pos(a) > p);
    const k = `${prev ? pos(prev) + (prev.created_at || "") : "-"}|${next ? pos(next) + (next.created_at || "") : "-"}`;
    groups.set(k, [...(groups.get(k) || []), e]);
    bounds.set(k, { prev, next });
  });

  const out = new Map<string, PlannedMeter>();
  groups.forEach((list, k) => {
    const { prev, next } = bounds.get(k)!;
    if (prev?.final == null) {
      list.forEach(e => out.set(e.key, { ini: null, fin: null, hours: 0, note: "sem medidor anterior" }));
      return;
    }
    const totalT = next?.initial != null ? T(next.initial) - T(prev.final) : null;
    const workers = list.filter(e => e.working);
    let note: string | undefined;
    let pool = 0;
    if (totalT == null) note = "sem leitura posterior para ratear";
    else if (totalT < 0) note = "medidor posterior menor que o anterior";
    else if (totalT > 0 && workers.length === 0) note = `${totalT / 10} h sem dia trabalhado para ratear`;
    else pool = totalT;

    const base = workers.length ? Math.floor(pool / workers.length) : 0;
    const lastWorker = workers[workers.length - 1];
    let running = T(prev.final);
    list.forEach(e => {
      const share = e.working && pool > 0 ? (e === lastWorker ? pool - base * (workers.length - 1) : base) : 0;
      out.set(e.key, { ini: running / 10, fin: (running + share) / 10, hours: share / 10, note });
      running += share;
    });
  });
  return out;
}

export interface BatchEntry {
  key: string;
  suggestion: RdoSuggestion;
  period: "diurno" | "noturno";
  status: WorkStatusSuggestion | "Disposição";
  working: boolean;
}

/** Uma entrada por dia/turno faltante (todos os RDOs; sem RDO usa o último local). Segundo RDO no mesmo turno é pulado. */
export function buildBatchEntries(
  fleet: string, missing: string[], byDate: Map<string, RdoSuggestion[]> | undefined, rows: LastKnownRow[],
): { entries: BatchEntry[]; skipped: { date: string; reason: string }[] } {
  const entries: BatchEntry[] = [];
  const skipped: { date: string; reason: string }[] = [];
  [...missing].sort().forEach(date => {
    const last = lastKnown(rows, date);
    const sugs = byDate?.get(date) || [];
    const list = sugs.length ? sugs : [fallbackSuggestion(fleet, date, last)];
    const used = new Set<string>();
    list.forEach(sg => {
      const period = sg.period || last?.period || "diurno";
      if (used.has(period)) { skipped.push({ date, reason: `2º RDO no turno ${period} (o banco aceita 1 diário por turno)` }); return; }
      used.add(period);
      const status = sg.workStatus || "Disposição";
      entries.push({ key: `${date}|${period}`, suggestion: sg, period, status, working: status === "Trabalhando" });
    });
  });
  return { entries, skipped };
}

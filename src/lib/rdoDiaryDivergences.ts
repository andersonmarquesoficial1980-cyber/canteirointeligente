export interface RdoSource {
  id: string;
  data: string | null;
  obra_nome: string | null;
  ogs_id: string | null;
  turno: string | null;
  encarregado?: string | null;
  clima?: string | null;
}
export interface RdoEquipmentSource { id: string; rdo_id: string | null; frota: string | null; tipo?: string | null }
export interface EquipmentDiarySource {
  id: string;
  date: string | null;
  equipment_fleet: string | null;
  ogs_number: string | null;
  period: string | null;
  operator_name: string | null;
  operator_id?: string | null;
  work_status: string | null;
  status: string | null;
}
export interface RdoPersonSource { rdo_id: string | null; nome: string | null; employee_id?: string | null }
export interface OgsSource { id: string; ogs_number: string | null }
export type DivergenceKind = "diario_sem_rdo" | "diario_sem_equipamento" | "rdo_sem_diario" | "operador_fora_efetivo";
export interface DiaryDivergence {
  kind: DivergenceKind;
  date: string;
  ogs: string;
  turno: string;
  frota: string;
  operator: string;
  encarregado: string;
  rdoId?: string;
  diaryId?: string;
  detail: string;
}

const norm = (s: string | null | undefined) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const fleet = (s: string | null | undefined) => norm(s).replace(/[^A-Z0-9]/g, "");
const shift = (s: string | null | undefined) => norm(s).replace(/^NOTURNO$/, "NOITE").replace(/^DIURNO$/, "DIA");
const number = (s: string | null | undefined) => norm(s).replace(/^(?:OGS)[-\s:]*/i, "");
const active = (d: EquipmentDiarySource) => norm(d.status) === "ENVIADO" && !["FOLGA", "CANCELOU", "MANUTENCAO", "EM TRANSPORTE"].includes(norm(d.work_status));

export function reconcileRdoDiaries(
  rdos: RdoSource[], equipments: RdoEquipmentSource[], diaries: EquipmentDiarySource[], ogsRows: OgsSource[], people: RdoPersonSource[],
): DiaryDivergence[] {
  const ogsById = new Map(ogsRows.map(o => [o.id, number(o.ogs_number)]));
  const rdoOgs = (r: RdoSource) => ogsById.get(r.ogs_id || "") || number(r.obra_nome);
  const sameContext = (r: RdoSource, d: EquipmentDiarySource) =>
    !!r.data && r.data === d.date && !!rdoOgs(r) && rdoOgs(r) === number(d.ogs_number) && !!shift(r.turno) && shift(r.turno) === shift(d.period);
  const effective = diaries.filter(d => active(d) && d.date && fleet(d.equipment_fleet) && number(d.ogs_number) && shift(d.period));
  const rows: DiaryDivergence[] = [];
  const matchedEquipment = new Set<string>();
  for (const d of effective) {
    const candidates = rdos.filter(r => sameContext(r, d) && norm(r.clima) !== "FOLGA" && norm(r.clima) !== "CANCELOU");
    const found = candidates.find(r => equipments.some(e => e.rdo_id === r.id && fleet(e.frota) === fleet(d.equipment_fleet)));
    const r = found || candidates[0];
    const base = { date: d.date!, ogs: d.ogs_number || "", turno: d.period || "", frota: d.equipment_fleet || "", operator: d.operator_name || "", encarregado: r?.encarregado || "", rdoId: r?.id, diaryId: d.id };
    if (!r) {
      rows.push({ ...base, kind: "diario_sem_rdo", detail: "Diário enviado sem RDO da mesma OGS, data e turno; confirmar se há RDO a lançar." });
      continue;
    }
    if (!found) rows.push({ ...base, kind: "diario_sem_equipamento", detail: "Equipamento do diário não localizado neste RDO." });
    for (const e of equipments.filter(e => e.rdo_id === r.id && fleet(e.frota) === fleet(d.equipment_fleet))) matchedEquipment.add(e.id);
    if (norm(d.operator_name) && !people.some(p => p.rdo_id === r.id && (
      (d.operator_id && p.employee_id === d.operator_id) || (p.nome || "").split("|||").some(name => norm(name) === norm(d.operator_name))
    ))) {
      rows.push({ ...base, kind: "operador_fora_efetivo", detail: "Nome do operador do diário não localizado no efetivo; conferir a identidade antes de incluir." });
    }
  }
  for (const e of equipments) {
    const r = rdos.find(r => r.id === e.rdo_id);
    if (!r || !r.data || !fleet(e.frota) || matchedEquipment.has(e.id) || ["FOLGA", "CANCELOU"].includes(norm(r.clima))) continue;
    rows.push({ kind: "rdo_sem_diario", date: r.data, ogs: ogsById.get(r.ogs_id || "") || r.obra_nome || "", turno: r.turno || "", frota: e.frota || "", operator: "", encarregado: r.encarregado || "", rdoId: r.id, detail: "Equipamento do RDO sem diário enviado na mesma OGS, data e turno; conferir se o diário é devido." });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.frota.localeCompare(b.frota));
}

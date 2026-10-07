export type StandardType = { tipo: string; ativo: boolean };
export type RdoEquipment = { tipo?: string | null; subTipo?: string | null; frota?: string | null };
export type Exception = { tipo: string; motivo: string };
export type Diary = {
  id: string; date: string | null; ogs_number: string | null; period: string | null;
  equipment_fleet: string | null; operator_name: string | null; operator_id?: string | null; status: string | null;
  work_status: string | null; is_auto?: boolean | null;
};
export type RdoPerson = { nome?: string | null; employee_id?: string | null };
export type DiarySuggestion = { diaryId: string; frota: string; operador: string; faltaFrota: boolean; faltaOperador: boolean };
const norm = (v: string | null | undefined) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const normFleet = (v: string | null | undefined) => norm(v).replace(/[^A-Z0-9]/g, "");

export function findMissingStandardTypes(standards: StandardType[], equipments: RdoEquipment[], exceptions: Exception[]): string[] {
  return [...new Map(standards.filter(s => s.ativo).map(s => [norm(s.tipo), s.tipo])).entries()]
    .filter(([key]) => key && !equipments.some(e => norm(e.tipo) === key || norm(e.subTipo) === key)
      && !exceptions.some(x => norm(x.tipo) === key && !!x.motivo.trim()))
    .map(([, name]) => name);
}

export function findDiarySuggestions(diaries: Diary[], context: { date: string; ogs: string; period: string }, equipments: RdoEquipment[], people: RdoPerson[]): DiarySuggestion[] {
  return diaries.filter(d => d.status === "enviado" && !d.is_auto && d.date === context.date &&
    norm(d.ogs_number) === norm(context.ogs) && norm(d.period) === norm(context.period) &&
    !["FOLGA", "CANCELOU", "MANUTENCAO", "EM TRANSPORTE"].includes(norm(d.work_status)) && !!normFleet(d.equipment_fleet))
    .map(d => ({
      diaryId: d.id,
      frota: d.equipment_fleet || "",
      operador: d.operator_name || "",
      faltaFrota: !equipments.some(e => normFleet(e.frota) === normFleet(d.equipment_fleet)),
      faltaOperador: !!norm(d.operator_name) && !people.some(p => (d.operator_id && p.employee_id === d.operator_id) ||
        String(p.nome || "").split("|||").some(n => norm(n) === norm(d.operator_name))),
    }))
    .filter(x => x.faltaFrota || x.faltaOperador);
}

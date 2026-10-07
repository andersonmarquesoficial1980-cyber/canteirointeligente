import { describe, expect, it } from "vitest";
import { reconcileRdoDiaries } from "./rdoDiaryDivergences";

const rdo = { id: "r1", data: "2026-10-07", obra_nome: "Obra 2539", ogs_id: "o1", turno: "diurno", encarregado: "Ana", clima: "Trabalhou" };
const equip = { id: "e1", rdo_id: "r1", frota: "CC02", tipo: "CAMINHÃO" };
const diary = { id: "d1", date: "2026-10-07", equipment_fleet: "CC02", ogs_number: "2539", period: "diurno", operator_name: "Joaquim", work_status: "Trabalhando", status: "enviado" };
const ogs = [{ id: "o1", ogs_number: "2539" }];

describe("conciliação RDO × Diário", () => {
  it("não sinaliza frota registrada no mesmo dia, OGS e turno", () => {
    expect(reconcileRdoDiaries([rdo], [equip], [diary], ogs, [{ rdo_id: "r1", nome: "Joaquim" }])).toEqual([]);
  });
  it("sinaliza equipamento do diário ausente no RDO sem adicioná-lo automaticamente", () => {
    const rows = reconcileRdoDiaries([rdo], [], [diary], ogs, []);
    expect(rows.some(x => x.kind === "diario_sem_equipamento" && x.frota === "CC02" && x.rdoId === "r1")).toBe(true);
  });
  it("sinaliza motorista ausente do efetivo mesmo com frota presente", () => {
    const rows = reconcileRdoDiaries([rdo], [equip], [diary], ogs, []);
    expect(rows.map(x => x.kind)).toEqual(["operador_fora_efetivo"]);
  });
  it("não liga lançamentos de turnos ou OGS diferentes", () => {
    const rows = reconcileRdoDiaries([rdo], [equip], [{ ...diary, ogs_number: "2540" }], ogs, []);
    expect(rows.some(x => x.kind === "diario_sem_rdo")).toBe(true);
    expect(rows.some(x => x.kind === "rdo_sem_diario")).toBe(true);
  });
  it("não usa diários em rascunho nem de folga como trabalho na obra", () => {
    expect(reconcileRdoDiaries([rdo], [equip], [{ ...diary, status: "rascunho" }], ogs, []).map(x => x.kind)).toEqual(["rdo_sem_diario"]);
    expect(reconcileRdoDiaries([rdo], [equip], [{ ...diary, work_status: "Folga" }], ogs, []).map(x => x.kind)).toEqual(["rdo_sem_diario"]);
  });
  it("não equipara homônimos abreviados por aproximação", () => {
    const rows = reconcileRdoDiaries([rdo], [equip], [diary], ogs, [{ rdo_id: "r1", nome: "Joaquim Silva" }]);
    expect(rows.some(x => x.kind === "operador_fora_efetivo")).toBe(true);
  });
  it("reconhece o mesmo operador pelo cadastro mesmo quando o nome é abreviado", () => {
    const rows = reconcileRdoDiaries([rdo], [equip], [{ ...diary, operator_name: "Joaquim S.", operator_id: "person-1" }], ogs, [{ rdo_id: "r1", nome: "Joaquim Silva", employee_id: "person-1" }]);
    expect(rows).toEqual([]);
  });
  it("não duplica divergências com RDOs de mesma obra", () => {
    const rows = reconcileRdoDiaries([rdo, { ...rdo, id: "r2" }], [], [diary], ogs, []);
    expect(rows.filter(x => x.kind === "diario_sem_equipamento")).toHaveLength(1);
  });
});

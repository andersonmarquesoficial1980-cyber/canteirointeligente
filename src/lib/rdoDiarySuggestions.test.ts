import { describe, expect, it } from "vitest";
import {
  buildDiaryFromRdoPayload, buildRdoSuggestions, fallbackSuggestion, climaToWorkStatus, describeSuggestion, isUsableRdo, previousMeter,
  type RdoHeader,
} from "./rdoDiarySuggestions";

const rdo = (over: Partial<RdoHeader>): RdoHeader => ({
  id: "r1", data: "2026-11-07", turno: "diurno", clima: "Trabalhou", status_validacao: "validado", tipo_rdo: "CAUQ",
  obra_nome: "2539", ogs_id: "g1", local: "RODOVIA SP-264", encarregado: "THIAGO", preenchido_por: "FRANCISCO ALVES", ...over,
});

describe("rdoDiarySuggestions", () => {
  it("lista TODOS os RDOs do mesmo dia (turnos/locais diferentes)", () => {
    const map = buildRdoSuggestions(
      [rdo({}), rdo({ id: "r2", turno: "noturno", local: "RODOVIA SP-280", preenchido_por: "WILLIAM SILVA" })],
      [{ rdo_id: "r1", frota: "bc66" }, { rdo_id: "r2", frota: "BC66 " }],
      new Map([["g1", "2539"]]),
    );
    const list = map.get("BC66")!.get("2026-11-07")!;
    expect(list.map(s => s.period)).toEqual(["diurno", "noturno"]);
    expect(list.map(s => s.local)).toEqual(["RODOVIA SP-264", "RODOVIA SP-280"]);
    expect(list[0].ogs).toBe("2539");
  });

  it("ignora rascunho, cancelado e RDO automático; não duplica frota repetida no mesmo RDO", () => {
    const map = buildRdoSuggestions(
      [rdo({ id: "a", status_validacao: "rascunho" }), rdo({ id: "b", tipo_rdo: "AUTOMATICO" }), rdo({ id: "c" })],
      [{ rdo_id: "a", frota: "X1" }, { rdo_id: "b", frota: "X1" }, { rdo_id: "c", frota: "X1" }, { rdo_id: "c", frota: "x1" }],
      new Map(),
    );
    expect(map.get("X1")!.get("2026-11-07")).toHaveLength(1);
    expect(isUsableRdo({ status_validacao: "Rascunho", tipo_rdo: "CAUQ" })).toBe(false);
  });

  it("mapeia clima do RDO para status do diário", () => {
    expect(climaToWorkStatus("Trabalhou")).toBe("Trabalhando");
    expect(climaToWorkStatus("Folga")).toBe("Folga");
    expect(climaToWorkStatus("Cancelou")).toBe("Cancelou");
    expect(climaToWorkStatus("Chuva")).toBeNull();
  });

  it("previousMeter usa o último final anterior ao dia/turno e detecta odômetro", () => {
    const rows = [
      { date: "2026-11-01", period: "noturno", meter_final: 5682, odometer_final: null, equipment_type: "Bobcat" },
      { date: "2026-11-23", period: "noturno", meter_final: 5737, odometer_final: null, equipment_type: "Bobcat" },
    ];
    expect(previousMeter(rows, "2026-11-04", "noturno")).toEqual({ kind: "hourmeter", value: 5682, equipmentType: "Bobcat" });
    expect(previousMeter(rows, "2026-10-01", "noturno").value).toBeNull();
    const km = previousMeter([{ date: "2026-11-01", period: "diurno", meter_final: null, odometer_final: 120 }], "2026-11-02", "diurno");
    expect(km).toMatchObject({ kind: "odometer", value: 120 });
  });

  it("dia sem RDO: sugestão parte do último local e payload registra que não houve RDO", () => {
    const s = fallbackSuggestion("bc66", "2026-11-02", { ogs: "2539", local: "RODOVIA SP-280" });
    expect(describeSuggestion(s)).toBe("sem RDO · último local conhecido: OGS 2539 · RODOVIA SP-280");
    const p = buildDiaryFromRdoPayload({
      suggestion: s, workStatus: "Disposição", period: "noturno", equipmentType: "Bobcat", meterKind: "hourmeter",
      meterInitial: 5682, meterFinal: 5682, companyId: "c", userId: "u", creatorName: "Anderson", createdOn: "26/11/2026",
    });
    expect(p).toMatchObject({ equipment_fleet: "BC66", ogs_number: "2539", work_status: "Disposição", status: "enviado" });
    expect(p.observations).toContain("Gerado sem RDO (conferido pelo gestor) por Anderson");
    expect(p.operator_name).toBeNull();
    const p2 = buildDiaryFromRdoPayload({
      suggestion: { ...s, ogs: "2540", local: "SP-270" }, workStatus: "Trabalhando", period: "noturno", equipmentType: "Bobcat",
      meterKind: "hourmeter", meterInitial: 1, meterFinal: 2, companyId: "c", userId: "u", creatorName: "A", createdOn: "x",
      operatorName: "TIAGO DE SOUSA", clientName: "MOTIVA",
    });
    expect(p2).toMatchObject({ ogs_number: "2540", location_address: "SP-270", operator_name: "TIAGO DE SOUSA", client_name: "MOTIVA" });
  });

  it("monta payload enviado, manual, com origem rastreável no observations", () => {
    const [s] = buildRdoSuggestions([rdo({ clima: "Cancelou" })], [{ rdo_id: "r1", frota: "BC66" }], new Map([["g1", "2539"]])).get("BC66")!.get("2026-11-07")!;
    const p = buildDiaryFromRdoPayload({
      suggestion: s, workStatus: "Cancelou", period: "diurno", equipmentType: "Bobcat", meterKind: "hourmeter",
      meterInitial: 5682, meterFinal: 5682, companyId: "c", userId: "u", creatorName: "Anderson", createdOn: "26/11/2026",
    });
    expect(p).toMatchObject({
      equipment_fleet: "BC66", date: "2026-11-07", period: "diurno", status: "enviado", is_auto: false,
      ogs_number: "2539", location_address: "RODOVIA SP-264", meter_initial: 5682, meter_final: 5682, company_id: "c", created_by: "u",
    });
    expect(p.observations).toContain("[CANCELOU: conforme RDO]");
    expect(p.observations).toContain("Gerado a partir do RDO de FRANCISCO ALVES por Anderson em 26/11/2026");
    expect(p).not.toHaveProperty("odometer_initial");
    expect(describeSuggestion(s)).toBe("turno diurno · OGS 2539 · RODOVIA SP-264 · apontador FRANCISCO ALVES · (Cancelou)");
  });
});

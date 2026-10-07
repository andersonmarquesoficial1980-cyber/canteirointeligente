import { describe, expect, it } from "vitest";
import { findMissingStandardTypes, findDiarySuggestions } from "./rdoEquipmentReview";

const entries = [{ tipo: "ROLO CHAPA", subTipo: "ROLO CHAPA", frota: "CH04" }];

describe("conferência de equipamentos do RDO", () => {
  it("alerta apenas tipos ativos ainda não lançados ou justificados", () => {
    const expected = [{ tipo: "ROLO CHAPA", ativo: true }, { tipo: "TORRE DE ILUMINAÇÃO", ativo: true }, { tipo: "COMPRESSOR", ativo: false }];
    expect(findMissingStandardTypes(expected, entries, [])).toEqual(["TORRE DE ILUMINAÇÃO"]);
    expect(findMissingStandardTypes(expected, entries, [{ tipo: "TORRE DE ILUMINAÇÃO", motivo: "Não utilizada" }])).toEqual([]);
  });
  it("considera subtipo do RDO e normaliza acentos, sem fuzzy", () => {
    expect(findMissingStandardTypes([{ tipo: "ROLO PNEU", ativo: true }], [{ tipo: "ROLO COMPACTADOR", subTipo: "rolo pneu", frota: "PN47" }], [])).toEqual([]);
    expect(findMissingStandardTypes([{ tipo: "ROLO PNEU", ativo: true }], entries, [])).toEqual(["ROLO PNEU"]);
  });
  it("sugere apenas diários enviados da OGS, data e turno exatos", () => {
    const diary = { id: "d1", date: "2026-10-07", ogs_number: "2539", period: "diurno", equipment_fleet: "CC02", operator_name: "Joaquim", status: "enviado", work_status: "Trabalhando", is_auto: false };
    expect(findDiarySuggestions([diary, { ...diary, id: "d2", period: "noturno" }, { ...diary, id: "d3", ogs_number: "2540" }], { date: "2026-10-07", ogs: "2539", period: "diurno" }, [], [])).toEqual([{ diaryId: "d1", frota: "CC02", operador: "Joaquim", faltaFrota: true, faltaOperador: true }]);
  });
  it("reconhece motorista pelo ID cadastrado quando o nome vem abreviado no diário", () => {
    const diary = { id: "d1", date: "2026-10-07", ogs_number: "2539", period: "diurno", equipment_fleet: "CC02", operator_name: "Joaquim S.", operator_id: "person-1", status: "enviado", work_status: "Trabalhando", is_auto: false };
    expect(findDiarySuggestions([diary], { date: diary.date, ogs: "2539", period: "diurno" }, [{ frota: "CC02" }], [{ nome: "Joaquim Silva", employee_id: "person-1" }])).toEqual([]);
  });
  it("não sugere diários de folga/automáticos/rascunho ou duplicados no RDO", () => {
    const diary = { id: "d1", date: "2026-10-07", ogs_number: "2539", period: "diurno", equipment_fleet: "CC02", operator_name: "Joaquim", status: "enviado", work_status: "Trabalhando", is_auto: false };
    expect(findDiarySuggestions([{ ...diary, work_status: "Folga" }, { ...diary, is_auto: true }, { ...diary, status: "rascunho" }], { date: diary.date, ogs: "2539", period: "diurno" }, [], [])).toEqual([]);
    expect(findDiarySuggestions([diary], { date: diary.date, ogs: "2539", period: "diurno" }, [{ frota: "CC02" }], [{ nome: "Joaquim" }])).toEqual([]);
  });
});

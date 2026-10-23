import { describe, expect, it } from "vitest";
import { validatePastVacation, type PastVacationInput } from "./vacationManualHistory";

const base: PastVacationInput = {
  start: "2025-07-01", end: "2025-07-15", today: "2026-10-23",
  kind: "individual", source: "Recibo do RH", acquisitionStart: "2024-01-15", acquisitionEnd: "2025-01-14",
  existing: [],
};

describe("lançamento manual de férias já gozadas", () => {
  it("aceita um gozo passado documentado sem supor saldo homologado", () => {
    expect(validatePastVacation(base)).toEqual({ days: 15, errors: [] });
  });
  it("permite informar apenas a última saída quando o período aquisitivo é desconhecido", () => {
    expect(validatePastVacation({ ...base, acquisitionStart: null, acquisitionEnd: null }).errors).toEqual([]);
  });
  it("não registra datas futuras ou intervalo inválido como gozo efetivo", () => {
    expect(validatePastVacation({ ...base, end: "2026-10-23" }).errors).toContain("Gozo histórico exige data final anterior a hoje.");
    expect(validatePastVacation({ ...base, end: "2025-06-30" }).errors).toContain("Informe datas de início e fim válidas.");
  });
  it("impede duplicar ou sobrepor um gozo já conhecido", () => {
    expect(validatePastVacation({ ...base, existing: [{ start: "2025-07-10", end: "2025-07-20" }] }).errors).toContain("Já há férias cadastradas nesse intervalo; revise antes de registrar novamente.");
  });
  it("não permite período aquisitivo parcial ou prova de origem curta", () => {
    expect(validatePastVacation({ ...base, acquisitionEnd: null, source: "RH" }).errors).toEqual([
      "Informe de onde veio a informação (mínimo 8 caracteres).",
      "Informe ambas as datas do período aquisitivo ou deixe ambas em branco.",
    ]);
  });
  it("rejeita gozo antes da admissão quando a data é conhecida", () => {
    expect(validatePastVacation({ ...base, admission: "2025-08-01" }).errors).toContain("O gozo informado é anterior à admissão cadastrada.");
  });
});

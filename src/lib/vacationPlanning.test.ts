import { describe, expect, it } from "vitest";
import { assessVacationPlan, activeVacation, concessionDeadline, summarizeVacation } from "./vacationPlanning";

const period = { id: "p1", periodo_inicio: "2025-01-15", periodo_fim: "2026-01-14", dias_direito: 30, dias_gozados: 0, dias_coletiva: 0 };
const planned = { id: "v1", vacation_period_id: "p1", data_inicio: "2026-07-01", data_fim: "2026-07-15", dias: 15, workflow_status: "programada" };

function check(start: string, end: string, records: typeof planned[] = [], selected = period) {
  return assessVacationPlan({ start, end, period: selected, records, today: "2026-02-01" });
}

describe("programação de férias", () => {
  it("permite pré-programação sem saldo homologado, mas exige conferência do RH", () => {
    const result = assessVacationPlan({ start: "2026-05-01", end: "2026-05-30", period: null, records: [], today: "2026-02-01" });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("Período aquisitivo e saldo não conferidos: esta programação depende de validação do RH.");
  });
  it("avisa quando não há vínculo e impede férias individuais antes de 12 meses da admissão", () => {
    const result = assessVacationPlan({ start: "2026-11-01", end: "2026-11-15", period: null, records: [], today: "2026-02-01", admission: "2026-01-15", kind: "individual" });
    expect(result.errors).toContain("Férias individuais antes de completar 12 meses de admissão: encaminhe ao RH.");
    expect(assessVacationPlan({ start: "2026-11-01", end: "2026-11-15", period: null, records: [], today: "2026-02-01", admission: "2026-01-15", kind: "coletiva" }).errors).toEqual([]);
  });
  it("permite programar antes dos 12 meses se o gozo começar depois da aquisição", () => {
    expect(check("2026-02-10", "2026-03-11").errors).toEqual([]);
    expect(check("2026-01-14", "2026-02-12").errors).toContain("O início do gozo antecede a aquisição deste período.");
  });
  it("calcula o último dia concessivo pelo aniversário, inclusive ano bissexto", () => {
    expect(concessionDeadline("2026-01-14")).toBe("2027-01-14");
    expect(concessionDeadline("2024-02-28")).toBe("2025-02-28");
    expect(check("2027-01-01", "2027-01-30").errors).toContain("O fim das férias ultrapassa o prazo concessivo (14/01/2027). Encaminhe ao RH.");
  });
  it("reserva dias programados sem tratá-los como já gozados", () => {
    expect(check("2026-08-01", "2026-08-16", [planned]).errors).toContain("Saldo insuficiente: 15 dias disponíveis neste período, 16 solicitados.");
    expect(check("2026-08-01", "2026-08-15", [planned]).errors).toEqual([]);
  });
  it("não confia em contadores legados que já podem incluir programações futuras", () => {
    const legacy = { ...period, dias_gozados: 15 };
    expect(check("2026-08-01", "2026-08-15", [planned], legacy).errors).toContain("Saldo histórico inconciliado com programação futura: solicite conferência do RH.");
  });
  it("não desconta dias de programação não confirmada e detecta sobreposição ativa", () => {
    expect(check("2026-07-10", "2026-07-20", [planned]).errors).toContain("Já existe programação que coincide com as datas escolhidas.");
    expect(check("2026-07-10", "2026-07-20", [{ ...planned, workflow_status: "nao_confirmada" }]).errors).toEqual([]);
  });
  it("não declara férias vigentes a partir de registro que não ocorrerá", () => {
    expect(activeVacation([{ ...planned, workflow_status: "nao_confirmada" }], "2026-07-04")).toBe(false);
    expect(activeVacation([planned], "2026-07-04")).toBe(false);
    expect(activeVacation([{ ...planned, workflow_status: "confirmada" }], "2026-07-04")).toBe(true);
    expect(activeVacation([planned], "2026-07-04", "ferias")).toBe(true);
    expect(activeVacation([{ ...planned, workflow_status: "nao_confirmada" }], "2026-07-04", "ferias")).toBe(false);
  });
  it("gera resumo sem afirmar que WhatsApp foi enviado", () => {
    expect(summarizeVacation({ name: "Operador A", matricula: "123", start: "2026-07-01", end: "2026-07-15", period, replacement: "Operador B" })).toContain("Cobertura: Operador B");
    expect(summarizeVacation({ name: "Operador A", matricula: "123", start: "2026-07-01", end: "2026-07-15", period, replacement: "Operador B" })).not.toContain("enviado");
  });
});

import { describe, expect, it } from "vitest";
import {
  compactRanges,
  computeEquipmentAlerts,
  computeRdoAlerts,
  daysLeftToLaunch,
  isNonWorkingDay,
} from "./diaryDeadlineAlerts";

const TODAY = "2026-11-18"; // quarta-feira

describe("daysLeftToLaunch", () => {
  it("anteontem vence hoje, ontem vence amanhã", () => {
    expect(daysLeftToLaunch("2026-11-16", TODAY)).toBe(0);
    expect(daysLeftToLaunch("2026-11-17", TODAY)).toBe(1);
  });
});

describe("computeEquipmentAlerts", () => {
  const d = (date: string, fleet = "BC75") => ({ fleet, date });

  it("sem lacunas não gera aviso", () => {
    const diaries = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"].map((x) => d(x));
    expect(computeEquipmentAlerts({ today: TODAY, diaries })).toEqual([]);
  });

  it("dia dentro das 72h sem diário vira 'prazo vencendo'", () => {
    const diaries = ["2026-11-14", "2026-11-15", "2026-11-17"].map((x) => d(x));
    const [a] = computeEquipmentAlerts({ today: TODAY, diaries });
    expect(a.expiring).toEqual([{ date: "2026-11-16", daysLeft: 0 }]);
    expect(a.blocked).toEqual([]);
  });

  it("dia fora das 72h sem diário vira 'bloqueado' e respeita liberação do admin", () => {
    const diaries = ["2026-11-10", "2026-11-12", "2026-11-17"].map((x) => d(x));
    const [a] = computeEquipmentAlerts({
      today: TODAY,
      diaries,
      unlockedDates: new Set(["2026-11-13"]),
    });
    expect(a.assumedSince).toBe("2026-11-10");
    expect(a.blocked).toEqual([
      { date: "2026-11-11", unlocked: false },
      { date: "2026-11-13", unlocked: true },
      { date: "2026-11-14", unlocked: false },
      { date: "2026-11-15", unlocked: false },
    ]);
  });

  it("não cobra dias antes do 1º diário nem o dia de hoje", () => {
    const [a] = computeEquipmentAlerts({ today: TODAY, diaries: [d("2026-11-16")] });
    expect(a.assumedSince).toBe("2026-11-16");
    expect(a.expiring).toEqual([{ date: "2026-11-17", daysLeft: 1 }]);
  });

  it("ignora frota que ele não opera há mais de 14 dias", () => {
    expect(computeEquipmentAlerts({ today: TODAY, diaries: [d("2026-10-20")] })).toEqual([]);
  });

  it("separa por frota", () => {
    const diaries = [d("2026-11-16", "A1"), d("2026-11-18", "A1"), d("2026-11-16", "B2"), d("2026-11-17", "B2")];
    const res = computeEquipmentAlerts({ today: TODAY, diaries });
    expect(res.map((r) => r.fleet)).toEqual(["A1"]);
  });
});

describe("computeRdoAlerts", () => {
  it("cobra só dias úteis dentro do prazo", () => {
    // hoje seg 2026-11-16: anteontem sáb 14, ontem dom 15 (e feriado) => nada
    expect(
      computeRdoAlerts({ today: "2026-11-16", rdoDates: new Set(), lastRdoDate: "2026-11-13" }),
    ).toEqual([]);
  });

  it("dia útil sem RDO é cobrado", () => {
    const res = computeRdoAlerts({ today: TODAY, rdoDates: new Set(["2026-11-17"]), lastRdoDate: "2026-11-17" });
    expect(res).toEqual([{ date: "2026-11-16", daysLeft: 0 }]);
  });

  it("quem não lança RDO há mais de 30 dias não é cobrado", () => {
    expect(computeRdoAlerts({ today: TODAY, rdoDates: new Set(), lastRdoDate: "2026-09-01" })).toEqual([]);
    expect(computeRdoAlerts({ today: TODAY, rdoDates: new Set(), lastRdoDate: null })).toEqual([]);
  });
});

describe("helpers", () => {
  it("feriado e fim de semana são não úteis", () => {
    expect(isNonWorkingDay("2026-11-20")).toBe(true);
    expect(isNonWorkingDay("2026-11-21")).toBe(true);
    expect(isNonWorkingDay("2026-11-19")).toBe(false);
  });
  it("compactRanges agrupa consecutivos", () => {
    expect(compactRanges(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-07"])).toEqual([
      "01/11/26 a 03/11/26",
      "07/11/26",
    ]);
  });

  const d = (date: string) => ({ fleet: "BC75", date });
  it("aviso de dias sem diário só olha os últimos 10 dias (não 'desde que assumiu')", () => {
    const [a] = computeEquipmentAlerts({ today: TODAY, diaries: [d("2026-10-30"), d("2026-11-17")] });
    expect(a.blocked.every((b) => b.date >= "2026-11-07")).toBe(true);
    expect(a.blocked.map((b) => b.date)).not.toContain("2026-11-05");
  });
});

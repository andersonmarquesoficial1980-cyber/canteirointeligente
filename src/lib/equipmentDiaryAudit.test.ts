import { describe, expect, it } from "vitest";
import { assessMeter, dailyCoverage, suggestFleet, type MeterDiary } from "./equipmentDiaryAudit";

const row = (overrides: Partial<MeterDiary> = {}): MeterDiary => ({
  id: "a", equipment_fleet: "CC02", date: "2026-10-01", period: "diurno", created_at: "2026-10-01T20:00:00Z",
  status: "enviado", is_auto: false, odometer_initial: 222, odometer_final: 233,
  meter_initial: null, meter_final: null, ...overrides,
});

describe("equipment diary audit", () => {
  it("suggests the preceding final without inventing a gap on idle days", () => {
    const result = assessMeter([row()], { fleet: "CC02", date: "2026-10-05", period: "diurno", kind: "odometer", initial: 233, final: 233 });
    expect(result.previous?.final).toBe(233);
    expect(result.issue).toBeNull();
  });
  it("flags any different initial, including regression, regardless of configured large thresholds", () => {
    expect(assessMeter([row()], { fleet: "CC02", date: "2026-10-02", period: "diurno", kind: "odometer", initial: 222 }).issue?.type).toBe("regression");
    expect(assessMeter([row()], { fleet: "CC02", date: "2026-10-02", period: "diurno", kind: "odometer", initial: 240 }).issue?.type).toBe("gap");
  });
  it("ignores drafts and automatic diaries and checks successor when inserting an older entry", () => {
    const rows = [row(), row({ id: "auto", date: "2026-10-02", is_auto: true, odometer_final: 999 }), row({ id: "next", date: "2026-10-04", odometer_initial: 240, odometer_final: 250 })];
    const result = assessMeter(rows, { fleet: "CC02", date: "2026-10-03", period: "diurno", kind: "odometer", initial: 233, final: 236 });
    expect(result.previous?.final).toBe(233);
    expect(result.next?.initial).toBe(240);
    expect(result.issue?.type).toBe("next_gap");
  });
  it("checks the preceding reading for a second use in the same turn", () => {
    const first = row({ id: "first", odometer_final: 233 });
    const result = assessMeter([first], { fleet: "CC02", date: "2026-10-01", period: "diurno", kind: "odometer", initial: 230 });
    expect(result.previous?.final).toBe(233);
    expect(result.issue?.type).toBe("regression");
  });
  it("identifies a candidate fleet without switching it automatically", () => {
    const candidates = suggestFleet([row(), row({ id: "b", equipment_fleet: "CC21", odometer_final: 500 })],
      { fleet: "CC21", date: "2026-10-02", period: "diurno", kind: "odometer", initial: 233 }, ["CC02", "CC21"]);
    expect(candidates).toEqual(["CC02"]);
  });
  it("counts every calendar day, including weekends, in February and lets a day have multiple diaries", () => {
    const coverage = dailyCoverage("2028-02-01", "2028-02-29", [row({ date: "2028-02-01" }), row({ id: "b", date: "2028-02-01", period: "noturno" })], "2028-03-01");
    expect(coverage.length).toBe(29);
    expect(coverage[0].count).toBe(2);
    expect(coverage[1].count).toBe(0);
    expect(coverage[28].count).toBe(0);
  });
  it("does not mark today or future dates overdue and never counts automatic entries", () => {
    const coverage = dailyCoverage("2026-10-05", "2026-10-07", [row({ date: "2026-10-05", is_auto: true })], "2026-10-06");
    expect(coverage.map(day => day.state)).toEqual(["missing", "pending", "future"]);
  });
});

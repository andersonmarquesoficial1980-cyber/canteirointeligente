import { describe, expect, it } from "vitest";
import { assessMeter, dailyCoverage, eligibleFleetCoverage, findMeterGaps, suggestFleet, type MeterDiary } from "./equipmentDiaryAudit";

const row = (overrides: Partial<MeterDiary> = {}): MeterDiary => ({
  id: "a", equipment_fleet: "CC02", date: "2026-10-01", period: "diurno", created_at: "2026-10-01T20:00:00Z",
  status: "enviado", is_auto: false, odometer_initial: 222, odometer_final: 233,
  meter_initial: null, meter_final: null, ...overrides,
});

describe("equipment diary audit", () => {
  it("detects the first day gap against the last earlier baseline and does not report the baseline itself", () => {
    const baseline = row({ id: "old", date: "2026-09-30", odometer_final: 233 });
    const october = row({ id: "new", date: "2026-10-01", odometer_initial: 240 });
    expect(findMeterGaps([october], [baseline])).toEqual([{ previous: baseline, current: october, kind: "odometer", difference: 7 }]);
  });
  it("reports one event for each real break, without duplicating it on both neighbouring diaries", () => {
    const rows = [row({ id: "first" }), row({ id: "second", date: "2026-10-02", odometer_initial: 240, odometer_final: 250 }), row({ id: "third", date: "2026-10-03", odometer_initial: 250, odometer_final: 260 })];
    expect(findMeterGaps(rows)).toEqual([{ previous: rows[0], current: rows[1], kind: "odometer", difference: 7 }]);
  });
  it("does not bridge fleets, auto diaries, or drafts", () => {
    const rows = [row(), row({ id: "auto", date: "2026-10-02", is_auto: true, odometer_initial: 233, odometer_final: 500 }), row({ id: "draft", date: "2026-10-02", status: "rascunho", odometer_initial: 500, odometer_final: 500 }), row({ id: "other", equipment_fleet: "CC21", date: "2026-10-03", odometer_initial: 600, odometer_final: 700 })];
    expect(findMeterGaps(rows)).toEqual([]);
  });
  it("flags a regression and supports multiple uses during one turn by submission order", () => {
    const rows = [row({ id: "a" }), row({ id: "b", created_at: "2026-10-01T22:00:00Z", odometer_initial: 220, odometer_final: 225 })];
    expect(findMeterGaps(rows).map(g => g.difference)).toEqual([-13]);
  });
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
  it("starts the daily obligation on registration, but preserves an earlier manual diary as evidence of prior use", () => {
    expect(eligibleFleetCoverage("2026-09-01", "2026-09-30", [], "2026-10-01", "2026-09-11T10:00:00Z").length).toBe(20);
    const coverage = eligibleFleetCoverage("2026-09-01", "2026-09-30", [row({ date: "2026-09-05" })], "2026-10-01", "2026-09-11T10:00:00Z");
    expect(coverage[0].date).toBe("2026-09-05");
  });
  it("does not mark today or future dates overdue and never counts automatic entries", () => {
    const coverage = dailyCoverage("2026-10-05", "2026-10-07", [row({ date: "2026-10-05", is_auto: true })], "2026-10-06");
    expect(coverage.map(day => day.state)).toEqual(["missing", "pending", "future"]);
  });
});

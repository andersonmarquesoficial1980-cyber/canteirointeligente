export interface MeterDiary {
  id: string;
  equipment_fleet: string;
  date: string;
  period: string | null;
  created_at?: string | null;
  status: string | null;
  is_auto?: boolean | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
}
export type MeterKind = "odometer" | "hourmeter";
export interface MeterCandidate {
  fleet: string;
  date: string;
  period: string;
  kind: MeterKind;
  initial?: number | null;
  final?: number | null;
  excludeId?: string;
  created_at?: string | null;
}
export interface MeterIssue {
  type: "regression" | "gap" | "next_regression" | "next_gap" | "invalid";
  expected: number | null;
  actual: number | null;
}
const shift = (v: string | null) => v === "noturno" ? 1 : 0;
const key = (d: { date: string; period: string | null }) => `${d.date}:${shift(d.period)}`;
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export const validDiary = (d: MeterDiary) => d.status === "enviado" && !d.is_auto;
const fields = (kind: MeterKind) => kind === "odometer" ? ["odometer_initial", "odometer_final"] as const : ["meter_initial", "meter_final"] as const;

export function assessMeter(rows: MeterDiary[], candidate: MeterCandidate): {
  previous: { date: string; period: string | null; final: number } | null;
  next: { date: string; period: string | null; initial: number } | null;
  issue: MeterIssue | null;
} {
  const [initialField, finalField] = fields(candidate.kind);
  const relevant = rows.filter(d => validDiary(d) && d.equipment_fleet === candidate.fleet && d.id !== candidate.excludeId)
    .sort((a, b) => key(a).localeCompare(key(b)) || String(a.created_at || "").localeCompare(String(b.created_at || "")) || a.id.localeCompare(b.id));
  // Multiple uses in one shift are valid; creation order disambiguates them when present.
  const target = `${key(candidate)}:${candidate.created_at || "9999"}`;
  const orderedKey = (d: MeterDiary) => `${key(d)}:${d.created_at || ""}`;
  const before = relevant.filter(d => orderedKey(d) < target && finite(d[finalField])).at(-1);
  const after = relevant.find(d => orderedKey(d) > target && finite(d[initialField]));
  const previous = before ? { date: before.date, period: before.period, final: before[finalField] as number } : null;
  const next = after ? { date: after.date, period: after.period, initial: after[initialField] as number } : null;
  let issue: MeterIssue | null = null;
  if (candidate.initial != null && !finite(candidate.initial) || candidate.final != null && !finite(candidate.final) ||
    finite(candidate.initial) && finite(candidate.final) && candidate.final < candidate.initial) {
    issue = { type: "invalid", expected: null, actual: candidate.final ?? candidate.initial ?? null };
  } else if (previous && finite(candidate.initial) && candidate.initial !== previous.final) {
    issue = { type: candidate.initial < previous.final ? "regression" : "gap", expected: previous.final, actual: candidate.initial };
  } else if (next && finite(candidate.final) && candidate.final !== next.initial) {
    issue = { type: candidate.final > next.initial ? "next_regression" : "next_gap", expected: next.initial, actual: candidate.final };
  }
  return { previous, next, issue };
}

export function suggestFleet(rows: MeterDiary[], candidate: MeterCandidate, allowedFleets: string[]): string[] {
  if (!finite(candidate.initial)) return [];
  return allowedFleets.filter(fleet => fleet !== candidate.fleet &&
    assessMeter(rows, { ...candidate, fleet }).previous?.final === candidate.initial).slice(0, 3);
}

export interface CoverageDay { date: string; count: number; state: "complete" | "missing" | "pending" | "future" }
export function dailyCoverage(start: string, end: string, rows: MeterDiary[], today: string): CoverageDay[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return [];
  const counts = new Map<string, number>();
  rows.filter(validDiary).forEach(d => counts.set(d.date, (counts.get(d.date) || 0) + 1));
  const result: CoverageDay[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const finish = new Date(`${end}T12:00:00Z`);
  while (cursor <= finish) {
    const date = cursor.toISOString().slice(0, 10);
    const count = counts.get(date) || 0;
    result.push({ date, count, state: count ? "complete" : date < today ? "missing" : date === today ? "pending" : "future" });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

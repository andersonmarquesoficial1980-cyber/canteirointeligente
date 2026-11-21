// Avisos de prazo de lançamento (Diário de Equipamento e RDO).
// Regra de bloqueio vigente (useDiaryUnlock): hoje + 2 dias anteriores (72h).
// Um dia D deixa de aceitar lançamento no fim de D+2 (fuso America/Sao_Paulo).
// Funções puras: sem acesso a banco, fáceis de testar.

export const DEADLINE_WINDOW_DAYS = 3; // hoje + 2 anteriores
export const EQUIPMENT_LOOKBACK_DAYS = 60; // até onde olhar para trás
export const FLEET_ACTIVE_WITHIN_DAYS = 14; // frota só entra se o último diário dele é recente
export const RDO_ACTIVE_WITHIN_DAYS = 30; // só cobra RDO de quem lança RDO

export function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// Feriados nacionais fixos + móveis de 2026 (RDO não é cobrado nesses dias).
const FERIADOS_NACIONAIS = new Set([
  "2026-01-01", "2026-04-03", "2026-04-21", "2026-05-01", "2026-06-04",
  "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25",
]);

export function isNonWorkingDay(iso: string): boolean {
  const wd = weekday(iso);
  return wd === 0 || wd === 6 || FERIADOS_NACIONAIS.has(iso);
}

/** Dias restantes para lançar o dia `date` (0 = vence hoje, 1 = vence amanhã). */
export function daysLeftToLaunch(date: string, today: string): number {
  return DEADLINE_WINDOW_DAYS - 1 - diffDays(date, today);
}

export interface EquipmentDiaryRef {
  fleet: string;
  date: string;
  equipmentType?: string | null;
}

export interface ExpiringDay {
  date: string;
  daysLeft: number; // 0 = vence hoje, 1 = vence amanhã
}

export interface MissingDay {
  date: string;
  unlocked: boolean; // admin já liberou este dia
}

export interface FleetAlert {
  fleet: string;
  equipmentType: string | null;
  assumedSince: string; // data do 1º diário dele na frota (indício de quando assumiu)
  expiring: ExpiringDay[]; // ainda dá tempo (dentro das 72h)
  blocked: MissingDay[]; // fora do prazo: precisa de liberação do admin
}

export function computeEquipmentAlerts(params: {
  today: string;
  diaries: EquipmentDiaryRef[]; // diários ENVIADOS do próprio usuário
  unlockedDates?: Set<string>; // datas liberadas pelo admin (tipo equipamento)
}): FleetAlert[] {
  const { today, diaries, unlockedDates = new Set<string>() } = params;
  const lookbackStart = shiftIso(today, -EQUIPMENT_LOOKBACK_DAYS);
  const windowStart = shiftIso(today, -(DEADLINE_WINDOW_DAYS - 1));

  const byFleet = new Map<string, { dates: Set<string>; type: string | null }>();
  for (const d of diaries) {
    if (!d.fleet || !d.date || d.date < lookbackStart || d.date > today) continue;
    const entry = byFleet.get(d.fleet) ?? { dates: new Set<string>(), type: null };
    entry.dates.add(d.date);
    if (d.equipmentType) entry.type = d.equipmentType;
    byFleet.set(d.fleet, entry);
  }

  const alerts: FleetAlert[] = [];
  for (const [fleet, { dates, type }] of byFleet) {
    const sorted = [...dates].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    // Frota que ele deixou de operar há muito tempo não gera cobrança.
    if (diffDays(last, today) > FLEET_ACTIVE_WITHIN_DAYS) continue;

    const expiring: ExpiringDay[] = [];
    const blocked: MissingDay[] = [];
    // Do 1º diário dele até ontem; hoje ainda está no prazo normal.
    for (let day = first; day < today; day = shiftIso(day, 1)) {
      if (dates.has(day)) continue;
      if (day >= windowStart) {
        expiring.push({ date: day, daysLeft: daysLeftToLaunch(day, today) });
      } else {
        blocked.push({ date: day, unlocked: unlockedDates.has(day) });
      }
    }
    if (expiring.length || blocked.length) {
      alerts.push({ fleet, equipmentType: type, assumedSince: first, expiring, blocked });
    }
  }
  return alerts.sort((a, b) => a.fleet.localeCompare(b.fleet, "pt-BR"));
}

export function computeRdoAlerts(params: {
  today: string;
  rdoDates: Set<string>; // dias com RDO enviado pelo próprio usuário
  lastRdoDate: string | null; // último RDO enviado dele (para saber se ele ainda lança RDO)
  unlockedDates?: Set<string>;
}): ExpiringDay[] {
  const { today, rdoDates, lastRdoDate, unlockedDates = new Set<string>() } = params;
  if (!lastRdoDate || diffDays(lastRdoDate, today) > RDO_ACTIVE_WITHIN_DAYS) return [];
  const out: ExpiringDay[] = [];
  const windowStart = shiftIso(today, -(DEADLINE_WINDOW_DAYS - 1));
  for (let day = windowStart; day < today; day = shiftIso(day, 1)) {
    if (isNonWorkingDay(day) || rdoDates.has(day) || unlockedDates.has(day)) continue;
    out.push({ date: day, daysLeft: daysLeftToLaunch(day, today) });
  }
  return out;
}

export function formatDayBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function expiryLabel(daysLeft: number): string {
  return daysLeft <= 0 ? "vence hoje às 23:59" : "vence amanhã às 23:59";
}

/** Agrupa datas consecutivas em faixas: ["01/11 a 03/11", "07/11"]. */
export function compactRanges(dates: string[]): string[] {
  const sorted = [...dates].sort();
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && diffDays(sorted[j], sorted[j + 1]) === 1) j++;
    out.push(i === j ? formatDayBR(sorted[i]) : `${formatDayBR(sorted[i])} a ${formatDayBR(sorted[j])}`);
    i = j + 1;
  }
  return out;
}

const STORAGE_KEY = "wf_transporte_legacy_mode_v1";
const ROLLBACK_DAYS_DEFAULT = 7;

type LegacyModePayload = {
  legacyFallbackEnabled: boolean;
  changedAt: string;
  rollbackUntil: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getDefaultPayload(): LegacyModePayload {
  return {
    legacyFallbackEnabled: true,
    changedAt: nowIso(),
    rollbackUntil: null,
  };
}

function readPayload(): LegacyModePayload {
  if (typeof window === "undefined") return getDefaultPayload();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPayload();
    const parsed = JSON.parse(raw) as Partial<LegacyModePayload>;
    return {
      legacyFallbackEnabled: parsed.legacyFallbackEnabled !== false,
      changedAt: parsed.changedAt || nowIso(),
      rollbackUntil: parsed.rollbackUntil ?? null,
    };
  } catch {
    return getDefaultPayload();
  }
}

function writePayload(payload: LegacyModePayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getLegacyModeState(): LegacyModePayload {
  return readPayload();
}

export function isLegacyFallbackEnabled(): boolean {
  return readPayload().legacyFallbackEnabled;
}

export function disableLegacyFallbackWithWindow(days = ROLLBACK_DAYS_DEFAULT) {
  const payload: LegacyModePayload = {
    legacyFallbackEnabled: false,
    changedAt: nowIso(),
    rollbackUntil: addDaysIso(days),
  };
  writePayload(payload);
  return payload;
}

export function enableLegacyFallback() {
  const payload: LegacyModePayload = {
    legacyFallbackEnabled: true,
    changedAt: nowIso(),
    rollbackUntil: null,
  };
  writePayload(payload);
  return payload;
}

export function canRollbackLegacyFallback(now = new Date()): boolean {
  const state = readPayload();
  if (state.legacyFallbackEnabled) return true;
  if (!state.rollbackUntil) return false;
  return new Date(state.rollbackUntil).getTime() >= now.getTime();
}

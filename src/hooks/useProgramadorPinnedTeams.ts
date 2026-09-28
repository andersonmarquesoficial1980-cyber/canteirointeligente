import { useEffect, useRef, useState } from "react";

export const pinnedTeamsKey = (companyId: string, userId: string) => `workflux:programador:equipes-fixadas:v1:${companyId}:${userId}`;
type PinState = { key: string; pinned: string[] };

function allowedNames(input: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set(allowed);
  return [...new Set(input.filter((name): name is string => typeof name === "string" && valid.has(name)))];
}

/** Browser-local preference scoped by BOTH authenticated user and company; never mutates ci_equipes. */
export function useProgramadorPinnedTeams(companyId: string | null, userId: string | null, teams: string[], defaults: string[]) {
  const key = companyId && userId ? pinnedTeamsKey(companyId, userId) : "";
  const [state, setState] = useState<PinState>({ key: "", pinned: [] });
  const [error, setError] = useState("");
  const current = useRef<PinState>(state);
  useEffect(() => {
    if (!key || !teams.length) { current.current = { key: "", pinned: [] }; setState(current.current); return; }
    let saved: string[] | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) saved = allowedNames(JSON.parse(raw), teams);
      setError("");
    } catch { setError("Não foi possível ler os balões salvos neste navegador."); }
    current.current = { key, pinned: saved ?? (allowedNames(defaults, teams) || []) };
    setState(current.current);
  }, [key, teams, defaults]);

  const update = (name: string, operation: "pin" | "unpin") => {
    if (!key || !teams.includes(name) || current.current.key !== key) return;
    const prior = current.current.pinned;
    const next = operation === "pin" ? [...new Set([...prior, name])] : prior.filter(value => value !== name);
    current.current = { key, pinned: next };
    setState(current.current);
    try { localStorage.setItem(key, JSON.stringify(next)); setError(""); }
    catch { setError("Não foi possível salvar os balões neste navegador. A escolha pode se perder ao sair."); }
  };
  return {
    pinned: state.key === key ? state.pinned : [],
    pin: (name: string) => update(name, "pin"),
    unpin: (name: string) => update(name, "unpin"),
    error,
  };
}

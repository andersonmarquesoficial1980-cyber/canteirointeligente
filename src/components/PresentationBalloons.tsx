import { useState } from "react";
import type { BalloonOption } from "@/lib/programadorMeeting";

type Props = {
  title: string;
  groupLabel: string;
  singular: string;
  options: readonly BalloonOption[];
  mode?: "include" | "exclude";
  selected?: readonly string[];
  hidden?: readonly string[];
  allLabel?: string;
  storageKey?: string;
  onToggle: (key: string) => void;
  onReset: () => void;
};

type Saved = { key: string; visible: string[] | null };
function loadVisible(key: string): Saved {
  if (!key) return { key, visible: null };
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { key, visible: null };
    const parsed: unknown = JSON.parse(raw);
    return { key, visible: Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? [...new Set(parsed)] : null };
  } catch { return { key, visible: null }; }
}
const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Shortcuts are display preferences; X never changes the underlying meeting filter. */
export function PresentationBalloons({ title, groupLabel, singular, options, mode = "exclude", selected = [], hidden = [], allLabel = "Todas", storageKey = "", onToggle, onReset }: Props) {
  const [saved, setSaved] = useState<Saved>(() => loadVisible(storageKey));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [saveError, setSaveError] = useState(false);
  const active = mode === "include" ? selected : hidden;
  // Data may arrive after mounting. Derive defaults from current options, not from an initially empty fetch.
  const defaults = [...options].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")).slice(0, 5).map(option => option.key);
  const visible = saved.key === storageKey ? saved.visible ?? defaults : loadVisible(storageKey).visible ?? defaults;
  const visibleSet = new Set(visible);
  const displayed = options.filter(option => visibleSet.has(option.key) || active.includes(option.key));
  const missing = options.filter(option => !visibleSet.has(option.key) && searchable(option.label).includes(searchable(query)));
  const update = (keys: string[]) => {
    const next = [...new Set(keys)];
    setSaved({ key: storageKey, visible: next });
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(false); }
      catch { setSaveError(true); }
    }
  };
  return <div role="group" aria-label={groupLabel} className="relative flex min-w-0 flex-wrap items-center gap-2 border-t border-border/60 pt-2">
    <span className="mr-1 text-xs font-semibold text-muted-foreground">{title}</span>
    {mode === "include" && <button type="button" aria-pressed={selected.length === 0} onClick={onReset}
      className={`rounded-full border px-2.5 py-1 text-xs ${selected.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>{allLabel}</button>}
    {displayed.map(option => {
      const chosen = active.includes(option.key);
      const shortcut = visibleSet.has(option.key);
      const action = mode === "include" ? (chosen ? "Retirar" : "Selecionar") : (chosen ? "Restaurar" : "Ocultar");
      return <span key={option.key} className="relative inline-flex items-center rounded-full border border-border bg-card text-xs">
        <button type="button" aria-pressed={chosen} aria-label={`${action} ${singular} ${option.label}`} onClick={() => onToggle(option.key)}
          className={`rounded-full px-2.5 py-1 pr-3 ${mode === "include"
            ? (chosen ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")
            : (chosen ? "bg-amber-50 text-amber-900 line-through" : "text-foreground hover:bg-muted")}`}>
          {option.label}
        </button>
        {shortcut && <button type="button" aria-label={`Remover balão ${option.label}`} title={`Remover atalho de ${option.label} (não altera o filtro)`}
          onClick={() => update(visible.filter(key => key !== option.key))}
          className="-mr-0.5 -mt-1.5 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive">×</button>}
      </span>;
    })}
    {mode === "exclude" && active.length > 0 && <button type="button" onClick={onReset} className="px-1 text-xs text-primary underline">Restaurar todos</button>}
    <button type="button" aria-label={`Adicionar balão de ${title}`} aria-expanded={adding} onClick={() => { setAdding(value => !value); setQuery(""); }}
      className="rounded-full border border-dashed border-primary px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10">+ Adicionar</button>
    {adding && <div role="group" aria-label={`Opções para adicionar ${title}`} className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[min(90vw,24rem)] rounded-lg border border-border bg-card p-2 shadow-lg">
      <div className="flex items-center gap-2">
        <input type="search" aria-label={`Buscar ${singular} para adicionar`} value={query} onChange={event => setQuery(event.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs" placeholder={`Buscar ${singular}...`} />
        <button type="button" aria-label={`Fechar opções de ${title}`} onClick={() => setAdding(false)} className="px-1 text-sm">×</button>
      </div>
      <div className="mt-2 max-h-48 overflow-y-auto">
        {missing.length ? missing.map(option => <button key={option.key} type="button" aria-label={`Adicionar ${singular} ${option.label}`}
          onClick={() => { update([...visible, option.key]); setQuery(""); }} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted">+ {option.label}</button>)
          : <p className="p-2 text-xs text-muted-foreground">Nenhuma opção disponível.</p>}
      </div>
    </div>}
    {saveError && <span role="alert" className="text-xs text-destructive">Não foi possível salvar os balões neste navegador.</span>}
  </div>;
}

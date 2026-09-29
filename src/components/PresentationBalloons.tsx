import { useState } from "react";
import { Input } from "@/components/ui/input";
import { meetingFilterKey, type BalloonOption } from "@/lib/programadorMeeting";

type Props = {
  title: string;
  groupLabel: string;
  singular: string;
  options: readonly BalloonOption[];
  hidden: readonly string[];
  onToggle: (key: string) => void;
  onReset: () => void;
};

/** Pressed means visible; a dimmed balloon stays clickable to bring the category back. */
export function PresentationBalloons({ title, groupLabel, singular, options, hidden, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  if (!options.length) return null;
  const quick = options.filter((option, index) => index < 4 || hidden.includes(option.key));
  const others = options.filter(option => !quick.includes(option)
    && meetingFilterKey(option.label).includes(meetingFilterKey(query, "")));
  const balloon = (option: BalloonOption) => {
    const excluded = hidden.includes(option.key);
    return <button key={option.key} type="button" aria-pressed={!excluded}
      aria-label={`${excluded ? "Mostrar" : "Ocultar"} ${singular} ${option.label}`}
      title={`${excluded ? "Mostrar" : "Ocultar"} ${singular} ${option.label}`}
      onClick={() => onToggle(option.key)}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${excluded ? "border-border bg-muted text-muted-foreground line-through" : "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20"}`}>
      {option.label} <span className="opacity-70">{option.count}</span>
    </button>;
  };
  return <div className="relative flex min-w-0 flex-col gap-1 border-t border-border/60 pt-1 sm:flex-row sm:items-center" role="group" aria-label={groupLabel}>
    <span className="shrink-0 text-xs font-semibold text-muted-foreground">{title}</span>
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap py-0.5 [scrollbar-width:thin]">
      {quick.map(balloon)}
      {options.length > quick.length && <div className="shrink-0">
        <button type="button" aria-label={`Buscar mais ${groupLabel.toLowerCase()}`} aria-expanded={open}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted" onClick={() => setOpen(value => !value)}>Outros +</button>
      </div>}
      {hidden.length > 0 && <button type="button" onClick={onReset} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-primary hover:bg-muted">Mostrar todos</button>}
    </div>
    {open && <div className="absolute right-0 top-full z-50 mt-1 w-[min(80vw,320px)] rounded-lg border border-border bg-card p-2 shadow-lg">
      <Input autoFocus aria-label={`Buscar ${groupLabel.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} className="h-8" />
      <div className="max-h-48 overflow-y-auto">{others.map(option => <button key={option.key} type="button"
        aria-label={`Ocultar ${singular} ${option.label}`} className="block w-full rounded p-2 text-left text-xs hover:bg-muted"
        onClick={() => { onToggle(option.key); setOpen(false); setQuery(""); }}>{option.label} · {option.count}</button>)}</div>
    </div>}
  </div>;
}

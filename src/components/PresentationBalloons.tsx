import { useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { meetingFilterKey, type BalloonOption } from "@/lib/programadorMeeting";

type Props = {
  title: string;
  groupLabel: string;
  singular: string;
  options: readonly BalloonOption[];
  mode?: "include" | "exclude";
  selected?: readonly string[];
  hidden?: readonly string[];
  allLabel?: string;
  onToggle: (key: string) => void;
  onReset: () => void;
};

/** Complete searchable checklist; choices stay open while a director picks multiple categories. */
export function PresentationBalloons({ title, groupLabel, singular, options, mode = "exclude", selected = [], hidden = [], allLabel = "Todas", onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = mode === "include" ? selected : hidden;
  const match = options.filter(option => meetingFilterKey(option.label).includes(meetingFilterKey(query, "")));
  const labelOf = (key: string) => options.find(option => option.key === key)?.label || key;
  const plural = groupLabel.replace(/^Filtrar\s+/i, "");
  const choiceAction = (chosen: boolean) => mode === "include" ? (chosen ? "Retirar" : "Selecionar") : (chosen ? "Restaurar" : "Ocultar");
  const reset = () => { setQuery(""); onReset(); };
  return <div role="group" aria-label={groupLabel} className="min-w-0 border-t border-border/60 pt-2">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button type="button" aria-label={groupLabel} aria-expanded={open} onClick={() => setOpen(value => !value)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
        {title} <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {mode === "include" && <button type="button" aria-pressed={selected.length === 0} onClick={reset}
        className={`rounded-full border px-3 py-1 text-xs ${selected.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>{allLabel}</button>}
      {mode === "exclude" && active.length === 0 && <span className="text-xs text-muted-foreground">Nenhum oculto</span>}
      {active.map(key => <button type="button" key={key} onClick={() => onToggle(key)}
        aria-label={`${choiceAction(true)} ${singular} ${labelOf(key)}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${mode === "include" ? "border-primary bg-primary text-primary-foreground" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
        {mode === "exclude" && "Oculto: "}{labelOf(key)} <X aria-hidden="true" className="h-3 w-3" />
      </button>)}
      {mode === "exclude" && active.length > 0 && <button type="button" className="text-xs text-primary underline" onClick={reset}>Restaurar todos</button>}
    </div>
    {open && <div role="group" aria-label={`Opções de ${plural}`} className="mt-2 rounded-lg border border-border bg-card p-2 shadow-sm">
      <Input autoFocus aria-label={`Buscar ${singular}`} placeholder={`Buscar ${singular}...`} className="h-8" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="mt-1 max-h-52 overflow-y-auto">
        {match.map(option => {
          const chosen = active.includes(option.key);
          return <button key={option.key} type="button" role="checkbox" aria-checked={chosen}
            aria-label={`${choiceAction(chosen)} ${singular} ${option.label}`} onClick={() => onToggle(option.key)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted">
            <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${chosen ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{chosen && <Check className="h-3 w-3" />}</span>
            <span className="min-w-0 flex-1 break-words">{option.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{option.count}</span>
          </button>;
        })}
        {!match.length && <p className="p-2 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>}
      </div>
    </div>}
  </div>;
}

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
  onToggle: (key: string) => void;
  onReset: () => void;
};

/** One stable row of choices. Selection changes emphasis, never removes an option. */
export function PresentationBalloons({ title, groupLabel, singular, options, mode = "exclude", selected = [], hidden = [], allLabel = "Todas", onToggle, onReset }: Props) {
  const active = mode === "include" ? selected : hidden;
  return <div role="group" aria-label={groupLabel} className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
    <span className="mr-1 text-xs font-semibold text-muted-foreground">{title}</span>
    {mode === "include" && <button type="button" aria-pressed={selected.length === 0} onClick={onReset}
      className={`rounded-full border px-2.5 py-1 text-xs ${selected.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>{allLabel}</button>}
    {options.map(option => {
      const chosen = active.includes(option.key);
      const action = mode === "include" ? (chosen ? "Retirar" : "Selecionar") : (chosen ? "Restaurar" : "Ocultar");
      return <button key={option.key} type="button" aria-pressed={chosen}
        aria-label={`${action} ${singular} ${option.label}`} onClick={() => onToggle(option.key)}
        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${mode === "include"
          ? (chosen ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50")
          : (chosen ? "border-amber-500 bg-amber-50 text-amber-900 line-through" : "border-border bg-card text-foreground hover:border-amber-500")}`}>
        {option.label}
      </button>;
    })}
    {mode === "exclude" && active.length > 0 && <button type="button" onClick={onReset} className="px-2 text-xs text-primary underline">Restaurar todos</button>}
  </div>;
}

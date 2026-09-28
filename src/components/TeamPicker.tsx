import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  teams: string[];
  featured?: string[];
  pinned?: string[];
  value: string;
  onChange: (value: string) => void;
  onPin?: (name: string) => void;
  onUnpin?: (name: string) => void;
  allowAll?: boolean;
  allowNoTeam?: boolean;
};
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function rankTeamsByAllocation(teams: readonly string[], people: readonly { equipe: string | null }[], equipment: readonly { setor: string | null }[]) {
  const counts = new Map<string, number>();
  for (const person of people) if (person.equipe) counts.set(person.equipe, (counts.get(person.equipe) || 0) + 1);
  for (const item of equipment) if (item.setor) counts.set(item.setor, (counts.get(item.setor) || 0) + 1);
  return [...teams].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, "pt-BR"));
}

/** Pins change only local shortcuts, never the underlying team catalog or active selection. */
export function TeamPicker({ teams, featured, pinned, value, onChange, onPin, onUnpin, allowAll = false, allowNoTeam = false }: Props) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const customizable = Boolean(onPin && onUnpin);
  const quick = useMemo(() => {
    const list: Array<[string, string]> = [];
    if (allowAll) list.push(["", "Todas as equipes"]);
    if (allowNoTeam) list.push(["__sem_equipe__", "Sem equipe"]);
    const eligible = new Set(teams);
    if (pinned !== undefined) {
      for (const name of pinned) if (eligible.has(name) && !list.some(([id]) => id === name)) list.push([name, name]);
    } else {
      if (value && value !== "__sem_equipe__") list.push([value, value]);
      for (const name of (featured || teams).filter(name => eligible.has(name)).slice(0, 4)) {
        if (!list.some(([id]) => id === name)) list.push([name, name]);
      }
    }
    return list;
  }, [teams, featured, pinned, value, allowAll, allowNoTeam]);
  const selectedOutsidePins = pinned !== undefined && value && value !== "__sem_equipe__" && !quick.some(([id]) => id === value);
  const choices = useMemo(() => teams.filter(name => normalized(name).includes(normalized(query.trim()))
    && (!addOpen || !pinned?.includes(name))), [teams, query, addOpen, pinned]);
  useEffect(() => {
    if (!open && !addOpen) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) { setOpen(false); setAddOpen(false); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, addOpen]);
  const close = () => { setOpen(false); setAddOpen(false); setQuery(""); };
  const select = (id: string) => { onChange(id); close(); };
  return (
    <div className="relative flex min-w-0 items-center gap-1.5" ref={container} onKeyDown={event => { if (event.key === "Escape") close(); }}>
      <div role="group" aria-label="Equipes em destaque" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1.5 [scrollbar-width:thin]">
        {selectedOutsidePins && <span className="shrink-0 text-[11px] text-muted-foreground" title={value}>Atual: {value}</span>}
        {quick.map(([id, label]) => {
          const removable = customizable && id !== "" && id !== "__sem_equipe__";
          return <span key={id} className={`relative inline-flex shrink-0 items-center rounded-full border text-xs leading-none transition-colors ${value === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"}`}>
            <button type="button" aria-pressed={value === id} onClick={() => select(id)} className={`rounded-full py-1.5 pl-3 ${removable ? "pr-8" : "pr-3"}`}>{label}</button>
            {removable && <button type="button" aria-label={`Remover balão ${label}`} title={`Remover balão ${label}`} onClick={() => onUnpin?.(id)}
              className={`absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ${value === id ? "hover:bg-white/20" : "text-muted-foreground hover:bg-muted"}`}>
              <X aria-hidden="true" className="h-3 w-3" />
            </button>}
          </span>;
        })}
        {!quick.length && !selectedOutsidePins && <span className="shrink-0 text-xs text-muted-foreground">Use + para fixar equipes</span>}
      </div>
      {customizable && <button type="button" aria-label="Adicionar balão de equipe" title="Adicionar balão de equipe" aria-expanded={addOpen}
        onClick={() => { setAddOpen(v => !v); setOpen(false); setQuery(""); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-primary/50 text-primary hover:bg-primary/5">
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>}
      <button type="button" aria-label="Buscar outra equipe" aria-expanded={open} onClick={() => { setOpen(v => !v); setAddOpen(false); setQuery(""); }}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground hover:border-primary/40">
        Outras equipes <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {(open || addOpen) && <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(90vw,380px)] rounded-xl border border-border bg-card p-2 shadow-xl">
        <label className="relative block text-xs text-muted-foreground"><Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4" />
          <Input autoFocus aria-label={addOpen ? "Buscar equipe para fixar" : "Buscar equipe"} placeholder="Buscar equipe..." className="h-9 pl-8" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto" aria-label="Lista completa de equipes">
          {choices.map(name => <button key={name} type="button" aria-label={addOpen ? `Fixar ${name}` : undefined}
            onClick={() => { if (addOpen) { onPin?.(name); close(); } else select(name); }}
            className={`block w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted ${value === name ? "font-semibold text-primary" : "text-foreground"}`}>
            {addOpen ? `+ ${name}` : name}</button>)}
          {choices.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhuma equipe disponível.</p>}
        </div>
      </div>}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  teams: string[];
  featured?: string[];
  value: string;
  onChange: (value: string) => void;
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

/** A single-row shortcut strip plus searchable access to every available team. */
export function TeamPicker({ teams, featured, value, onChange, allowAll = false, allowNoTeam = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const quick = useMemo(() => {
    const list: Array<[string, string]> = [];
    if (allowAll) list.push(["", "Todas as equipes"]);
    if (allowNoTeam) list.push(["__sem_equipe__", "Sem equipe"]);
    if (value && value !== "__sem_equipe__") list.push([value, value]);
    const eligible = new Set(teams);
    const favorites = (featured || teams).filter(name => eligible.has(name)).slice(0, 4);
    for (const name of favorites) if (!list.some(([id]) => id === name)) list.push([name, name]);
    return list;
  }, [teams, featured, value, allowAll, allowNoTeam]);
  const choices = useMemo(() => teams.filter(name => normalized(name).includes(normalized(query.trim()))), [teams, query]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const select = (id: string) => { onChange(id); setOpen(false); setQuery(""); };
  return (
    <div className="relative flex min-w-0 items-center gap-2" ref={container} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <div role="group" aria-label="Equipes em destaque" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:thin]">
        {quick.map(([id, label]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => select(id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs leading-none transition-colors ${value === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"}`}>
          {label}
        </button>)}
      </div>
      <button type="button" aria-label="Buscar outra equipe" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground hover:border-primary/40">
        Outras equipes <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open && <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(90vw,380px)] rounded-xl border border-border bg-card p-2 shadow-xl">
        <label className="relative block text-xs text-muted-foreground"><Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4" />
          <Input autoFocus aria-label="Buscar equipe" placeholder="Buscar equipe..." className="h-9 pl-8" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto" aria-label="Lista completa de equipes">
          {choices.map(name => <button key={name} type="button" onClick={() => select(name)}
            className={`block w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-muted ${value === name ? "font-semibold text-primary" : "text-foreground"}`}>{name}</button>)}
          {choices.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhuma equipe encontrada.</p>}
        </div>
      </div>}
    </div>
  );
}

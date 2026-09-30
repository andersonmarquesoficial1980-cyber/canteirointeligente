import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamPicker } from "@/components/TeamPicker";
import { filterRosterPeople, filterRosterEquipment, type RosterPerson, type RosterEquipment, type PersonDraft, type EquipmentDraft } from "@/lib/programadorRoster";
import { excludeReturnedFleet } from "@/lib/programadorTeams";
import { summarizeTeamRental } from "@/lib/programadorIndividual";

type Props = {
  kind: "funcionarios" | "equipamentos";
  people: RosterPerson[]; equipment: RosterEquipment[]; teams: string[];
  saving: boolean; error: string; initialSelectedId?: string;
  onSavePerson: (id: string, draft: PersonDraft) => Promise<void>;
  onSaveEquipment: (id: string, draft: EquipmentDraft) => Promise<void>;
  onSavePrice: (id: string, text: string) => Promise<number>;
  onDirtyChange?: (dirty: boolean) => void;
  pinnedTeams?: string[];
  onPin?: (team: string) => void;
  onUnpin?: (team: string) => void;
  onPresent?: (team: string) => void;
  pinsError?: string;
};
const personStatuses = [
  ["ativo", "Ativo"], ["afastado", "Afastado"], ["ferias", "Férias"], ["demitido", "Demitido"],
];
const equipmentStatuses = [
  ["ativo", "Operacional"], ["em_manutencao", "Manutenção"], ["inoperante", "Inoperante"],
  ["devolver", "Devolver"], ["devolvido", "Devolvido"], ["diaria", "Diária"],
  ["disposicao", "Disposição"], ["inativo", "Inativo"],
];
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RosterFilterChips({ label, allLabel, options, value, disabled, onChange, wrap = false }: {
  label: string; allLabel: string; options: readonly (readonly string[])[];
  value: string; disabled: boolean; onChange: (value: string) => void; wrap?: boolean;
}) {
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-1 text-xs text-muted-foreground">{label}</legend>
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : "min-w-0 overflow-x-auto whitespace-nowrap py-1 [scrollbar-width:thin]"}`}>
      {[["", allLabel], ...options].map(([key, name]) => <button key={key} type="button"
        aria-pressed={value === key} onClick={() => onChange(key)}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs ${value === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
        {name}
      </button>)}
    </div>
  </fieldset>;
}

/** The full master catalog is filtered first; only rendering is paged. */
export function ProgramadorRoster({ kind, people, equipment, teams, saving, error, initialSelectedId, onSavePerson, onSaveEquipment, onSavePrice, onDirtyChange, pinnedTeams, onPin, onUnpin, onPresent, pinsError }: Props) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [team, setTeam] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [visibleCount, setVisibleCount] = useState(40);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [teamDraft, setTeamDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [priceDraft, setPriceDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedPerson = kind === "funcionarios" ? people.find(p => p.id === selectedId) : undefined;
  const selectedEquipment = kind === "equipamentos" ? equipment.find(e => e.id === selectedId) : undefined;
  const selected = selectedPerson || selectedEquipment;
  const savedPrice = selectedEquipment?.valor_mensal == null ? "" : String(selectedEquipment.valor_mensal).replace(".", ",");
  const rowDirty = !!selected && (teamDraft !== ((selectedPerson?.equipe ?? selectedEquipment?.setor) || "")
    || statusDraft !== (selected.status || ""));
  const priceDirty = !!selectedEquipment && priceDraft !== savedPrice;
  const dirty = rowDirty || priceDirty;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const filteredPeople = useMemo(() => filterRosterPeople(people, { search, role, team, status, sort }), [people, search, role, team, status, sort]);
  const filteredEquipment = useMemo(() => filterRosterEquipment(equipment, { search, type, team, status, sort }), [equipment, search, type, team, status, sort]);
  const rentalSummary = useMemo(() => summarizeTeamRental(excludeReturnedFleet(filteredEquipment)), [filteredEquipment]);
  const rows = kind === "funcionarios" ? filteredPeople : filteredEquipment;
  useEffect(() => {
    if (!initialSelectedId) return;
    const row = kind === "funcionarios" ? people.find(p => p.id === initialSelectedId) : equipment.find(e => e.id === initialSelectedId);
    if (!row) return;
    if (!rows.some(item => item.id === initialSelectedId)) {
      setSearch(""); setRole(""); setType(""); setTeam(""); setStatus(""); setVisibleCount(40);
    }
    setSelectedId(initialSelectedId);
    setTeamDraft(("equipe" in row ? row.equipe : row.setor) || "");
    setStatusDraft(row.status || "");
    setPriceDraft("valor_mensal" in row && row.valor_mensal != null ? String(row.valor_mensal).replace(".", ",") : "");
  // Re-focus only on explicit selection changes; ordinary filters must not reset themselves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedId, kind]);
  useEffect(() => {
    if (selectedId) {
      const index = rows.findIndex(row => row.id === selectedId);
      if (index >= visibleCount) setVisibleCount(index + 1);
    }
  }, [selectedId, rows, visibleCount]);

  const roles = useMemo(() => [...new Set(people.map(p => p.role?.trim()).filter((v): v is string => !!v))].sort((a,b) => a.localeCompare(b,"pt-BR")), [people]);
  const types = useMemo(() => [...new Set(equipment.map(e => e.tipo?.trim()).filter((v): v is string => !!v))].sort((a,b) => a.localeCompare(b,"pt-BR")), [equipment]);
  const allTeams = useMemo(() => [...new Set([...teams, ...people.map(p => p.equipe || ""), ...equipment.map(e => e.setor || "")].filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR")), [teams, people, equipment]);

  const openRow = (row: RosterPerson | RosterEquipment) => {
    if (dirty && !window.confirm("Descartar alterações não salvas neste registro?")) return;
    setSelectedId(row.id);
    setTeamDraft(("equipe" in row ? row.equipe : row.setor) || "");
    setStatusDraft(row.status || "");
    setPriceDraft("valor_mensal" in row && row.valor_mensal != null ? String(row.valor_mensal).replace(".", ",") : "");
    setNotice("");
  };
  const closeRow = () => { setSelectedId(null); setNotice(""); onDirtyChange?.(false); };
  const saveRow = async () => {
    if (!selected || !rowDirty || saving || busy || error) return;
    setBusy(true); setNotice("");
    try {
      if (selectedPerson) await onSavePerson(selectedPerson.id, { equipe: teamDraft, status: statusDraft });
      else if (selectedEquipment) await onSaveEquipment(selectedEquipment.id, { setor: teamDraft, status: statusDraft });
    } catch (cause) { setNotice((cause as Error).message || "Não foi possível salvar."); }
    finally { setBusy(false); }
  };
  const savePrice = async () => {
    if (!selectedEquipment || !priceDirty || rowDirty || saving || busy || error) return;
    setBusy(true); setNotice("");
    try {
      const saved = await onSavePrice(selectedEquipment.id, priceDraft);
      setPriceDraft(String(saved).replace(".", ","));
    } catch (cause) { setNotice((cause as Error).message || "Não foi possível salvar o valor."); }
    finally { setBusy(false); }
  };
  const statusOptions = kind === "funcionarios" ? personStatuses : equipmentStatuses;
  const rendered = rows.slice(0, visibleCount);
  return (
    <section className="space-y-3" aria-label={kind === "funcionarios" ? "Lista de funcionários" : "Lista de equipamentos"}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h2 className="text-lg font-bold">{kind === "funcionarios" ? "Funcionários" : "Equipamentos"}</h2>
          <p className="text-xs text-muted-foreground">{rows.length} de {kind === "funcionarios" ? people.length : equipment.length} registros · Cadastro central · Clique em Gerenciar para alterar equipe, status{kind === "equipamentos" ? " ou valor mensal" : ""}.</p></div>
        {onPresent && <Button type="button" variant="outline" size="sm" disabled={saving || busy || dirty || !!error}
          onClick={() => onPresent(team === "__sem__" ? "__sem_equipe__" : team)}>Apresentar lista</Button>}
      </div>
      {error && <p role="alert" className="border border-red-300 bg-red-50 text-red-800 rounded-md p-2 text-sm">Dados indisponíveis: {error}</p>}
      {pinsError && <p role="alert" className="border border-amber-300 bg-amber-50 text-amber-800 rounded-md p-2 text-sm">{pinsError}</p>}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <fieldset disabled={dirty || saving || busy || !!error} className="min-w-0">
          <legend className="mb-1 text-xs text-muted-foreground">Filtrar por equipe</legend>
          <TeamPicker teams={allTeams} pinned={pinnedTeams} value={team === "__sem__" ? "__sem_equipe__" : team}
            onChange={value => { setTeam(value === "__sem_equipe__" ? "__sem__" : value); setVisibleCount(40); }}
            onPin={onPin} onUnpin={onUnpin} allowAll allowNoTeam />
        </fieldset>
        {kind === "funcionarios"
          ? <RosterFilterChips label="Filtrar por função" allLabel="Todas as funções" options={roles.map(name => [name, name])}
              value={role} disabled={dirty || saving || busy || !!error} onChange={value => { setRole(value); setVisibleCount(40); }} />
          : <RosterFilterChips label="Filtrar por tipo" allLabel="Todos os tipos" options={types.map(name => [name, name])}
              value={type} disabled={dirty || saving || busy || !!error} onChange={value => { setType(value); setVisibleCount(40); }} />}
        <RosterFilterChips label="Filtrar por status" allLabel="Todos os status" options={statusOptions}
          value={status} disabled={dirty || saving || busy || !!error} wrap onChange={value => { setStatus(value); setVisibleCount(40); }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground sm:col-span-2">{kind === "funcionarios" ? "Buscar funcionário" : "Buscar frota, placa ou equipamento"}
          <Input className="h-8 mt-1" value={search} disabled={dirty} onChange={e => { setSearch(e.target.value); setVisibleCount(40); }} placeholder={kind === "funcionarios" ? "Nome, matrícula ou função" : "Frota, centro de custo, placa, tipo"} />
        </label>
        <label className="text-xs text-muted-foreground">{kind === "funcionarios" ? "Ordem alfabética" : "Ordenar por frota"}
          <select className="block w-full h-8 mt-1 border border-input rounded-md bg-background px-2 text-sm text-foreground" value={sort} disabled={dirty} onChange={e => setSort(e.target.value as "asc" | "desc")}>
            <option value="asc">A → Z</option><option value="desc">Z → A</option>
          </select>
        </label>
        </div>
      </div>
      <div className="space-y-1.5">
        {rendered.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum registro corresponde aos filtros.</p>}
        {rendered.map(row => {
          const person = kind === "funcionarios" ? row as RosterPerson : null;
          const eq = kind === "equipamentos" ? row as RosterEquipment : null;
          const label = person?.name || eq?.centro_custo || eq?.frota || eq?.placa || "Equipamento sem código";
          const actionLabel = person?.name || eq?.frota || label;
          const thirdParty = (eq?.condicao || "").trim().toUpperCase() === "TERCEIRO";
          const displayedStatus = statusOptions.find(([value]) => value === row.status)?.[1] || row.status || "Status não informado";
          const expanded = selectedId === row.id;
          return <article key={row.id} className={`rounded-lg border bg-card p-2.5 ${expanded ? "border-primary" : "border-border"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm break-words">{label}{eq && eq.frota && eq.centro_custo && eq.frota !== eq.centro_custo ? <span className="text-xs font-normal text-muted-foreground"> · {eq.frota}</span> : null}</p>
                <p className="text-xs text-muted-foreground">{person ? `${person.matricula || "Sem matrícula"} · ${person.role || "Sem função"}` : `${eq?.tipo || "Sem tipo"} · ${thirdParty ? "Terceiro" : eq?.condicao === "PROPRIO" ? "Próprio" : eq?.condicao || "Condição não informada"}`}
                  {" · "}{(person?.equipe || eq?.setor) || "Sem equipe"}{" · "}{displayedStatus}
                  {thirdParty ? ` · ${eq?.valor_mensal == null ? "Valor mensal não cadastrado" : `${brl(eq.valor_mensal)}/mês`}` : ""}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" disabled={saving || busy || !!error} onClick={() => expanded ? closeRow() : openRow(row)} aria-label={expanded ? (dirty ? `Descartar alterações de ${actionLabel}` : `Fechar ${actionLabel}`) : `Gerenciar ${actionLabel}`}>{expanded ? (dirty ? "Descartar" : "Fechar") : "Gerenciar"}</Button>
            </div>
            {expanded && <div className="mt-3 border-t border-border pt-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_120px] gap-2 items-end">
                <label className="text-xs text-muted-foreground">Equipe / setor de {actionLabel}
                  <select className="block w-full h-8 mt-1 border border-input rounded-md bg-background px-2 text-sm text-foreground" value={teamDraft} disabled={saving || busy || !!error} onChange={e => setTeamDraft(e.target.value)}>
                    <option value="">Sem equipe</option>{[...new Set([...teams, (person?.equipe || eq?.setor) || ""].filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR")).map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Status de {actionLabel}
                  <select className="block w-full h-8 mt-1 border border-input rounded-md bg-background px-2 text-sm text-foreground" value={statusDraft} disabled={saving || busy || !!error} onChange={e => setStatusDraft(e.target.value)}>
                    {statusOptions.map(([value,text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
                <Button type="button" size="sm" className="h-8" disabled={!rowDirty || saving || busy || !!error} onClick={saveRow} aria-label={`Salvar ${actionLabel}`}>{busy ? "Salvando..." : "Salvar"}</Button>
              </div>
              {thirdParty && eq && <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs text-muted-foreground">Valor mensal {actionLabel}
                  <Input className="h-8 mt-1 w-44" inputMode="decimal" value={priceDraft} disabled={saving || busy || !!error} placeholder="Ex.: 1.234,56" onChange={e => setPriceDraft(e.target.value)} />
                </label>
                <Button type="button" variant="outline" size="sm" className="h-8" disabled={!priceDirty || rowDirty || !priceDraft.trim() || saving || busy || !!error} onClick={savePrice} aria-label={`Salvar valor mensal ${actionLabel}`}>Salvar valor mensal</Button>
              </div>}
              {notice && <p role="alert" className="text-xs text-destructive">{notice}</p>}
              <p className="text-[11px] text-muted-foreground">As alterações são gravadas no cadastro central com histórico. Nenhuma data ou origem/destino precisa ser informada.</p>
            </div>}
          </article>;
        })}
        {rows.length > visibleCount && <Button type="button" variant="outline" className="w-full" disabled={dirty} onClick={() => setVisibleCount(v => v + 40)}>Mostrar mais ({rows.length - visibleCount} restantes)</Button>}
      </div>
      {!error && <footer role="region" aria-label="Resumo da lista filtrada" className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        {kind === "funcionarios" ? <span>Pessoas <strong className="tabular-nums">{filteredPeople.length}</strong></span> : <>
          <span>Equipamentos <strong className="tabular-nums">{filteredEquipment.length}</strong></span>
          <span>Terceiros não devolvidos <strong className="tabular-nums">{rentalSummary.rented}</strong></span>
          <span>Mensal conhecido <strong className="tabular-nums">{brl(rentalSummary.monthlyKnown)}</strong></span>
          <span>Sem valor <strong className="tabular-nums">{rentalSummary.withoutPrice}</strong></span>
        </>}
      </footer>}
    </section>
  );
}

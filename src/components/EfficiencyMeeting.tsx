import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { groupPeopleForProgramador, groupEquipmentForProgramador } from "@/lib/programadorGroups";
import { balloonOptions, prepareEfficiencyMeeting, meetingFilterKey, meetingStatus, type BalloonOption, type MeetingEquipment, type MeetingPerson } from "@/lib/programadorMeeting";
import { ProgramadorNote } from "@/components/ProgramadorNote";
import { noteKey, type OperationalNotes } from "@/lib/programadorNotes";
import { PresentationBalloons } from "@/components/PresentationBalloons";

type Props = {
  mode?: "equipes" | "funcionarios" | "equipamentos";
  teams?: string[];
  people: MeetingPerson[];
  equipment: MeetingEquipment[];
  initialTeam: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  pinnedTeams?: string[];
  notes?: OperationalNotes;
  notesError?: string;
  updatedAt: string | null;
  error?: string;
  loading?: boolean;
  onRefresh: () => void;
  onExit: () => void;
  onManagePerson?: (id: string) => void;
  onManageEquipment?: (id: string) => void;
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusName: Record<string, string> = {
  operacional: "Operacional", manutencao: "Manutenção", inoperante: "Inoperante",
  devolver: "Devolver", devolvido: "Devolvido", diaria: "Diária", disposicao: "Disposição",
};
const filterNames: [string, string][] = [
  ["todos", "Todos"], ["operacional", "Operacionais"], ["manutencao", "Manutenção"],
  ["disposicao", "Disposição"], ["terceiro", "Terceiros"], ["inoperante", "Inoperantes"],
];
const alphabetic = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const matchesTeam = (value: string | null | undefined, selected: string) => selected === "__sem_equipe__"
  ? !value?.trim() : meetingFilterKey(value) === meetingFilterKey(selected);
function withFacetCounts(options: readonly BalloonOption[], rows: readonly BalloonOption[]): BalloonOption[] {
  const counts = new Map(rows.map(row => [row.key, row.count]));
  return options.map(option => ({ ...option, count: counts.get(option.key) || 0 }));
}

/** Read-only meeting surface: no master writes, drafts, or forms are mounted here. */
export function EfficiencyMeeting({ mode = "equipes", teams, people, equipment, initialTeam, zoom = 100, onZoomChange, pinnedTeams, notes, notesError, updatedAt, error, loading, onRefresh, onExit, onManagePerson, onManageEquipment }: Props) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>(initialTeam ? [initialTeam] : []);
  const [status, setStatus] = useState("todos");
  const [personSearch, setPersonSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [peopleSort, setPeopleSort] = useState("nome-asc");
  const [equipmentSort, setEquipmentSort] = useState("frota-asc");
  const [filterVersion, setFilterVersion] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hiddenCostCenters, setHiddenCostCenters] = useState<string[]>([]);
  const all = useMemo(() => prepareEfficiencyMeeting(mode === "equipamentos" ? [] : people, mode === "funcionarios" ? [] : equipment, {}), [mode, people, equipment]);
  const availableTeams = useMemo(() => {
    const unique = new Map<string, string>();
    for (const name of [...(teams || []), ...all.teams]) if (name.trim() && !unique.has(meetingFilterKey(name))) unique.set(meetingFilterKey(name), name.trim());
    return [...unique.values()];
  }, [teams, all.teams]);
  const base = useMemo(() => ({ teams: selectedTeams, status, selectedRoles, selectedTypes, hiddenCostCenters, personSearch, search: equipmentSearch }),
    [selectedTeams, status, selectedRoles, selectedTypes, hiddenCostCenters, personSearch, equipmentSearch]);
  // Each facet ignores only itself: option counts respond to every other active filter.
  const teamCounts = useMemo(() => prepareEfficiencyMeeting(all.people, all.equipment,
    { teams: [], status, selectedRoles, selectedTypes, hiddenCostCenters, personSearch, search: equipmentSearch }),
  [all.people, all.equipment, status, selectedRoles, selectedTypes, hiddenCostCenters, personSearch, equipmentSearch]);
  const teamOptions = useMemo(() => {
    const names = [...availableTeams].sort((a, b) => {
      const ap = pinnedTeams?.some(team => meetingFilterKey(team) === meetingFilterKey(a)) ? 0 : 1;
      const bp = pinnedTeams?.some(team => meetingFilterKey(team) === meetingFilterKey(b)) ? 0 : 1;
      return ap - bp || alphabetic.compare(a, b);
    });
    return [{ key: "__sem_equipe__", label: "Sem equipe", count: teamCounts.people.filter(p => !p.equipe?.trim()).length + teamCounts.equipment.filter(e => !e.setor?.trim()).length },
      ...names.map(name => ({ key: name, label: name, count: teamCounts.people.filter(p => matchesTeam(p.equipe, name)).length + teamCounts.equipment.filter(e => matchesTeam(e.setor, name)).length }))];
  }, [availableTeams, pinnedTeams, teamCounts.people, teamCounts.equipment]);
  const roleOptions = useMemo(() => withFacetCounts(balloonOptions(all.people, p => p.role, "__sem_funcao__", "Sem função").sort((a, b) => alphabetic.compare(a.label, b.label)),
    balloonOptions(prepareEfficiencyMeeting(all.people, [], { teams: selectedTeams, status, selectedRoles: [], hiddenCostCenters, personSearch }).people, p => p.role, "__sem_funcao__", "Sem função")),
  [all.people, selectedTeams, status, hiddenCostCenters, personSearch]);
  const typeOptions = useMemo(() => withFacetCounts(balloonOptions(all.equipment, e => e.tipo, "__sem_tipo__", "Sem tipo").sort((a, b) => alphabetic.compare(a.label, b.label)),
    balloonOptions(prepareEfficiencyMeeting([], all.equipment, { teams: selectedTeams, status, selectedTypes: [], hiddenCostCenters, search: equipmentSearch }).equipment, e => e.tipo, "__sem_tipo__", "Sem tipo")),
  [all.equipment, selectedTeams, status, hiddenCostCenters, equipmentSearch]);
  const costOptions = useMemo(() => {
    const withoutCost = prepareEfficiencyMeeting(all.people, all.equipment,
      { teams: selectedTeams, status, selectedRoles, selectedTypes, personSearch, search: equipmentSearch });
    return withFacetCounts(balloonOptions([...all.people, ...all.equipment], row => row.centro_custo, "__sem_centro__", "Sem centro de custo").sort((a, b) => alphabetic.compare(a.label, b.label)),
      balloonOptions([...withoutCost.people, ...withoutCost.equipment], row => row.centro_custo, "__sem_centro__", "Sem centro de custo"));
  }, [all.people, all.equipment, selectedTeams, status, selectedRoles, selectedTypes, personSearch, equipmentSearch]);
  const view = useMemo(() => prepareEfficiencyMeeting(mode === "equipamentos" ? [] : people, mode === "funcionarios" ? [] : equipment, base),
    [mode, people, equipment, base]);
  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (key: string) =>
    setter(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  const orderedPeople = useMemo(() => peopleSort === "operacional"
    ? groupPeopleForProgramador(view.people).flatMap(group => group.items)
    : [...view.people].sort((a, b) => (peopleSort === "nome-desc" ? -1 : 1) * alphabetic.compare(a.name || "", b.name || "") || alphabetic.compare(a.matricula || "", b.matricula || "")), [view.people, peopleSort]);
  const orderedEquipment = useMemo(() => equipmentSort === "operacional"
    ? groupEquipmentForProgramador(view.equipment).flatMap(group => group.items)
    : [...view.equipment].sort((a, b) => {
      const field = equipmentSort === "tipo" ? "tipo" : "frota";
      return (equipmentSort === "frota-desc" ? -1 : 1) * alphabetic.compare(a[field] || a.centro_custo || "", b[field] || b.centro_custo || "") || alphabetic.compare(a.frota || "", b.frota || "");
    }), [view.equipment, equipmentSort]);
  const comparison = selectedTeams.length >= 2;
  const groups = comparison ? selectedTeams : [""];
  const resetFilters = () => {
    setSelectedTeams([]); setSelectedRoles([]); setSelectedTypes([]); setHiddenCostCenters([]);
    setStatus("todos"); setPersonSearch(""); setEquipmentSearch("");
    setPeopleSort("nome-asc"); setEquipmentSort("frota-asc");
    setFilterVersion(value => value + 1);
  };
  return (
    <section className="space-y-2" aria-label={mode === "funcionarios" ? "Apresentação de funcionários" : mode === "equipamentos" ? "Apresentação de equipamentos" : "Reunião de eficiência"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">{mode === "funcionarios" ? "Apresentação de funcionários" : mode === "equipamentos" ? "Apresentação de equipamentos" : "Reunião de eficiência"}</h2>
          <p className="text-xs text-muted-foreground">
            {mode === "funcionarios" ? "Dados do cadastro de Pessoas" : mode === "equipamentos" ? "Dados do cadastro de Frotas" : "Dados dos cadastros de Pessoas e Frotas"} · {updatedAt ? `Atualizados em ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Aguardando consulta"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onZoomChange && <div role="group" aria-label="Zoom da apresentação" className="flex items-center gap-1 rounded-md border border-border px-1">
            <span className="px-1 text-xs font-semibold text-muted-foreground">Zoom</span>
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-lg" aria-label="Diminuir zoom"
              disabled={zoom <= 75} onClick={() => onZoomChange(Math.max(75, zoom - 25))}>−</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 min-w-14 px-1 tabular-nums" aria-label="Restaurar zoom a 100%"
              disabled={zoom === 100} onClick={() => onZoomChange(100)}>{zoom}%</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-lg" aria-label="Aumentar zoom"
              disabled={zoom >= 200} onClick={() => onZoomChange(Math.min(200, zoom + 25))}>+</Button>
          </div>}
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar dados"}</Button>
          <Button type="button" size="sm" variant="outline" onClick={onExit}>Sair da apresentação</Button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">Dados possivelmente incompletos: {error}. Não use estes totais para decisão sem atualizar.</p>}
      {notesError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Observações indisponíveis: {notesError}. Atualize os dados antes da reunião.</p>}
      {!updatedAt && !error && <p role="status" className="text-sm text-muted-foreground">Carregando cadastros...</p>}
      <div className="rounded-xl border border-border bg-card px-3 py-1.5 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{filtersVisible ? "Filtros da apresentação · marque várias equipes para comparar lado a lado"
                : `${selectedTeams.length ? `${selectedTeams.length} equipe(s)` : "Todas as equipes"} · ${mode === "equipamentos" ? (selectedTypes.length ? `${selectedTypes.length} tipo(s)` : "Todos os tipos") : (selectedRoles.length ? `${selectedRoles.length} função(ões)` : "Todas as funções")}${mode === "equipes" ? ` · ${selectedTypes.length ? `${selectedTypes.length} tipo(s)` : "Todos os tipos"}` : ""} · ${hiddenCostCenters.length} centro(s) oculto(s)`}</span>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setFiltersVisible(value => !value)}>{filtersVisible ? "Ocultar filtros" : "Mostrar filtros"}</button>
                <button type="button" className="text-xs font-semibold text-primary underline" onClick={resetFilters}>Limpar filtros e ordenação</button>
              </div>
            </div>
            {filtersVisible && <div className="space-y-1">
            <PresentationBalloons key={`teams-${filterVersion}`} title="Equipes · escolha uma ou mais" groupLabel="Filtrar equipes" singular="equipe"
              options={teamOptions} mode="include" selected={selectedTeams} allLabel="Todas as equipes"
              onToggle={toggle(setSelectedTeams)} onReset={() => setSelectedTeams([])} />
            {mode !== "equipamentos" && <PresentationBalloons key={`roles-${filterVersion}`} title="Funções · escolha o que mostrar" groupLabel="Filtrar funções" singular="função"
              options={roleOptions} mode="include" selected={selectedRoles} allLabel="Todas as funções"
              onToggle={toggle(setSelectedRoles)} onReset={() => setSelectedRoles([])} />}
            {mode !== "funcionarios" && <PresentationBalloons key={`types-${filterVersion}`} title="Tipos · escolha o que mostrar" groupLabel="Filtrar tipos de equipamento" singular="tipo"
              options={typeOptions} mode="include" selected={selectedTypes} allLabel="Todos os tipos"
              onToggle={toggle(setSelectedTypes)} onReset={() => setSelectedTypes([])} />}
            <PresentationBalloons key={`cost-${filterVersion}`} title="Centros de custo · ocultar selecionados" groupLabel="Filtrar centros de custo" singular="centro de custo"
              options={costOptions} hidden={hiddenCostCenters} onToggle={toggle(setHiddenCostCenters)} onReset={() => setHiddenCostCenters([])} />
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              {mode !== "equipamentos" && <>
                <input type="search" aria-label="Buscar funcionário" placeholder="Buscar funcionário, matrícula ou função" value={personSearch}
                  onChange={event => setPersonSearch(event.target.value)} className="h-8 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
                <select aria-label="Ordenação de funcionários" value={peopleSort} onChange={event => setPeopleSort(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                  <option value="nome-asc">Nome A–Z</option><option value="nome-desc">Nome Z–A</option><option value="operacional">Função (ordem operacional)</option>
                </select>
              </>}
              {mode !== "funcionarios" && <>
                <input type="search" aria-label="Buscar equipamento" placeholder="Buscar frota, tipo ou placa" value={equipmentSearch}
                  onChange={event => setEquipmentSearch(event.target.value)} className="h-8 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
                <select aria-label="Ordenação de equipamentos" value={equipmentSort} onChange={event => setEquipmentSort(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                  <option value="frota-asc">Frota A–Z</option><option value="frota-desc">Frota Z–A</option><option value="tipo">Tipo A–Z</option><option value="operacional">Categoria operacional</option>
                </select>
              </>}
            </div>
            {mode !== "funcionarios" && <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1" aria-label="Status dos equipamentos">
              {filterNames.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${status === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
              <div className="ml-auto flex gap-3 text-xs text-muted-foreground" aria-label="Indicadores do filtro atual">
                {mode === "equipes" && <span>Pessoas na equipe <strong className="text-foreground tabular-nums">{view.people.length}</strong></span>}
                <span>Equipamentos no filtro <strong className="text-foreground tabular-nums">{view.equipment.length}</strong></span>
              </div>
            </div>}
            {mode === "funcionarios" && <p className="text-xs text-muted-foreground">Pessoas no filtro <strong className="text-foreground tabular-nums">{view.people.length}</strong></p>}
            </div>}
      </div>
      <div className="min-w-0 space-y-2" data-testid="presentation-content" style={{ zoom: `${zoom}%` }}>
          <div className={`grid grid-cols-1 ${mode === "equipes" && !comparison && zoom < 150 ? "lg:grid-cols-2" : ""} gap-2 items-start`}>
            {mode !== "equipamentos" && <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Pessoas da reunião">
              <h3 className={`border-b border-border px-2 py-1 font-semibold ${mode === "equipes" ? "text-sm" : "text-base"}`}>Pessoas ({view.people.length})</h3>
              <div role={comparison ? "group" : undefined} aria-label={comparison ? "Comparação entre equipes (pessoas)" : undefined}
                className={`grid grid-cols-1 ${comparison && zoom < 175 ? "lg:grid-cols-2" : ""} gap-2 p-1`}>
                {groups.map(group => {
                  const rows = comparison ? orderedPeople.filter(p => matchesTeam(p.equipe, group)) : orderedPeople;
                  const label = teamOptions.find(option => option.key === group)?.label || group;
                  return <div key={group} role={comparison ? "region" : undefined} aria-label={comparison ? `${label} — pessoas` : undefined} className="min-w-0">
                    {comparison && <h4 className="rounded-t-md bg-primary/10 px-2 py-1.5 text-sm font-semibold">{label} · {rows.length} pessoa(s)</h4>}
                    <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                      {rows.length ? <table className={`w-full text-left ${mode === "equipes" ? "text-xs" : "text-sm"}`}><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Nome</th><th className="px-2 py-1">Função</th><th className="px-2 py-1">Status</th>{onManagePerson && <th className="px-2 py-1">Ação</th>}</tr></thead>
                        <tbody>{rows.map(p => <tr key={p.id} className="border-t border-border"><td className="px-2 py-1 font-medium">{p.name} <ProgramadorNote text={notes?.[noteKey("pessoa", p.id)]} label={p.name} /><span className="block text-[11px] text-muted-foreground">{p.matricula || "Sem matrícula"}{!selectedTeams.length && ` · ${p.equipe || "Sem equipe"}`}{mode === "funcionarios" && p.centro_custo && ` · CC: ${p.centro_custo}`}</span></td><td className="px-2 py-1">{p.role || "—"}</td><td className="px-2 py-1">{p.status || "Não informado"}</td>{onManagePerson && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar pessoa ${p.name}`} onClick={() => onManagePerson(p.id)}>Gerenciar</button></td>}</tr>)}</tbody>
                      </table> : <p className="p-3 text-xs text-muted-foreground">Nenhuma pessoa com os filtros atuais nesta equipe.</p>}
                    </div>
                  </div>;
                })}
              </div>
            </section>}
            {mode !== "funcionarios" && <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Equipamentos da reunião">
              <h3 className={`border-b border-border px-2 py-1 font-semibold ${mode === "equipes" ? "text-sm" : "text-base"}`}>Equipamentos ({view.equipment.length})</h3>
              <div role={comparison ? "group" : undefined} aria-label={comparison ? "Comparação entre equipes (equipamentos)" : undefined}
                className={`grid grid-cols-1 ${comparison && zoom < 150 ? "lg:grid-cols-2" : ""} gap-2 p-1`}>
                {groups.map(group => {
                  const rows = comparison ? orderedEquipment.filter(e => matchesTeam(e.setor, group)) : orderedEquipment;
                  const label = teamOptions.find(option => option.key === group)?.label || group;
                  return <div key={group} role={comparison ? "region" : undefined} aria-label={comparison ? `${label} — equipamentos` : undefined} className="min-w-0">
                    {comparison && <h4 className="rounded-t-md bg-primary/10 px-2 py-1.5 text-sm font-semibold">{label} · {rows.length} equipamento(s)</h4>}
                    <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                {rows.length ? <table className={`w-full text-left ${mode === "equipes" ? "text-xs" : "text-sm"}`}><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Frota / tipo</th><th className="px-2 py-1">{selectedTeams.length ? "Empresa" : "Equipe / empresa"}</th><th className="px-2 py-1">Status</th><th className="px-2 py-1 text-right">R$/mês</th>{onManageEquipment && <th className="px-2 py-1">Ação</th>}</tr></thead>
                  <tbody>{rows.map(e => {
                    const rental = (e.condicao || "").trim().toUpperCase() === "TERCEIRO";
                    const state = meetingStatus(e);
                    return <tr key={e.id} className={`border-t border-border ${state === "manutencao" ? "bg-amber-50/70" : ""}`}>
                      <td className="px-2 py-1 font-medium">{e.centro_custo || e.frota || e.placa || "Sem identificação"} <ProgramadorNote text={notes?.[noteKey("equipamento", e.id)]} label={e.centro_custo || e.frota || e.placa || "equipamento"} /><span className="block text-[11px] font-normal text-muted-foreground">{e.tipo || "Tipo não informado"}</span></td>
                      <td className="px-2 py-1">{!selectedTeams.length && <span className="block">{e.setor || "Sem equipe"}</span>}<span className="block text-[11px] text-muted-foreground">{rental ? (e.empresa_proprietaria || e.locadora || "Terceiro sem empresa") : (selectedTeams.length ? "Próprio" : "Próprio / não locado")}</span></td>
                      <td className="px-2 py-1">{statusName[state] || state}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{rental ? (e.valor_mensal == null ? "Sem valor" : money(e.valor_mensal)) : "—"}</td>
                      {onManageEquipment && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar equipamento ${e.centro_custo || e.frota || e.placa || "sem código"}`} onClick={() => onManageEquipment(e.id)}>Gerenciar</button></td>}
                    </tr>;
                    })}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhum equipamento encontrado com os filtros atuais.</p>}
                    </div>
                  </div>;
                })}
              </div>
            </section>}
          </div>
          {mode !== "funcionarios" && view.rental.withoutPrice > 0 && <p role="note" className="text-xs font-semibold text-amber-800">{view.rental.withoutPrice} sem valor cadastrado · Mensal conhecido não é o total dos contratos.</p>}
          {mode !== "funcionarios" && view.byLessor.length > 0 && <section className="rounded-lg border border-border bg-card p-3" aria-label="Resumo por locadora">
            <h3 className="text-sm font-semibold">Terceiros por empresa — filtro atual</h3>
            <div className="flex flex-wrap gap-2 mt-2">{view.byLessor.map(group => <div key={group.name} className="rounded-md border border-border px-3 py-2 text-xs">
              <span className="font-semibold">{group.name}</span> · {group.count} equipamento(s) · {money(group.monthlyKnown)}/mês conhecido{group.withoutPrice ? ` · ${group.withoutPrice} sem valor` : ""}
            </div>)}</div>
          </section>}
        </div>
    </section>
  );
}

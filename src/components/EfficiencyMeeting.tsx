import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { balloonOptions, prepareEfficiencyMeeting, meetingFilterKey, meetingStatus, type MeetingEquipment, type MeetingPerson } from "@/lib/programadorMeeting";
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
const alphabetic = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Read-only meeting surface: no master writes, drafts, or forms are mounted here. */
export function EfficiencyMeeting({ mode = "equipes", teams, people, equipment, initialTeam, zoom = 100, onZoomChange, pinnedTeams, notes, notesError, updatedAt, error, loading, onRefresh, onExit, onManagePerson, onManageEquipment }: Props) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>(initialTeam ? [initialTeam] : []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hiddenCostCenters, setHiddenCostCenters] = useState<string[]>([]);
  const all = useMemo(() => prepareEfficiencyMeeting(mode === "equipamentos" ? [] : people, mode === "funcionarios" ? [] : equipment, {}), [mode, people, equipment]);
  const availableTeams = useMemo(() => {
    const unique = new Map<string, string>();
    for (const name of [...(teams || []), ...all.teams]) if (name.trim() && !unique.has(meetingFilterKey(name))) unique.set(meetingFilterKey(name), name.trim());
    return [...unique.values()];
  }, [teams, all.teams]);
  const teamOptions = useMemo(() => {
    const names = [...availableTeams].sort((a, b) => {
      const ap = pinnedTeams?.some(team => meetingFilterKey(team) === meetingFilterKey(a)) ? 0 : 1;
      const bp = pinnedTeams?.some(team => meetingFilterKey(team) === meetingFilterKey(b)) ? 0 : 1;
      return ap - bp || alphabetic.compare(a, b);
    });
    return [{ key: "__sem_equipe__", label: "Sem equipe", count: 0 }, ...names.map(name => ({ key: name, label: name, count: 0 }))];
  }, [availableTeams, pinnedTeams]);
  const roleOptions = useMemo(() => balloonOptions(all.people, p => p.role, "__sem_funcao__", "Sem função").sort((a, b) => alphabetic.compare(a.label, b.label)), [all.people]);
  const typeOptions = useMemo(() => balloonOptions(all.equipment, e => e.tipo, "__sem_tipo__", "Sem tipo").sort((a, b) => alphabetic.compare(a.label, b.label)), [all.equipment]);
  const costOptions = useMemo(() => balloonOptions([...all.people, ...all.equipment], row => row.centro_custo, "__sem_centro__", "Sem centro de custo").sort((a, b) => alphabetic.compare(a.label, b.label)), [all.people, all.equipment]);
  const view = useMemo(() => prepareEfficiencyMeeting(mode === "equipamentos" ? [] : people, mode === "funcionarios" ? [] : equipment,
    { teams: selectedTeams, selectedRoles, selectedTypes, hiddenCostCenters }),
    [mode, people, equipment, selectedTeams, selectedRoles, selectedTypes, hiddenCostCenters]);
  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (key: string) =>
    setter(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  const orderedPeople = useMemo(() => [...view.people].sort((a, b) => alphabetic.compare(a.name || "", b.name || "") || alphabetic.compare(a.matricula || "", b.matricula || "")), [view.people]);
  const orderedEquipment = useMemo(() => [...view.equipment].sort((a, b) => alphabetic.compare(a.frota || a.centro_custo || "", b.frota || b.centro_custo || "")), [view.equipment]);
  const resetFilters = () => { setSelectedTeams([]); setSelectedRoles([]); setSelectedTypes([]); setHiddenCostCenters([]); };
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
          <span className="text-xs font-semibold text-muted-foreground">Filtros da apresentação</span>
          <button type="button" className="text-xs font-semibold text-primary underline" onClick={resetFilters}>Limpar filtros</button>
        </div>
        <PresentationBalloons title="Equipes" groupLabel="Filtrar equipes" singular="equipe"
          options={teamOptions} mode="include" selected={selectedTeams} allLabel="Todas as equipes"
          onToggle={toggle(setSelectedTeams)} onReset={() => setSelectedTeams([])} />
        {mode !== "equipamentos" && <PresentationBalloons title="Funções" groupLabel="Filtrar funções" singular="função"
          options={roleOptions} mode="include" selected={selectedRoles} allLabel="Todas as funções"
          onToggle={toggle(setSelectedRoles)} onReset={() => setSelectedRoles([])} />}
        {mode !== "funcionarios" && <PresentationBalloons title="Tipos de equipamento" groupLabel="Filtrar tipos de equipamento" singular="tipo"
          options={typeOptions} mode="include" selected={selectedTypes} allLabel="Todos os tipos"
          onToggle={toggle(setSelectedTypes)} onReset={() => setSelectedTypes([])} />}
        <PresentationBalloons title="Ocultar centros de custo" groupLabel="Filtrar centros de custo" singular="centro de custo"
          options={costOptions} hidden={hiddenCostCenters} onToggle={toggle(setHiddenCostCenters)} onReset={() => setHiddenCostCenters([])} />
        <p className="border-t border-border/60 pt-1 text-xs text-muted-foreground" aria-label="Indicadores do filtro atual">
          {mode !== "equipamentos" && <span>Pessoas no filtro <strong className="text-foreground tabular-nums">{view.people.length}</strong></span>}
          {mode === "equipes" && " · "}
          {mode !== "funcionarios" && <span>Equipamentos no filtro <strong className="text-foreground tabular-nums">{view.equipment.length}</strong></span>}
        </p>
      </div>
      <div className="min-w-0 space-y-2" data-testid="presentation-content" style={{ zoom: `${zoom}%` }}>
          <div className={`grid grid-cols-1 ${mode === "equipes" && zoom < 150 ? "lg:grid-cols-2" : ""} gap-2 items-start`}>
            {mode !== "equipamentos" && <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Pessoas da reunião">
              <h3 className={`border-b border-border px-2 py-1 font-semibold ${mode === "equipes" ? "text-sm" : "text-base"}`}>Pessoas ({view.people.length})</h3>
              <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                {orderedPeople.length ? <table className={`w-full text-left ${mode === "equipes" ? "text-xs" : "text-sm"}`}><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Nome</th><th className="px-2 py-1">Função</th><th className="px-2 py-1">Status</th>{onManagePerson && <th className="px-2 py-1">Ação</th>}</tr></thead>
                  <tbody>{orderedPeople.map(p => <tr key={p.id} className="border-t border-border"><td className="px-2 py-1 font-medium">{p.name} <ProgramadorNote text={notes?.[noteKey("pessoa", p.id)]} label={p.name} /><span className="block text-[11px] text-muted-foreground">{p.matricula || "Sem matrícula"}{selectedTeams.length !== 1 && ` · ${p.equipe || "Sem equipe"}`}{mode === "funcionarios" && p.centro_custo && ` · CC: ${p.centro_custo}`}</span></td><td className="px-2 py-1">{p.role || "—"}</td><td className="px-2 py-1">{p.status || "Não informado"}</td>{onManagePerson && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar pessoa ${p.name}`} onClick={() => onManagePerson(p.id)}>Gerenciar</button></td>}</tr>)}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhuma pessoa com os filtros atuais.</p>}
              </div>
            </section>}
            {mode !== "funcionarios" && <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Equipamentos da reunião">
              <h3 className={`border-b border-border px-2 py-1 font-semibold ${mode === "equipes" ? "text-sm" : "text-base"}`}>Equipamentos ({view.equipment.length})</h3>
              <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                {orderedEquipment.length ? <table className={`w-full text-left ${mode === "equipes" ? "text-xs" : "text-sm"}`}><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Frota / tipo</th><th className="px-2 py-1">{selectedTeams.length === 1 ? "Empresa" : "Equipe / empresa"}</th><th className="px-2 py-1">Status</th><th className="px-2 py-1 text-right">R$/mês</th>{onManageEquipment && <th className="px-2 py-1">Ação</th>}</tr></thead>
                  <tbody>{orderedEquipment.map(e => {
                    const rental = (e.condicao || "").trim().toUpperCase() === "TERCEIRO";
                    const state = meetingStatus(e);
                    return <tr key={e.id} className={`border-t border-border ${state === "manutencao" ? "bg-amber-50/70" : ""}`}>
                      <td className="px-2 py-1 font-medium">{e.centro_custo || e.frota || e.placa || "Sem identificação"} <ProgramadorNote text={notes?.[noteKey("equipamento", e.id)]} label={e.centro_custo || e.frota || e.placa || "equipamento"} /><span className="block text-[11px] font-normal text-muted-foreground">{e.tipo || "Tipo não informado"}</span></td>
                      <td className="px-2 py-1">{selectedTeams.length !== 1 && <span className="block">{e.setor || "Sem equipe"}</span>}<span className="block text-[11px] text-muted-foreground">{rental ? (e.empresa_proprietaria || e.locadora || "Terceiro sem empresa") : (selectedTeams.length === 1 ? "Próprio" : "Próprio / não locado")}</span></td>
                      <td className="px-2 py-1">{statusName[state] || state}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{rental ? (e.valor_mensal == null ? "Sem valor" : money(e.valor_mensal)) : "—"}</td>
                      {onManageEquipment && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar equipamento ${e.centro_custo || e.frota || e.placa || "sem código"}`} onClick={() => onManageEquipment(e.id)}>Gerenciar</button></td>}
                    </tr>;
                    })}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhum equipamento encontrado com os filtros atuais.</p>}
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

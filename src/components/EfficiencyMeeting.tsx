import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamPicker, rankTeamsByAllocation } from "@/components/TeamPicker";
import { groupPeopleForProgramador, groupEquipmentForProgramador } from "@/lib/programadorGroups";
import { prepareEfficiencyMeeting, meetingStatus, type MeetingEquipment, type MeetingPerson } from "@/lib/programadorMeeting";
import { ProgramadorNote } from "@/components/ProgramadorNote";
import { noteKey, type OperationalNotes } from "@/lib/programadorNotes";

type Props = {
  people: MeetingPerson[];
  equipment: MeetingEquipment[];
  initialTeam: string;
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

/** Read-only meeting surface: no master writes, drafts, or forms are mounted here. */
export function EfficiencyMeeting({ people, equipment, initialTeam, pinnedTeams, notes, notesError, updatedAt, error, loading, onRefresh, onExit, onManagePerson, onManageEquipment }: Props) {
  const [team, setTeam] = useState(initialTeam);
  const [status, setStatus] = useState("todos");
  const all = useMemo(() => prepareEfficiencyMeeting(people, equipment, {}), [people, equipment]);
  const featuredTeams = useMemo(() => rankTeamsByAllocation(all.teams, people, equipment), [all.teams, people, equipment]);
  const view = useMemo(() => prepareEfficiencyMeeting(people, equipment, { team, status }), [people, equipment, team, status]);
  const peopleGroups = useMemo(() => groupPeopleForProgramador(view.people), [view.people]);
  const equipmentGroups = useMemo(() => groupEquipmentForProgramador(view.equipment), [view.equipment]);
  const orderedPeople = useMemo(() => peopleGroups.flatMap(group => group.items), [peopleGroups]);
  const orderedEquipment = useMemo(() => equipmentGroups.flatMap(group => group.items), [equipmentGroups]);
  const changeTeam = (next: string) => {
    setTeam(next); setStatus("todos");
  };
  return (
    <section className="space-y-2" aria-label="Reunião de eficiência">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Reunião de eficiência</h2>
          <p className="text-xs text-muted-foreground">
            Dados dos cadastros de Pessoas e Frotas · {updatedAt ? `Atualizados em ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Aguardando consulta"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar dados"}</Button>
          <Button type="button" size="sm" variant="outline" onClick={onExit}>Sair da apresentação</Button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">Dados possivelmente incompletos: {error}. Não use estes totais para decisão sem atualizar.</p>}
      {notesError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Observações indisponíveis: {notesError}. Atualize os dados antes da reunião.</p>}
      {!updatedAt && !error && <p role="status" className="text-sm text-muted-foreground">Carregando cadastros...</p>}
      <div className="min-w-0 space-y-2">
          <div className="rounded-xl border border-border bg-card px-3 py-1.5 space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] md:items-center gap-1">
              <span className="text-xs font-semibold text-muted-foreground">Equipe</span>
              <TeamPicker teams={all.teams} featured={featuredTeams} pinned={pinnedTeams} value={team} onChange={changeTeam} allowAll allowNoTeam />
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1" aria-label="Status dos equipamentos">
              {filterNames.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${status === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
              <div className="ml-auto flex gap-3 text-xs text-muted-foreground" aria-label="Indicadores do filtro atual">
                <span>Pessoas na equipe <strong className="text-foreground tabular-nums">{view.people.length}</strong></span>
                <span>Equipamentos no filtro <strong className="text-foreground tabular-nums">{view.equipment.length}</strong></span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
            <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Pessoas da reunião">
              <h3 className="border-b border-border px-2 py-1 font-semibold text-sm">Pessoas ({view.people.length})</h3>
              <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                {view.people.length ? <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Nome</th><th className="px-2 py-1">Função</th><th className="px-2 py-1">Status</th>{onManagePerson && <th className="px-2 py-1">Ação</th>}</tr></thead>
                  <tbody>{orderedPeople.map(p => <tr key={p.id} className="border-t border-border"><td className="px-2 py-1 font-medium">{p.name} <ProgramadorNote text={notes?.[noteKey("pessoa", p.id)]} label={p.name} /><span className="block text-[11px] text-muted-foreground">{p.matricula || "Sem matrícula"}{!team && ` · ${p.equipe || "Sem equipe"}`}</span></td><td className="px-2 py-1">{p.role || "—"}</td><td className="px-2 py-1">{p.status || "Não informado"}</td>{onManagePerson && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar pessoa ${p.name}`} onClick={() => onManagePerson(p.id)}>Gerenciar</button></td>}</tr>)}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhuma pessoa nesta equipe.</p>}
              </div>
            </section>
            <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Equipamentos da reunião">
              <h3 className="border-b border-border px-2 py-1 font-semibold text-sm">Equipamentos ({view.equipment.length})</h3>
              <div className="max-h-[calc(100dvh-16rem)] min-h-[240px] overflow-auto">
                {view.equipment.length ? <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="px-2 py-1">Frota / tipo</th><th className="px-2 py-1">{team ? "Empresa" : "Equipe / empresa"}</th><th className="px-2 py-1">Status</th><th className="px-2 py-1 text-right">R$/mês</th>{onManageEquipment && <th className="px-2 py-1">Ação</th>}</tr></thead>
                  <tbody>{orderedEquipment.map(e => {
                    const rental = (e.condicao || "").trim().toUpperCase() === "TERCEIRO";
                    const state = meetingStatus(e);
                    return <tr key={e.id} className={`border-t border-border ${state === "manutencao" ? "bg-amber-50/70" : ""}`}>
                      <td className="px-2 py-1 font-medium">{e.centro_custo || e.frota || e.placa || "Sem identificação"} <ProgramadorNote text={notes?.[noteKey("equipamento", e.id)]} label={e.centro_custo || e.frota || e.placa || "equipamento"} /><span className="block text-[11px] font-normal text-muted-foreground">{e.tipo || "Tipo não informado"}</span></td>
                      <td className="px-2 py-1">{!team && <span className="block">{e.setor || "Sem equipe"}</span>}<span className="block text-[11px] text-muted-foreground">{rental ? (e.empresa_proprietaria || e.locadora || "Terceiro sem empresa") : (team ? "Próprio" : "Próprio / não locado")}</span></td>
                      <td className="px-2 py-1">{statusName[state] || state}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{rental ? (e.valor_mensal == null ? "Sem valor" : money(e.valor_mensal)) : "—"}</td>
                      {onManageEquipment && <td className="px-2 py-1"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar equipamento ${e.centro_custo || e.frota || e.placa || "sem código"}`} onClick={() => onManageEquipment(e.id)}>Gerenciar</button></td>}
                    </tr>;
                    })}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhum equipamento encontrado com os filtros atuais.</p>}
              </div>
            </section>
          </div>
          {view.rental.withoutPrice > 0 && <p role="note" className="text-xs font-semibold text-amber-800">{view.rental.withoutPrice} sem valor cadastrado · Mensal conhecido não é o total dos contratos.</p>}
          {view.byLessor.length > 0 && <section className="rounded-lg border border-border bg-card p-3" aria-label="Resumo por locadora">
            <h3 className="text-sm font-semibold">Terceiros por empresa — filtro atual</h3>
            <div className="flex flex-wrap gap-2 mt-2">{view.byLessor.map(group => <div key={group.name} className="rounded-md border border-border px-3 py-2 text-xs">
              <span className="font-semibold">{group.name}</span> · {group.count} equipamento(s) · {money(group.monthlyKnown)}/mês conhecido{group.withoutPrice ? ` · ${group.withoutPrice} sem valor` : ""}
            </div>)}</div>
          </section>}
        </div>
    </section>
  );
}

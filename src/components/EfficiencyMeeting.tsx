import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamPicker, rankTeamsByAllocation } from "@/components/TeamPicker";
import { groupPeopleForProgramador, groupEquipmentForProgramador } from "@/lib/programadorGroups";
import { prepareEfficiencyMeeting, meetingStatus, type MeetingEquipment, type MeetingPerson } from "@/lib/programadorMeeting";

type Props = {
  people: MeetingPerson[];
  equipment: MeetingEquipment[];
  initialTeam: string;
  pinnedTeams?: string[];
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
export function EfficiencyMeeting({ people, equipment, initialTeam, pinnedTeams, updatedAt, error, loading, onRefresh, onExit, onManagePerson, onManageEquipment }: Props) {
  const [team, setTeam] = useState(initialTeam);
  const [status, setStatus] = useState("todos");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const all = useMemo(() => prepareEfficiencyMeeting(people, equipment, {}), [people, equipment]);
  const featuredTeams = useMemo(() => rankTeamsByAllocation(all.teams, people, equipment), [all.teams, people, equipment]);
  const byTeam = useMemo(() => prepareEfficiencyMeeting(people, equipment, { team }), [people, equipment, team]);
  const view = useMemo(() => prepareEfficiencyMeeting(people, equipment, { team, status, type, search }), [people, equipment, team, status, type, search]);
  const peopleGroups = useMemo(() => groupPeopleForProgramador(view.people), [view.people]);
  const equipmentGroups = useMemo(() => groupEquipmentForProgramador(view.equipment), [view.equipment]);
  const types = useMemo(() => [...new Set(byTeam.equipment.map(e => (e.tipo || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR")), [byTeam.equipment]);
  const changeTeam = (next: string) => {
    setTeam(next); setType(""); setStatus("todos"); setSearch("");
  };
  const totalMaintenance = view.equipment.filter(e => meetingStatus(e) === "manutencao").length;
  return (
    <section className="space-y-2.5" aria-label="Reunião de eficiência">
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
      {!updatedAt && !error && <p role="status" className="text-sm text-muted-foreground">Carregando cadastros...</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5" aria-label="Indicadores do filtro atual">
        {[
          ["Pessoas na equipe", String(view.people.length)],
          ["Equipamentos no filtro", String(view.equipment.length)],
          ["Terceiros", String(view.rental.rented)],
          ["Em manutenção", String(totalMaintenance)],
          ["Mensal conhecido", money(view.rental.monthlyKnown)],
          ["Preços pendentes", String(view.rental.withoutPrice)],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card px-2.5 py-1.5">
          <p className="text-[11px] text-muted-foreground">{label}</p><p className="text-base font-semibold tabular-nums">{value}</p>
        </div>)}
      </div>
      <div className="min-w-0 space-y-2.5">
          <div className="rounded-xl border border-border bg-card px-3 py-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] md:items-center gap-2 border-b border-border/60 pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Equipe</span>
              <TeamPicker teams={all.teams} featured={featuredTeams} pinned={pinnedTeams} value={team} onChange={changeTeam} allowAll allowNoTeam />
            </div>
            <div className="flex flex-wrap gap-1" aria-label="Status dos equipamentos">
              {filterNames.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-full border px-2.5 py-1 text-xs ${status === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-2">
              <label className="text-xs text-muted-foreground">Tipo de equipamento
                <select className="block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={type} onChange={e => setType(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Buscar equipamento ou locadora
                <Input className="h-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Frota, placa, tipo, empresa..." />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">Os filtros de status, tipo e busca afetam apenas equipamentos. Mensal conhecido não é o custo total.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Pessoas da reunião">
              <h3 className="border-b border-border px-3 py-2 font-semibold text-sm">Pessoas ({view.people.length})</h3>
              <div className="max-h-[55vh] overflow-auto">
                {view.people.length ? <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="p-2">Nome</th><th className="p-2">Função</th><th className="p-2">Status</th>{onManagePerson && <th className="p-2">Ação</th>}</tr></thead>
                  <tbody>{peopleGroups.map(group => <Fragment key={group.title}>
                    <tr className="border-t border-border bg-muted/40"><th scope="rowgroup" colSpan={onManagePerson ? 4 : 3} className="px-2 py-1.5 text-left text-xs font-semibold">{group.title} <span className="font-normal text-muted-foreground">({group.items.length})</span></th></tr>
                    {group.items.map(p => <tr key={p.id} className="border-t border-border"><td className="p-2 font-medium">{p.name}<span className="block text-[11px] text-muted-foreground">{p.matricula || "Sem matrícula"} · {p.equipe || "Sem equipe"}</span></td><td className="p-2">{p.role || "—"}</td><td className="p-2">{p.status || "Não informado"}</td>{onManagePerson && <td className="p-2"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar pessoa ${p.name}`} onClick={() => onManagePerson(p.id)}>Gerenciar</button></td>}</tr>)}
                  </Fragment>)}</tbody>
                </table> : <p className="p-3 text-xs text-muted-foreground">Nenhuma pessoa nesta equipe.</p>}
              </div>
            </section>
            <section className="rounded-lg border border-border bg-card min-w-0" aria-label="Equipamentos da reunião">
              <h3 className="border-b border-border px-3 py-2 font-semibold text-sm">Equipamentos ({view.equipment.length})</h3>
              <div className="max-h-[55vh] overflow-auto">
                {view.equipment.length ? <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="p-2">Frota / tipo</th><th className="p-2">Equipe / empresa</th><th className="p-2">Status</th><th className="p-2 text-right">R$/mês</th>{onManageEquipment && <th className="p-2">Ação</th>}</tr></thead>
                  <tbody>{equipmentGroups.map(group => <Fragment key={group.title}>
                    <tr className="border-t border-border bg-muted/40"><th scope="rowgroup" colSpan={onManageEquipment ? 5 : 4} className="px-2 py-1.5 text-left text-xs font-semibold">{group.title} <span className="font-normal text-muted-foreground">({group.items.length})</span></th></tr>
                    {group.items.map(e => {
                    const rental = (e.condicao || "").trim().toUpperCase() === "TERCEIRO";
                    const state = meetingStatus(e);
                    return <tr key={e.id} className={`border-t border-border ${state === "manutencao" ? "bg-amber-50/70" : ""}`}>
                      <td className="p-2 font-medium">{e.centro_custo || e.frota || e.placa || "Sem identificação"}<span className="block text-[11px] font-normal text-muted-foreground">{e.tipo || "Tipo não informado"}</span></td>
                      <td className="p-2">{e.setor || "Sem equipe"}<span className="block text-[11px] text-muted-foreground">{rental ? (e.empresa_proprietaria || e.locadora || "Terceiro sem empresa") : "Próprio / não locado"}</span></td>
                      <td className="p-2">{statusName[state] || state}</td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">{rental ? (e.valor_mensal == null ? "Sem valor" : money(e.valor_mensal)) : "—"}</td>
                      {onManageEquipment && <td className="p-2"><button type="button" className="text-primary underline underline-offset-2" aria-label={`Gerenciar equipamento ${e.centro_custo || e.frota || e.placa || "sem código"}`} onClick={() => onManageEquipment(e.id)}>Gerenciar</button></td>}
                    </tr>;
                    })}
                  </Fragment>)}</tbody>
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

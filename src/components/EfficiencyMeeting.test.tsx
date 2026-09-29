import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EfficiencyMeeting } from "./EfficiencyMeeting";

const props = {
  people: [
    { id: "p1", name: "Ana", equipe: "EQUIPE A", status: "ativo", role: "Motorista", matricula: "100" },
    { id: "p2", name: "Beto", equipe: null, status: "afastado", role: null, matricula: null },
  ],
  equipment: [
    { id: "q1", setor: "EQUIPE A", tipo: "CAMINHÃO BASCULANTE", frota: "A1", status: "em_manutencao", condicao: "TERCEIRO", valor_mensal: 1500, empresa_proprietaria: "Locadora A", locadora: null },
    { id: "q2", setor: null, tipo: "ESCAVADEIRA", frota: "B2", status: "ativo", condicao: "TERCEIRO", valor_mensal: null, empresa_proprietaria: null, locadora: "Locadora B" },
  ],
  initialTeam: "",
  updatedAt: "2026-09-28T12:00:00.000Z",
  onRefresh: vi.fn(),
  onExit: vi.fn(),
};

describe("tela de reunião", () => {
  it("selects only the employee functions to show and restores all explicitly", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" people={[
      props.people[0],
      { ...props.people[0], id: "p3", name: "Cris", role: "Apontador" },
    ]} initialTeam="EQUIPE A" />);
    expect(screen.getByRole("group", { name: "Filtrar funções" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar função Motorista" }));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Cris")).toBeNull();
    expect(screen.getByRole("button", { name: "EQUIPE A" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar função Apontador" }));
    expect(screen.getByText("Cris")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retirar função Motorista" }));
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getByText("Cris")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Todas as funções" }));
    expect(screen.getByText("Ana")).toBeTruthy();
  });
  it.each(["equipes", "funcionarios"] as const)("never presents dismissed staff in %s mode", mode => {
    render(<EfficiencyMeeting {...props} mode={mode} people={[
      ...props.people,
      { id: "dem", name: "Demitida", equipe: "EQUIPE DEM", status: "demitido", role: "Função exclusiva" },
    ]} />);
    expect(screen.queryByText("Demitida")).toBeNull();
    expect(screen.queryByRole("button", { name: "Selecionar função Função exclusiva" })).toBeNull();
    expect(screen.queryByRole("button", { name: "EQUIPE DEM" })).toBeNull();
  });
  it("identifies and hides a cost center in employee presentation", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" people={[
      { ...props.people[0], centro_custo: "CC 01" },
      { ...props.people[1], centro_custo: "CC 02" },
    ]} />);
    const staff = screen.getByRole("region", { name: "Pessoas da reunião" });
    expect(within(staff).getByText(/CC: CC 01/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar centro de custo CC 01" }));
    expect(within(staff).queryByText("Ana")).toBeNull();
    expect(within(staff).getByText("Beto")).toBeTruthy();
  });
  it("hides chosen cost centers in the combined presentation, including the other catalog", () => {
    render(<EfficiencyMeeting {...props} people={[
      { ...props.people[0], centro_custo: "CC 01" },
      { ...props.people[1], centro_custo: "CC 02" },
    ]} equipment={[
      { ...props.equipment[0], centro_custo: "CC 01" },
      { ...props.equipment[1], centro_custo: "CC 02" },
    ]} />);
    const fleet = screen.getByRole("region", { name: "Equipamentos da reunião" });
    expect(within(fleet).getByText("CC 01")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar centro de custo CC 01" }));
    expect(screen.queryByText("Ana")).toBeNull();
    expect(within(fleet).queryByText("CC 01")).toBeNull();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(within(fleet).getByText("CC 02")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar centro de custo CC 01" }));
    expect(screen.getByText("Ana")).toBeTruthy();
  });
  it("selects equipment types to show and recalculates costs while keeping returned fleet out", () => {
    render(<EfficiencyMeeting {...props} mode="equipamentos" equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "returned", tipo: "GUINDASTE", status: "devolvido", frota: "D3" },
    ]} />);
    expect(screen.getByRole("group", { name: "Filtrar tipos de equipamento" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Selecionar tipo GUINDASTE" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar tipo ESCAVADEIRA" }));
    expect(screen.queryByText("A1")).toBeNull();
    expect(screen.queryByText("D3")).toBeNull();
    expect(screen.getByText("B2")).toBeTruthy();
    expect(screen.queryByText("Locadora A")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Todos os tipos" }));
    expect(screen.getByText("A1")).toBeTruthy();
  });
  it("presents only employees across full width with team chips and operational notes", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" teams={["EQUIPE A", "SEM PESSOAS"]} pinnedTeams={["SEM PESSOAS"]} initialTeam="EQUIPE A" notes={{ "pessoa:p1": "Rever escala" }} />);
    expect(screen.getByRole("button", { name: "SEM PESSOAS" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Apresentação de funcionários" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Apresentação de funcionários" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Pessoas da reunião" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Equipamentos da reunião" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Resumo por locadora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Manutenção" })).toBeNull();
    expect(screen.getByRole("button", { name: "Observação de Ana" })).toBeTruthy();
    expect(screen.queryByText("Beto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sem equipe" }));
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });
  it("presents only active fleet, with status, prices and team chips", () => {
    render(<EfficiencyMeeting {...props} mode="equipamentos" initialTeam="EQUIPE A" equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "returned", frota: "D3", status: "devolvido", valor_mensal: 9000 },
    ]} />);
    expect(screen.getByRole("region", { name: "Apresentação de equipamentos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Apresentação de equipamentos" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Equipamentos da reunião" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Pessoas da reunião" })).toBeNull();
    expect(screen.queryByText("D3")).toBeNull();
    expect(screen.getByText("A1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Operacionais" }));
    expect(screen.queryByText("A1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sem equipe" }));
    expect(screen.getByText("B2")).toBeTruthy();
  });
  it("groups personnel and fleet in operational order without losing any record", () => {
    render(<EfficiencyMeeting {...props} people={[
      { id: "m", name: "Motorista", equipe: "EQUIPE A", status: "ativo", role: "MOTORISTA DE CAMINHÃO", matricula: "2" },
      { id: "e", name: "Chefe", equipe: "EQUIPE A", status: "ativo", role: "ENCARREGADO DE OBRAS", matricula: "1" },
    ]} equipment={[
      { ...props.equipment[0], id: "r", tipo: "ROLO CHAPA" },
      { ...props.equipment[1], id: "f", tipo: "FRESADORA" },
    ]} />);
    const names = within(screen.getByRole("region", { name: "Pessoas da reunião" })).getAllByRole("row").map(row => row.textContent || "");
    const fleet = within(screen.getByRole("region", { name: "Equipamentos da reunião" })).getAllByRole("row").map(row => row.textContent || "");
    expect(names.findIndex(name => name.includes("Chefe"))).toBeLessThan(names.findIndex(name => name.includes("Motorista")));
    expect(fleet.findIndex(name => name.includes("FRESADORA"))).toBeLessThan(fleet.findIndex(name => name.includes("ROLO CHAPA")));
    expect(screen.getByText("Chefe")).toBeTruthy();
    expect(screen.getByText("Motorista")).toBeTruthy();
  });
  it("prioritizes the roster over financial cards and advanced equipment controls", () => {
    render(<EfficiencyMeeting {...props} />);
    const indicators = screen.getByLabelText("Indicadores do filtro atual");
    expect(within(indicators).getByText("Pessoas na equipe")).toBeTruthy();
    expect(within(indicators).getByText("Equipamentos no filtro")).toBeTruthy();
    expect(within(indicators).queryByText("Mensal conhecido")).toBeNull();
    expect(within(indicators).queryByText("Preços pendentes")).toBeNull();
    expect(within(indicators).queryByText("Em manutenção")).toBeNull();
    expect(within(indicators).queryByText("Terceiros")).toBeNull();
    expect(screen.queryByText("Tipo de equipamento")).toBeNull();
    expect(screen.queryByText("Buscar equipamento ou locadora")).toBeNull();
    expect(screen.getByRole("button", { name: "Manutenção" })).toBeTruthy();
    expect(screen.getByText(/1 sem valor cadastrado/)).toBeTruthy();
  });
  it("shows ordered people and fleet without redundant group heading rows", () => {
    render(<EfficiencyMeeting {...props} people={[
      { id: "m", name: "João", equipe: "EQUIPE A", status: "ativo", role: "MOTORISTA", matricula: "2" },
      { id: "e", name: "Ana", equipe: "EQUIPE A", status: "ativo", role: "ENCARREGADO DE OBRAS", matricula: "1" },
    ]} equipment={[
      { ...props.equipment[0], id: "r", tipo: "ROLO CHAPA", frota: "R1" },
      { ...props.equipment[1], id: "f", tipo: "FRESADORA", frota: "F1" },
    ]} />);
    const peopleRows = within(screen.getByRole("region", { name: "Pessoas da reunião" })).getAllByRole("row");
    const equipmentRows = within(screen.getByRole("region", { name: "Equipamentos da reunião" })).getAllByRole("row");
    expect(peopleRows[1].textContent).toContain("Ana");
    expect(peopleRows[2].textContent).toContain("João");
    expect(equipmentRows[1].textContent).toContain("F1");
    expect(equipmentRows[2].textContent).toContain("R1");
    expect(peopleRows).toHaveLength(3);
    expect(equipmentRows).toHaveLength(3);
  });
  it("omits the repeated team in rows when a crew is selected, preserving employee ID and equipment owner", () => {
    render(<EfficiencyMeeting {...props} initialTeam="EQUIPE A" equipment={[
      props.equipment[0],
      { ...props.equipment[0], id: "own", frota: "P1", condicao: "PROPRIO", empresa_proprietaria: null, valor_mensal: null },
    ]} />);
    const peopleTable = screen.getByRole("region", { name: "Pessoas da reunião" });
    const fleetTable = screen.getByRole("region", { name: "Equipamentos da reunião" });
    expect(within(peopleTable).getByText(/100/)).toBeTruthy();
    expect(within(peopleTable).queryByText(/EQUIPE A/)).toBeNull();
    expect(within(fleetTable).getByRole("columnheader", { name: "Empresa" })).toBeTruthy();
    expect(within(fleetTable).getByText("Locadora A")).toBeTruthy();
    expect(within(fleetTable).getByText("Próprio")).toBeTruthy();
    expect(within(fleetTable).queryByText(/EQUIPE A/)).toBeNull();
  });
  it("retains each team in the all-teams view and hides repeated 'Sem equipe' in the unallocated view", () => {
    render(<EfficiencyMeeting {...props} />);
    const peopleTable = screen.getByRole("region", { name: "Pessoas da reunião" });
    const fleetTable = screen.getByRole("region", { name: "Equipamentos da reunião" });
    expect(within(peopleTable).getByText(/100 · EQUIPE A/)).toBeTruthy();
    expect(within(fleetTable).getByRole("columnheader", { name: "Equipe / empresa" })).toBeTruthy();
    expect(within(fleetTable).getByText("EQUIPE A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sem equipe/i }));
    expect(within(peopleTable).queryByText("Sem equipe")).toBeNull();
    expect(within(fleetTable).queryByText("Sem equipe")).toBeNull();
    expect(within(fleetTable).getByText("Locadora B")).toBeTruthy();
  });
  it("does not list returned fleet or count its rental in the unallocated presentation", () => {
    render(<EfficiencyMeeting {...props} initialTeam="__sem_equipe__" equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "returned", setor: null, frota: "D3", status: "devolvido", valor_mensal: 2500 },
    ]} />);
    const fleetTable = screen.getByRole("region", { name: "Equipamentos da reunião" });
    expect(within(fleetTable).queryByText("D3")).toBeNull();
    expect(within(fleetTable).getByText("B2")).toBeTruthy();
    expect(within(fleetTable).getByText("Equipamentos (1)")).toBeTruthy();
    expect(screen.getByText(/1 sem valor cadastrado/)).toBeTruthy();
  });
  it("shows only operational notes on the matching person and equipment in presentation", () => {
    render(<EfficiencyMeeting {...props} notes={{ "pessoa:p1": "Revisar escala", "equipamento:q1": "Conferir pneus" }} />);
    expect(screen.getByRole("button", { name: "Observação de Ana" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Observação de A1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Observação de Beto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Observação de B2" })).toBeNull();
  });
  it("reflects configured chips in presentation without offering to edit them", () => {
    const { rerender } = render(<EfficiencyMeeting {...props} pinnedTeams={[]} />);
    const quick = screen.getByRole("group", { name: "Equipes em destaque" });
    expect(within(quick).queryByRole("button", { name: "EQUIPE A" })).toBeNull();
    rerender(<EfficiencyMeeting {...props} pinnedTeams={["EQUIPE A"]} />);
    expect(within(quick).getByRole("button", { name: "EQUIPE A" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Adicionar balão de equipe" })).toBeNull();
  });
  it("uses compact searchable team chips instead of a full-height team sidebar", () => {
    render(<EfficiencyMeeting {...props} />);
    expect(screen.getByRole("group", { name: "Equipes em destaque" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscar outra equipe" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Filtrar por equipe" })).toBeNull();
  });
  it("shows all, team and unallocated people/equipment with known costs and missing prices", () => {
    render(<EfficiencyMeeting {...props} />);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.getByText(/1 sem valor cadastrado/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Equipe A/i }));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Beto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sem equipe/i }));
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });
  it("applies equipment filters without hiding people and exits through explicit action", () => {
    const onExit = vi.fn();
    render(<EfficiencyMeeting {...props} onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Manutenção" }));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("B2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sair da apresentação/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });
  it("opens an individual person without mutating the meeting list", () => {
    const onManagePerson = vi.fn();
    render(<EfficiencyMeeting {...props} onManagePerson={onManagePerson} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar pessoa Ana" }));
    expect(onManagePerson).toHaveBeenCalledWith("p1");
    expect(screen.getByText("Ana")).toBeTruthy();
  });
  it("opens an individual equipment in Programador after leaving the read-only meeting", () => {
    const onManageEquipment = vi.fn();
    render(<EfficiencyMeeting {...props} onManageEquipment={onManageEquipment} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar equipamento A1" }));
    expect(onManageEquipment).toHaveBeenCalledWith("q1");
  });
});

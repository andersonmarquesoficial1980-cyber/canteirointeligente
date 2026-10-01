import { useState } from "react";
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

function choose(group: string, action: string) {
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name: action }));
}

describe("tela de reunião", () => {
  it.each(["equipes", "funcionarios"] as const)("oculta apenas os IDs indicados da Fremix em %s, sem ocultar quem tem RDO", mode => {
    const staff = [
      { ...props.people[0], id: "a0e74d66-de82-4d35-afdf-4af0e247f5ca", name: "GABRIELLI DE SOUSA" },
      { ...props.people[0], id: "18ab8c67-35d6-46e5-b6ef-54088a70c8af", name: "GIBSON DOS SANTOS SILVA" },
    ];
    const page = render(<EfficiencyMeeting {...props} mode={mode} companyId="a1b2c3d4-e5f6-7890-abcd-ef1234567890" people={staff} />);
    expect(screen.queryByText("GABRIELLI DE SOUSA")).toBeNull();
    expect(screen.getByText("GIBSON DOS SANTOS SILVA")).toBeTruthy();
    page.rerender(<EfficiencyMeeting {...props} mode={mode} companyId="outra-empresa" people={staff} />);
    expect(screen.getByText("GABRIELLI DE SOUSA")).toBeTruthy();
  });
  it("keeps shortcut visibility scoped to the signed-in company and user", () => {
    const scopeA = "company-a:user-a";
    const scopeB = "company-a:user-b";
    const keyA = `workflux:programador:apresentacao-baloes:v1:${scopeA}:funcoes`;
    localStorage.removeItem(keyA);
    const { unmount } = render(<EfficiencyMeeting {...props} mode="funcionarios" preferenceScope={scopeA} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover balão Motorista" }));
    expect(screen.queryByRole("button", { name: "Selecionar função Motorista" })).toBeNull();
    unmount();
    const next = render(<EfficiencyMeeting {...props} mode="funcionarios" preferenceScope={scopeA} />);
    expect(screen.queryByRole("button", { name: "Selecionar função Motorista" })).toBeNull();
    next.rerender(<EfficiencyMeeting {...props} mode="funcionarios" preferenceScope={scopeB} />);
    expect(screen.getByRole("button", { name: "Selecionar função Motorista" })).toBeTruthy();
    localStorage.removeItem(keyA);
  });
  it("recalculates footer quantities and known rental costs from all active presentation filters", () => {
    render(<EfficiencyMeeting {...props} equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "own", frota: "P3", condicao: "PROPRIO", status: "ativo", valor_mensal: 3000 },
      { ...props.equipment[0], id: "returned", frota: "DEV01", status: "devolvido", valor_mensal: 9000 },
    ]} />);
    const footer = screen.getByRole("region", { name: "Resumo do filtro da apresentação" });
    expect(footer.textContent).toContain("Pessoas 2");
    expect(footer.textContent).toContain("Equipamentos 3");
    expect(footer.textContent).toContain("Terceiros 2");
    expect(footer.textContent).toContain("1.500,00");
    expect(footer.textContent).toContain("Sem valor 1");
    choose("Filtrar equipes", "Selecionar equipe EQUIPE A");
    expect(footer.textContent).toContain("Pessoas 1");
    expect(footer.textContent).toContain("Equipamentos 2");
    expect(footer.textContent).toContain("Terceiros 1");
    expect(footer.textContent).toContain("Sem valor 0");
    choose("Filtrar status dos equipamentos", "Selecionar status Operacional");
    expect(footer.textContent).toContain("Equipamentos 1");
    expect(footer.textContent).toContain("Terceiros 0");
    expect(footer.textContent).toContain("0,00");
    expect(footer.textContent).not.toContain("9.000,00");
  });
  it.each(["equipes", "equipamentos"] as const)("filters %s fleet by status chips without ever offering returned equipment", mode => {
    render(<EfficiencyMeeting {...props} mode={mode} equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "returned", frota: "DEV01", status: " Devolvido ", valor_mensal: 9000 },
    ]} />);
    const statuses = screen.getByRole("group", { name: "Filtrar status dos equipamentos" });
    expect(within(statuses).queryByRole("button", { name: "Devolvido" })).toBeNull();
    expect(screen.queryByText("DEV01")).toBeNull();
    choose("Filtrar status dos equipamentos", "Selecionar status Manutenção");
    expect(screen.getByText("A1")).toBeTruthy();
    expect(screen.queryByText("B2")).toBeNull();
    expect(within(statuses).getByRole("button", { name: "Retirar status Manutenção" })).toBeTruthy();
    fireEvent.click(within(statuses).getByRole("button", { name: "Todos os status" }));
    expect(screen.getByText("B2")).toBeTruthy();
    expect(screen.queryByText("DEV01")).toBeNull();
  });
  it("shows selected teams together in one alphabetical list without comparison panels", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" people={[
      { ...props.people[0], id: "a", name: "Zilda", equipe: "Equipe A", role: "AJUDANTE" },
      { ...props.people[0], id: "b", name: "Ana", equipe: "Equipe B", role: "AJUDANTE" },
      { ...props.people[0], id: "c", name: "Clara", equipe: "Equipe C", role: "AJUDANTE" },
    ]} />);
    choose("Filtrar equipes", "Selecionar equipe Equipe A");
    choose("Filtrar equipes", "Selecionar equipe Equipe B");
    const choices = screen.getByRole("group", { name: "Filtrar equipes" });
    expect(within(choices).getByRole("button", { name: "Retirar equipe Equipe A" })).toBeTruthy();
    expect(within(choices).getByRole("button", { name: "Retirar equipe Equipe B" })).toBeTruthy();
    expect(within(choices).getByRole("button", { name: "Selecionar equipe Equipe C" })).toBeTruthy();
    const staff = screen.getByRole("region", { name: "Pessoas da reunião" });
    const rows = within(staff).getAllByRole("row");
    expect(within(staff).getAllByRole("table")).toHaveLength(1);
    expect(rows[1].textContent).toContain("Ana");
    expect(rows[2].textContent).toContain("Zilda");
    expect(screen.queryByText("Clara")).toBeNull();
    expect(screen.queryByRole("group", { name: /Comparação entre equipes/ })).toBeNull();
  });
  it("keeps simple category and status chips, zoom and costs", () => {
    render(<EfficiencyMeeting {...props} zoom={125} onZoomChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Filtrar equipes" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filtrar funções" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filtrar tipos de equipamento" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filtrar status dos equipamentos" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filtrar centros de custo" })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Manutenção" })).toBeNull();
    expect(screen.getByRole("group", { name: "Zoom da apresentação" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resumo por locadora" })).toBeTruthy();
  });
  it.each(["equipes", "funcionarios", "equipamentos"] as const)("zooms readable content in %s presentation without scaling the controls", mode => {
    function ZoomHarness() {
      const [zoom, setZoom] = useState(100);
      return <EfficiencyMeeting {...props} mode={mode} zoom={zoom} onZoomChange={setZoom} />;
    }
    render(<ZoomHarness />);
    const controls = screen.getByRole("group", { name: "Zoom da apresentação" });
    expect(within(controls).getByText("Zoom")).toBeTruthy();
    const content = screen.getByTestId("presentation-content");
    expect(content.style.zoom).toBe("100%");
    fireEvent.click(within(controls).getByRole("button", { name: "Aumentar zoom" }));
    expect(content.style.zoom).toBe("125%");
    expect(within(controls).getByText("125%")).toBeTruthy();
    fireEvent.click(within(controls).getByRole("button", { name: "Restaurar zoom a 100%" }));
    expect(content.style.zoom).toBe("100%");
    fireEvent.click(within(controls).getByRole("button", { name: "Diminuir zoom" }));
    expect(content.style.zoom).toBe("75%");
    expect(within(controls).getByRole<HTMLButtonElement>("button", { name: "Diminuir zoom" }).disabled).toBe(true);
    expect(controls.closest('[data-testid="presentation-content"]')).toBeNull();
  });
  it("caps zoom to prevent content from growing beyond the supported presentation range", () => {
    function ZoomHarness() {
      const [zoom, setZoom] = useState(175);
      return <EfficiencyMeeting {...props} zoom={zoom} onZoomChange={setZoom} />;
    }
    render(<ZoomHarness />);
    const controls = screen.getByRole("group", { name: "Zoom da apresentação" });
    fireEvent.click(within(controls).getByRole("button", { name: "Aumentar zoom" }));
    expect(screen.getByTestId("presentation-content").style.zoom).toBe("200%");
    expect(within(controls).getByRole<HTMLButtonElement>("button", { name: "Aumentar zoom" }).disabled).toBe(true);
  });
  it("selects only the employee functions to show and restores all explicitly", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" people={[
      props.people[0],
      { ...props.people[0], id: "p3", name: "Cris", role: "Apontador" },
    ]} initialTeam="EQUIPE A" />);
    expect(screen.getByRole("group", { name: "Filtrar funções" })).toBeTruthy();
    choose("Filtrar funções", "Selecionar função Motorista");
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Cris")).toBeNull();
    expect(screen.getByRole("button", { name: "Retirar equipe EQUIPE A" })).toBeTruthy();
    choose("Filtrar funções", "Selecionar função Apontador");
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
    choose("Filtrar centros de custo", "Ocultar centro de custo CC 01");
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
    choose("Filtrar centros de custo", "Ocultar centro de custo CC 01");
    expect(screen.queryByText("Ana")).toBeNull();
    expect(within(fleet).queryByText("CC 01")).toBeNull();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(within(fleet).getByText("CC 02")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar centro de custo CC 01" }));
    expect(screen.getByText("Ana")).toBeTruthy();
  });
  it("selects equipment types to show and recalculates costs while keeping returned fleet out", () => {
    render(<EfficiencyMeeting {...props} mode="equipamentos" equipment={[
      ...props.equipment,
      { ...props.equipment[0], id: "returned", tipo: "GUINDASTE", status: "devolvido", frota: "D3" },
    ]} />);
    expect(screen.getByRole("group", { name: "Filtrar tipos de equipamento" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Selecionar tipo GUINDASTE" })).toBeNull();
    choose("Filtrar tipos de equipamento", "Selecionar tipo ESCAVADEIRA");
    expect(screen.queryByText("A1")).toBeNull();
    expect(screen.queryByText("D3")).toBeNull();
    expect(screen.getByText("B2")).toBeTruthy();
    expect(screen.queryByText("Locadora A")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Todos os tipos" }));
    expect(screen.getByText("A1")).toBeTruthy();
  });
  it("presents only employees across full width with team chips and operational notes", () => {
    render(<EfficiencyMeeting {...props} mode="funcionarios" teams={["EQUIPE A", "SEM PESSOAS"]} pinnedTeams={["SEM PESSOAS"]} initialTeam="EQUIPE A" notes={{ "pessoa:p1": "Rever escala" }} />);
    choose("Filtrar equipes", "Selecionar equipe SEM PESSOAS");
    expect(screen.getByRole("button", { name: "Retirar equipe SEM PESSOAS" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retirar equipe SEM PESSOAS" }));
    expect(screen.getByRole("region", { name: "Apresentação de funcionários" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Apresentação de funcionários" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Pessoas da reunião" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Equipamentos da reunião" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Resumo por locadora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Manutenção" })).toBeNull();
    expect(screen.getByRole("button", { name: "Observação de Ana" })).toBeTruthy();
    expect(screen.queryByText("Beto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Todas as equipes" }));
    choose("Filtrar equipes", "Selecionar equipe Sem equipe");
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });
  it("presents only active fleet with prices and team filters", () => {
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
    expect(screen.queryByRole("button", { name: "Operacionais" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Todas as equipes" }));
    choose("Filtrar equipes", "Selecionar equipe Sem equipe");
    expect(screen.getByText("B2")).toBeTruthy();
  });

  it("prioritizes the roster over financial cards and advanced equipment controls", () => {
    render(<EfficiencyMeeting {...props} />);
    const indicators = screen.getByLabelText("Indicadores do filtro atual");
    expect(within(indicators).getByText("Pessoas no filtro")).toBeTruthy();
    expect(within(indicators).getByText("Equipamentos no filtro")).toBeTruthy();
    expect(within(indicators).queryByText("Mensal conhecido")).toBeNull();
    expect(within(indicators).queryByText("Preços pendentes")).toBeNull();
    expect(within(indicators).queryByText("Em manutenção")).toBeNull();
    expect(within(indicators).queryByText("Terceiros")).toBeNull();
    expect(screen.queryByText("Tipo de equipamento")).toBeNull();
    expect(screen.queryByText("Buscar equipamento ou locadora")).toBeNull();
    expect(screen.queryByRole("button", { name: "Manutenção" })).toBeNull();
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
    choose("Filtrar equipes", "Selecionar equipe Sem equipe");
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
  it("prioritizes configured teams in the complete filter without editing shortcuts", () => {
    const { rerender } = render(<EfficiencyMeeting {...props} teams={["EQUIPE A", "SEM PESSOAS"]} pinnedTeams={[]} />);
    const choices = screen.getByRole("group", { name: "Filtrar equipes" });
    const before = within(choices).getAllByRole("button").map(item => item.getAttribute("aria-label"));
    rerender(<EfficiencyMeeting {...props} teams={["EQUIPE A", "SEM PESSOAS"]} pinnedTeams={["SEM PESSOAS"]} />);
    const after = within(choices).getAllByRole("button").map(item => item.getAttribute("aria-label"));
    expect(after).toContain("Selecionar equipe SEM PESSOAS");
    expect(after.indexOf("Selecionar equipe SEM PESSOAS")).toBeLessThan(before.indexOf("Selecionar equipe SEM PESSOAS"));
    expect(screen.queryByRole("button", { name: "Adicionar balão de equipe" })).toBeNull();
  });
  it("shows every team directly, without an options submenu or Outros+", () => {
    render(<EfficiencyMeeting {...props} />);
    const choices = screen.getByRole("group", { name: "Filtrar equipes" });
    expect(within(choices).getByRole("button", { name: "Selecionar equipe EQUIPE A" })).toBeTruthy();
    expect(screen.queryByText("Outros +")).toBeNull();
    expect(screen.queryByRole("group", { name: "Opções de equipes" })).toBeNull();
  });
  it("shows all, team and unallocated people/equipment with known costs and missing prices", () => {
    render(<EfficiencyMeeting {...props} />);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.getByText(/1 sem valor cadastrado/)).toBeTruthy();
    choose("Filtrar equipes", "Selecionar equipe EQUIPE A");
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Beto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Todas as equipes" }));
    choose("Filtrar equipes", "Selecionar equipe Sem equipe");
    expect(screen.getByText("Beto")).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });
  it("applies equipment filters without hiding people and exits through explicit action", () => {
    const onExit = vi.fn();
    render(<EfficiencyMeeting {...props} onExit={onExit} />);
    choose("Filtrar tipos de equipamento", "Selecionar tipo CAMINHÃO BASCULANTE");
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

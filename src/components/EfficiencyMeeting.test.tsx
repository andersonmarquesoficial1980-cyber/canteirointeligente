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

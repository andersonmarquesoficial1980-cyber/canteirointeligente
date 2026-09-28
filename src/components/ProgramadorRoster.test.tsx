import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgramadorRoster } from "./ProgramadorRoster";

const people = [
  { id: "p1", company_id: "c1", name: "Álvaro", matricula: "01", role: "Motorista", equipe: "Equipe A", status: "ativo" },
  { id: "p2", company_id: "c1", name: "Bruna", matricula: "02", role: "Operadora", equipe: "Equipe B", status: "ativo" },
];
const equipment = [
  { id: "e1", company_id: "c1", frota: "BC10", centro_custo: "CC10", placa: null, tipo: "Basculante", setor: "Equipe A", status: "ativo", condicao: "TERCEIRO", valor_mensal: 1200, empresa_proprietaria: "Locadora A" },
  { id: "e2", company_id: "c1", frota: "RL02", centro_custo: null, placa: null, tipo: "Rolo", setor: "Equipe B", status: "em_manutencao", condicao: "PROPRIO", valor_mensal: null, empresa_proprietaria: null },
];
const base = { people, equipment, teams: ["Equipe A", "Equipe B"], saving: false, error: "", onSavePerson: vi.fn().mockResolvedValue(undefined), onSaveEquipment: vi.fn().mockResolvedValue(undefined), onSavePrice: vi.fn().mockResolvedValue(1300) };

describe("abas de listas do WF Programador", () => {
  it("opens directly on all employees, with search and function filter but no date or movement form", () => {
    render(<ProgramadorRoster {...base} kind="funcionarios" />);
    expect(screen.getByText("Álvaro")).toBeTruthy();
    expect(screen.getByText("Bruna")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Gerenciar/ }).map(button => button.getAttribute("aria-label")))
      .toEqual(["Gerenciar Álvaro", "Gerenciar Bruna"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Ordem alfabética" }), { target: { value: "desc" } });
    expect(screen.getAllByRole("button", { name: /^Gerenciar/ }).map(button => button.getAttribute("aria-label")))
      .toEqual(["Gerenciar Bruna", "Gerenciar Álvaro"]);
    expect(screen.queryByText("Data *")).toBeNull();
    expect(screen.queryByText("De")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por função" }), { target: { value: "Motorista" } });
    expect(screen.getByText("Álvaro")).toBeTruthy();
    expect(screen.queryByText("Bruna")).toBeNull();
  });
  it("edits one employee inline rather than a separate movement form", async () => {
    const onSavePerson = vi.fn().mockResolvedValue(undefined);
    render(<ProgramadorRoster {...base} kind="funcionarios" onSavePerson={onSavePerson} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar Álvaro" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status de Álvaro" }), { target: { value: "afastado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Álvaro" }));
    await waitFor(() => expect(onSavePerson).toHaveBeenCalledWith("p1", { equipe: "Equipe A", status: "afastado" }));
  });
  it("edits exactly one equipment inline by its master ID", async () => {
    const onSaveEquipment = vi.fn().mockResolvedValue(undefined);
    render(<ProgramadorRoster {...base} kind="equipamentos" onSaveEquipment={onSaveEquipment} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar RL02" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status de RL02" }), { target: { value: "ativo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar RL02" }));
    await waitFor(() => expect(onSaveEquipment).toHaveBeenCalledWith("e2", { setor: "Equipe B", status: "ativo" }));
  });
  it("lists all equipment with fleet/type filters and offers monthly price for third parties", async () => {
    const onSavePrice = vi.fn().mockResolvedValue(1300);
    render(<ProgramadorRoster {...base} kind="equipamentos" onSavePrice={onSavePrice} />);
    expect(screen.getByText(/BC10/)).toBeTruthy();
    expect(screen.getByText("RL02")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por tipo" }), { target: { value: "Basculante" } });
    expect(screen.queryByText("RL02")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por tipo" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar frota, placa ou equipamento" }), { target: { value: "bc10" } });
    expect(screen.queryByText("RL02")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar BC10" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Valor mensal BC10" }), { target: { value: "1.300,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar valor mensal BC10" }));
    await waitFor(() => expect(onSavePrice).toHaveBeenCalledWith("e1", "1.300,00"));
  });
});

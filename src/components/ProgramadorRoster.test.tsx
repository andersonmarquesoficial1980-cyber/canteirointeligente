import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it.each([
    { kind: "funcionarios" as const, group: "Filtrar por função", chosen: "Motorista", other: "Operadora", all: "Todas as funções", visible: "Álvaro", hidden: "Bruna", total: "Pessoas 1" },
    { kind: "equipamentos" as const, group: "Filtrar por tipo", chosen: "Basculante", other: "Rolo", all: "Todos os tipos", visible: "Gerenciar BC10", hidden: "Gerenciar RL02", total: "Equipamentos 1" },
  ])("filters $kind using category chips instead of a dropdown", ({ kind, group, chosen, other, all, visible, hidden, total }) => {
    render(<ProgramadorRoster {...base} kind={kind} />);
    const choices = screen.getByRole("group", { name: group });
    expect(within(choices).getByRole("button", { name: chosen })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: group })).toBeNull();
    fireEvent.click(within(choices).getByRole("button", { name: chosen }));
    expect(within(choices).getByRole("button", { name: chosen }).getAttribute("aria-pressed")).toBe("true");
    expect(within(choices).getByRole("button", { name: other })).toBeTruthy();
    if (kind === "funcionarios") {
      expect(screen.getByText(visible)).toBeTruthy();
      expect(screen.queryByText(hidden)).toBeNull();
    } else {
      expect(screen.getByRole("button", { name: visible })).toBeTruthy();
      expect(screen.queryByRole("button", { name: hidden })).toBeNull();
    }
    expect(screen.getByRole("region", { name: "Resumo da lista filtrada" }).textContent).toContain(total);
    fireEvent.click(within(choices).getByRole("button", { name: all }));
    expect(within(choices).getByRole("button", { name: chosen }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "Resumo da lista filtrada" }).textContent).toContain(kind === "funcionarios" ? "Pessoas 2" : "Equipamentos 2");
  });
  it("recalculates the equipment footer for the full filtered list, excluding returned historical cost", () => {
    render(<ProgramadorRoster {...base} kind="equipamentos" equipment={[
      ...equipment,
      { ...equipment[0], id: "missing", frota: "BC11", centro_custo: "BC11", valor_mensal: null },
      { ...equipment[0], id: "returned", frota: "DEV01", centro_custo: "DEV01", status: "devolvido", valor_mensal: 9000 },
    ]} />);
    const footer = screen.getByRole("region", { name: "Resumo da lista filtrada" });
    expect(footer.textContent).toContain("Equipamentos 4");
    expect(footer.textContent).toContain("Terceiros não devolvidos 2");
    expect(footer.textContent).toContain("1.200,00");
    expect(footer.textContent).toContain("Sem valor 1");
    expect(footer.textContent).not.toContain("9.000,00");
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por status" })).getByRole("button", { name: "Devolvido" }));
    expect(footer.textContent).toContain("Equipamentos 1");
    expect(footer.textContent).toContain("Terceiros não devolvidos 0");
    expect(footer.textContent).toContain("0,00");
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por status" })).getByRole("button", { name: "Todos os status" }));
    fireEvent.click(screen.getByRole("button", { name: "Equipe B" }));
    expect(footer.textContent).toContain("Equipamentos 1");
    expect(footer.textContent).toContain("Terceiros não devolvidos 0");
  });
  it("filters the master equipment list with visible status chips, including returned history", () => {
    render(<ProgramadorRoster {...base} kind="equipamentos" equipment={[
      ...equipment, { ...equipment[0], id: "returned", frota: "DEV01", centro_custo: "DEV01", status: "devolvido" },
    ]} />);
    const statuses = screen.getByRole("group", { name: "Filtrar por status" });
    fireEvent.click(within(statuses).getByRole("button", { name: "Devolvido" }));
    expect(within(statuses).getByRole("button", { name: "Devolvido" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(statuses).getByRole("button", { name: "Operacional" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gerenciar DEV01" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Gerenciar BC10" })).toBeNull();
    fireEvent.click(within(statuses).getByRole("button", { name: "Todos os status" }));
    expect(screen.getByRole("button", { name: "Gerenciar BC10" })).toBeTruthy();
  });
  it.each(["funcionarios", "equipamentos"] as const)("offers customizable shared team chips and presentation in %s", kind => {
    const onPresent = vi.fn();
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    render(<ProgramadorRoster {...base} kind={kind} pinnedTeams={["Equipe A"]} onPin={onPin} onUnpin={onUnpin} onPresent={onPresent} />);
    const chips = screen.getByRole("group", { name: "Equipes em destaque" });
    expect(within(chips).getByRole("button", { name: "Equipe A" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar balão de equipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Fixar Equipe B" }));
    expect(onPin).toHaveBeenCalledWith("Equipe B");
    fireEvent.click(within(chips).getByRole("button", { name: "Equipe A" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover balão Equipe A" }));
    expect(onUnpin).toHaveBeenCalledWith("Equipe A");
    fireEvent.click(screen.getByRole("button", { name: "Apresentar lista" }));
    expect(onPresent).toHaveBeenCalledWith("Equipe A");
    fireEvent.click(within(chips).getByRole("button", { name: "Sem equipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Apresentar lista" }));
    expect(onPresent).toHaveBeenLastCalledWith("__sem_equipe__");
  });
  it("does not enter presentation with unsaved employee edits", () => {
    const onPresent = vi.fn();
    render(<ProgramadorRoster {...base} kind="funcionarios" onPresent={onPresent} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar Álvaro" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status de Álvaro" }), { target: { value: "afastado" } });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Apresentar lista" }).disabled).toBe(true);
  });
  it("shows a warning if browser-local pinned teams could not be persisted", () => {
    render(<ProgramadorRoster {...base} kind="equipamentos" pinsError="Não foi possível salvar os balões neste navegador." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar os balões");
  });
  it("retains employee filters while the presentation is shown and exited", () => {
    function Flow() {
      const [present, setPresent] = useState(false);
      return <><div hidden={present}><ProgramadorRoster {...base} kind="funcionarios" onPresent={() => setPresent(true)} /></div>
        {present && <button type="button" onClick={() => setPresent(false)}>Sair da apresentação</button>}</>;
    }
    render(<Flow />);
    fireEvent.click(screen.getByRole("button", { name: "Equipe A" }));
    expect(screen.queryByText("Bruna")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apresentar lista" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair da apresentação" }));
    expect(screen.queryByText("Bruna")).toBeNull();
    expect(screen.getByRole("button", { name: "Equipe A" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("opens the requested record even when the previous team filter hid it", () => {
    const { rerender } = render(<ProgramadorRoster {...base} kind="funcionarios" />);
    fireEvent.click(screen.getByRole("button", { name: "Equipe A" }));
    expect(screen.queryByText("Bruna")).toBeNull();
    rerender(<ProgramadorRoster {...base} kind="funcionarios" initialSelectedId="p2" />);
    expect(screen.getByRole("combobox", { name: "Status de Bruna" })).toBeTruthy();
  });
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
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por função" })).getByRole("button", { name: "Motorista" }));
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
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole("button", { name: "Basculante" }));
    expect(screen.queryByText("RL02")).toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo" })).getByRole("button", { name: "Todos os tipos" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar frota, placa ou equipamento" }), { target: { value: "bc10" } });
    expect(screen.queryByText("RL02")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar BC10" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Valor mensal BC10" }), { target: { value: "1.300,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar valor mensal BC10" }));
    await waitFor(() => expect(onSavePrice).toHaveBeenCalledWith("e1", "1.300,00"));
  });
});

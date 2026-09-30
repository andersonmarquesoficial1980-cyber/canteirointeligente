import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { balloonOptions } from "@/lib/programadorMeeting";
import { PresentationBalloons } from "./PresentationBalloons";

const options = ["AJUDANTE", "APONTADOR", "MOTORISTA", "OPERADOR", "SINALEIRO", "TÉCNICO"].map(label => ({ key: label.toLowerCase(), label, count: 2 }));

describe("balões simples da apresentação", () => {
  it("keeps every team in the same position after choosing several", () => {
    function Teams() {
      const [selected, setSelected] = useState<string[]>([]);
      return <PresentationBalloons title="Equipes" groupLabel="Filtrar equipes" singular="equipe"
        options={[{ key: "A", label: "Equipe A", count: 2 }, { key: "B", label: "Equipe B", count: 1 }]}
        mode="include" selected={selected} allLabel="Todas as equipes"
        onToggle={key => setSelected(items => items.includes(key) ? items.filter(item => item !== key) : [...items, key])}
        onReset={() => setSelected([])} />;
    }
    render(<Teams />);
    const filter = screen.getByRole("group", { name: "Filtrar equipes" });
    fireEvent.click(within(filter).getByRole("button", { name: "Selecionar equipe Equipe A" }));
    expect(within(filter).getByRole("button", { name: "Retirar equipe Equipe A" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(filter).getByRole("button", { name: "Selecionar equipe Equipe B" })).toBeTruthy();
    fireEvent.click(within(filter).getByRole("button", { name: "Selecionar equipe Equipe B" }));
    expect(within(filter).getByRole("button", { name: "Retirar equipe Equipe A" })).toBeTruthy();
    expect(within(filter).getByRole("button", { name: "Retirar equipe Equipe B" })).toBeTruthy();
    fireEvent.click(within(filter).getByRole("button", { name: "Todas as equipes" }));
    expect(within(filter).getByRole("button", { name: "Selecionar equipe Equipe A" })).toBeTruthy();
  });
  it("groups spelling variants and missing cost centers", () => {
    const rows = [{ cost: " CC 01 " }, { cost: "cc 01" }, { cost: null }];
    expect(balloonOptions(rows, row => row.cost, "__sem_centro__", "Sem centro de custo")).toEqual([
      { key: "cc 01", label: "CC 01", count: 2 },
      { key: "__sem_centro__", label: "Sem centro de custo", count: 1 },
    ]);
  });
  it("shows all function choices in one place and allows multiple inclusions", () => {
    function Roles() {
      const [selected, setSelected] = useState<string[]>([]);
      return <PresentationBalloons title="Funções" groupLabel="Filtrar funções" singular="função" options={options}
        mode="include" selected={selected} allLabel="Todas as funções"
        onToggle={key => setSelected(items => items.includes(key) ? items.filter(item => item !== key) : [...items, key])}
        onReset={() => setSelected([])} />;
    }
    render(<Roles />);
    const filter = screen.getByRole("group", { name: "Filtrar funções" });
    expect(within(filter).getAllByRole("button")).toHaveLength(7);
    fireEvent.click(within(filter).getByRole("button", { name: "Selecionar função AJUDANTE" }));
    fireEvent.click(within(filter).getByRole("button", { name: "Selecionar função MOTORISTA" }));
    expect(within(filter).getByRole("button", { name: "Retirar função AJUDANTE" })).toBeTruthy();
    expect(within(filter).getByRole("button", { name: "Retirar função MOTORISTA" })).toBeTruthy();
    expect(screen.queryByText("Outros +")).toBeNull();
  });
  it("keeps hidden centers visible, reversible and distinct from selected inclusion", () => {
    function Centers() {
      const [hidden, setHidden] = useState<string[]>([]);
      return <PresentationBalloons title="Centros de custo" groupLabel="Filtrar centros de custo" singular="centro de custo"
        options={[{ key: "cc 01", label: "CC 01", count: 3 }, { key: "cc 02", label: "CC 02", count: 2 }]}
        mode="exclude" hidden={hidden}
        onToggle={key => setHidden(items => items.includes(key) ? items.filter(item => item !== key) : [...items, key])}
        onReset={() => setHidden([])} />;
    }
    render(<Centers />);
    const filter = screen.getByRole("group", { name: "Filtrar centros de custo" });
    fireEvent.click(within(filter).getByRole("button", { name: "Ocultar centro de custo CC 01" }));
    expect(within(filter).getByRole("button", { name: "Restaurar centro de custo CC 01" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(filter).getByRole("button", { name: "Restaurar centro de custo CC 01" }));
    expect(within(filter).getByRole("button", { name: "Ocultar centro de custo CC 01" })).toBeTruthy();
  });
});
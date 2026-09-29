import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { balloonOptions } from "@/lib/programadorMeeting";
import { PresentationBalloons } from "./PresentationBalloons";

const options = ["AJUDANTE", "APONTADOR", "MOTORISTA", "OPERADOR", "SINALEIRO", "TÉCNICO"].map(label => ({ key: label.toLowerCase(), label, count: 2 }));

describe("filtros corporativos da apresentação", () => {
  it("groups spelling variants and missing cost centers", () => {
    const rows = [{ cost: " CC 01 " }, { cost: "cc 01" }, { cost: null }];
    expect(balloonOptions(rows, row => row.cost, "__sem_centro__", "Sem centro de custo")).toEqual([
      { key: "cc 01", label: "CC 01", count: 2 },
      { key: "__sem_centro__", label: "Sem centro de custo", count: 1 },
    ]);
  });
  it("searches every function without truncated shortcuts and selects multiple", () => {
    function Filter() {
      const [selected, setSelected] = useState<string[]>([]);
      return <PresentationBalloons title="Funções" groupLabel="Filtrar funções" singular="função" options={options}
        mode="include" selected={selected} allLabel="Todas as funções"
        onToggle={key => setSelected(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])}
        onReset={() => setSelected([])} />;
    }
    render(<Filter />);
    expect(screen.queryByText("Outros +")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar funções" }));
    const choices = screen.getByRole("group", { name: "Opções de funções" });
    expect(within(choices).getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.change(within(choices).getByRole("textbox", { name: "Buscar função" }), { target: { value: "AJU" } });
    fireEvent.click(within(choices).getByRole("checkbox", { name: "Selecionar função AJUDANTE" }));
    expect(screen.getByRole("button", { name: "Retirar função AJUDANTE" })).toBeTruthy();
    fireEvent.change(within(choices).getByRole("textbox", { name: "Buscar função" }), { target: { value: "motor" } });
    fireEvent.click(within(choices).getByRole("checkbox", { name: "Selecionar função MOTORISTA" }));
    expect(screen.getByRole("button", { name: "Retirar função MOTORISTA" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Todas as funções" }));
    expect(screen.queryByRole("button", { name: "Retirar função AJUDANTE" })).toBeNull();
  });
  it("restores excluded centers from either selected chip or complete checklist", () => {
    function Filter() {
      const [hidden, setHidden] = useState<string[]>([]);
      return <PresentationBalloons title="Centros de custo" groupLabel="Filtrar centros de custo" singular="centro de custo"
        options={[{ key: "cc 01", label: "CC 01", count: 3 }, { key: "cc 02", label: "CC 02", count: 2 }]}
        mode="exclude" hidden={hidden}
        onToggle={key => setHidden(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])}
        onReset={() => setHidden([])} />;
    }
    render(<Filter />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar centros de custo" }));
    const choices = screen.getByRole("group", { name: "Opções de centros de custo" });
    fireEvent.click(within(choices).getByRole("checkbox", { name: "Ocultar centro de custo CC 01" }));
    expect(within(choices).getByRole("checkbox", { name: "Restaurar centro de custo CC 01" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar centro de custo CC 01" }));
    expect(within(choices).getByRole("checkbox", { name: "Ocultar centro de custo CC 01" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("Outros +")).toBeNull();
  });
});
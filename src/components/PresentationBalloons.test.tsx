import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { balloonOptions } from "@/lib/programadorMeeting";
import { PresentationBalloons } from "./PresentationBalloons";

describe("balões de visibilidade na apresentação", () => {
  it("groups spelling variants without losing the blank cost center", () => {
    const rows = [{ cost: " CC 01 " }, { cost: "cc 01" }, { cost: null }];
    expect(balloonOptions(rows, row => row.cost, "__sem_centro__", "Sem centro de custo")).toEqual([
      { key: "cc 01", label: "CC 01", count: 2 },
      { key: "__sem_centro__", label: "Sem centro de custo", count: 1 },
    ]);
  });
  it("keeps the searchable options menu outside the horizontally scrolling balloons", () => {
    const options = ["A", "B", "C", "D", "E", "F"].map(label => ({ key: label.toLowerCase(), label, count: 1 }));
    render(<PresentationBalloons title="Funções" groupLabel="Filtrar funções" singular="função" options={options} hidden={[]}
      onToggle={vi.fn()} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar mais filtrar funções" }));
    const search = screen.getByRole("textbox", { name: "Buscar filtrar funções" });
    expect(search.closest(".overflow-x-auto")).toBeNull();
    fireEvent.change(search, { target: { value: "F" } });
    expect(screen.getByRole("button", { name: "Ocultar função F" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ocultar função E" })).toBeNull();
  });
});

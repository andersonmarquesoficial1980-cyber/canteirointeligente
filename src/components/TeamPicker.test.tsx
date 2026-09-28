import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TeamPicker, rankTeamsByAllocation } from "./TeamPicker";

const teams = ["AFASTADOS", "AVARÉ", "CBUQ01 - AELSON", "CBUQ02 - JOSENILDO", "OBRA CENTRAL", "SERRALHERIA"];

describe("seleção compacta de equipe", () => {
  it("pins a team through + and removes a chip through its X without deleting the team", () => {
    const onPin = vi.fn();
    const onUnpin = vi.fn();
    const { rerender } = render(<TeamPicker teams={teams} pinned={["CBUQ01 - AELSON"]} value="CBUQ01 - AELSON" onChange={vi.fn()} onPin={onPin} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar balão de equipe" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar equipe para fixar" }), { target: { value: "serralheria" } });
    fireEvent.click(screen.getByRole("button", { name: "Fixar SERRALHERIA" }));
    expect(onPin).toHaveBeenCalledWith("SERRALHERIA");
    rerender(<TeamPicker teams={teams} pinned={["CBUQ01 - AELSON", "SERRALHERIA"]} value="CBUQ01 - AELSON" onChange={vi.fn()} onPin={onPin} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover balão CBUQ01 - AELSON" }));
    expect(onUnpin).toHaveBeenCalledWith("CBUQ01 - AELSON");
    rerender(<TeamPicker teams={teams} pinned={["SERRALHERIA"]} value="CBUQ01 - AELSON" onChange={vi.fn()} onPin={onPin} onUnpin={onUnpin} />);
    expect(within(screen.getByRole("group", { name: "Equipes em destaque" })).queryByRole("button", { name: "CBUQ01 - AELSON" })).toBeNull();
    expect(screen.getByText(/Atual: CBUQ01 - AELSON/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buscar outra equipe" }));
    expect(screen.getByRole("button", { name: "CBUQ01 - AELSON" })).toBeTruthy();
  });
  it("does not expose add/remove in presentation mode while honoring pinned choices", () => {
    render(<TeamPicker teams={teams} pinned={["SERRALHERIA"]} value="" onChange={vi.fn()} allowAll allowNoTeam />);
    expect(screen.queryByRole("button", { name: "Adicionar balão de equipe" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remover balão/ })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Equipes em destaque" })).getByRole("button", { name: "SERRALHERIA" })).toBeTruthy();
  });
  it("prioritizes populated teams and keeps empty teams searchable", () => {
    expect(rankTeamsByAllocation(teams,
      [{ equipe: "CBUQ01 - AELSON" }, { equipe: "CBUQ01 - AELSON" }],
      [{ setor: "OBRA CENTRAL" }]).slice(0, 2)).toEqual(["CBUQ01 - AELSON", "OBRA CENTRAL"]);
    expect(rankTeamsByAllocation(teams, [], [])).toHaveLength(teams.length);
  });
  it("keeps the current team visible as a chip even when not featured", () => {
    const onChange = vi.fn();
    render(<TeamPicker teams={teams} featured={["AFASTADOS", "AVARÉ", "OBRA CENTRAL", "SERRALHERIA"]} value="CBUQ01 - AELSON" onChange={onChange} />);
    const quick = screen.getByRole("group", { name: "Equipes em destaque" });
    expect(within(quick).getByRole("button", { name: "CBUQ01 - AELSON" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(quick).getByRole("button", { name: "OBRA CENTRAL" }));
    expect(onChange).toHaveBeenCalledWith("OBRA CENTRAL");
  });
  it("searches every team without expanding the entire page", () => {
    const onChange = vi.fn();
    render(<TeamPicker teams={teams} value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "SERRALHERIA" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buscar outra equipe" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar equipe" }), { target: { value: "serralheria" } });
    fireEvent.click(screen.getByRole("button", { name: "SERRALHERIA" }));
    expect(onChange).toHaveBeenCalledWith("SERRALHERIA");
    expect(screen.queryByRole("textbox", { name: "Buscar equipe" })).toBeNull();
  });
  it("offers Sem equipe in management even with no pinned teams", () => {
    const onChange = vi.fn();
    render(<TeamPicker teams={teams} pinned={[]} value="" onChange={onChange} onPin={vi.fn()} onUnpin={vi.fn()} allowNoTeam />);
    const quick = screen.getByRole("group", { name: "Equipes em destaque" });
    fireEvent.click(within(quick).getByRole("button", { name: "Sem equipe" }));
    expect(onChange).toHaveBeenCalledWith("__sem_equipe__");
  });
  it("preserves all-teams and unallocated choices in the read-only meeting", () => {
    const onChange = vi.fn();
    render(<TeamPicker teams={teams} value="" onChange={onChange} allowAll allowNoTeam />);
    const quick = screen.getByRole("group", { name: "Equipes em destaque" });
    expect(within(quick).getByRole("button", { name: "Todas as equipes" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(quick).getByRole("button", { name: "Sem equipe" }));
    expect(onChange).toHaveBeenCalledWith("__sem_equipe__");
  });
});

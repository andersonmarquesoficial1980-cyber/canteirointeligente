import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TeamPicker, rankTeamsByAllocation } from "./TeamPicker";

const teams = ["AFASTADOS", "AVARÉ", "CBUQ01 - AELSON", "CBUQ02 - JOSENILDO", "OBRA CENTRAL", "SERRALHERIA"];

describe("seleção compacta de equipe", () => {
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
  it("preserves all-teams and unallocated choices in the read-only meeting", () => {
    const onChange = vi.fn();
    render(<TeamPicker teams={teams} value="" onChange={onChange} allowAll allowNoTeam />);
    const quick = screen.getByRole("group", { name: "Equipes em destaque" });
    expect(within(quick).getByRole("button", { name: "Todas as equipes" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(quick).getByRole("button", { name: "Sem equipe" }));
    expect(onChange).toHaveBeenCalledWith("__sem_equipe__");
  });
});

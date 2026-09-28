import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProgramadorPinnedTeams, pinnedTeamsKey } from "./useProgramadorPinnedTeams";

const teams = ["EQUIPE A", "EQUIPE B", "EQUIPE C"];
const defaults = ["EQUIPE A", "EQUIPE B"];
beforeEach(() => localStorage.clear());

describe("balões configuráveis por usuário e empresa", () => {
  it("starts with suggested teams and keeps additions/removals across remounts", () => {
    const first = renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults));
    expect(first.result.current.pinned).toEqual(defaults);
    act(() => first.result.current.unpin("EQUIPE A"));
    act(() => first.result.current.pin("EQUIPE C"));
    expect(first.result.current.pinned).toEqual(["EQUIPE B", "EQUIPE C"]);
    first.unmount();
    const second = renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults));
    expect(second.result.current.pinned).toEqual(["EQUIPE B", "EQUIPE C"]);
  });
  it("allows removing every chip without automatically reinstating defaults", () => {
    const first = renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults));
    act(() => { first.result.current.unpin("EQUIPE A"); });
    act(() => { first.result.current.unpin("EQUIPE B"); });
    first.unmount();
    expect(renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults)).result.current.pinned).toEqual([]);
  });
  it("isolates accounts and ignores teams no longer available for that company", () => {
    localStorage.setItem(pinnedTeamsKey("company-1", "user-1"), JSON.stringify(["EQUIPE C", "OUTRA EMPRESA", "EQUIPE C"]));
    expect(renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults)).result.current.pinned).toEqual(["EQUIPE C"]);
    expect(renderHook(() => useProgramadorPinnedTeams("company-2", "user-1", teams, defaults)).result.current.pinned).toEqual(defaults);
    expect(renderHook(() => useProgramadorPinnedTeams("company-1", "user-2", teams, defaults)).result.current.pinned).toEqual(defaults);
  });
  it("never adds a team that is not in the loaded company catalog", () => {
    const hook = renderHook(() => useProgramadorPinnedTeams("company-1", "user-1", teams, defaults));
    act(() => hook.result.current.pin("OUTRA EMPRESA"));
    expect(hook.result.current.pinned).toEqual(defaults);
  });
});

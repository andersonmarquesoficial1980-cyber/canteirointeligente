import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true, resolveProgramacoes: undefined as undefined | ((value: { data: unknown[] }) => void) }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/components/manutencao/NovaOSModal", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const response = table === "ci_programacoes"
      ? new Promise<{ data: unknown[] }>(resolve => { state.resolveProgramacoes = resolve; })
      : Promise.resolve({ data: [{ id: "os-1", numero_os: 12, titulo: "Troca de óleo", equipment_fleet: "ROLO 1", equipment_type: "Rolo", status: "aberta", prioridade: "normal", data_abertura: "2026-10-14" }] });
    const query = { select: () => query, order: () => query, in: () => query, eq: () => query, then: response.then.bind(response) };
    return query;
  },
} }));
import ManutencaoHome from "./ManutencaoHome";
afterEach(() => { state.resolveProgramacoes?.({ data: [] }); state.resolveProgramacoes = undefined; state.desktop = true; cleanup(); });

describe("WF Manutenção no desktop", () => {
  it("mostra a lista de OS mesmo quando a consulta de programações demora", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ManutencaoHome /></MemoryRouter>);
    expect(await screen.findByText("Troca de óleo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "WF Manutenção" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova OS/ })).toBeInTheDocument();
    expect(state.resolveProgramacoes).toBeTypeOf("function");
    expect(screen.getByRole("status")).toHaveTextContent("Consultando programações");
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.queryByText("Troca de óleo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ativas" }));
    expect(screen.getByText("Troca de óleo")).toBeInTheDocument();
    await act(async () => state.resolveProgramacoes?.({ data: [{ id: "prog-1", equipe: "Equipe Norte", data: "2026-10-14", periodo: "dia", equipamentos_designados: [] }] }));
    expect(screen.getByText("Equipe Norte")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Troca de óleo")).toBeInTheDocument();
  });
  it("mantém a largura anterior no mobile", () => {
    state.desktop = false;
    const { container } = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ManutencaoHome /></MemoryRouter>);
    expect(container.querySelector(".max-w-2xl")).not.toBeNull();
  });
});

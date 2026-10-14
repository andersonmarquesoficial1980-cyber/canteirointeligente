import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const result = Promise.resolve({ data: [], error: null });
    const q = { select: () => q, eq: () => q, not: () => q, then: result.then.bind(result) };
    return q;
  },
} }));
import MedicoesHome from "./MedicoesHome";
function Route() { return <output aria-label="Rota">{useLocation().pathname}</output>; }
function mount() { return render(<MemoryRouter initialEntries={["/medicoes"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MedicoesHome /><Route /></MemoryRouter>); }
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Medições desktop", () => {
  it("mostra a central larga com trilha, sem inserir cabeçalho na impressão", async () => {
    let mounted!: ReturnType<typeof mount>;
    await act(async () => { mounted = mount(); });
    const { container } = mounted;
    expect(screen.getByRole("heading", { name: "WF Medições" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(container.querySelector("header")?.className).toContain("print:hidden");
    expect(container.querySelector("main")?.className).toContain("max-w-[1680px]");
    fireEvent.click(screen.getByRole("button", { name: /Medições de Terceiros/ }));
    expect(screen.getByRole("status", { name: "Rota" })).toHaveTextContent("/medicoes/terceiros");
  });
  it("preserva cabeçalho compacto e conteúdo original no mobile", async () => {
    state.desktop = false;
    let mounted!: ReturnType<typeof mount>;
    await act(async () => { mounted = mount(); });
    const { container } = mounted;
    expect(container.querySelector("main")?.className).toContain("max-w-7xl");
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
    expect(screen.getByText("Fechamento de equipamentos terceirizados")).toBeInTheDocument();
  });
});

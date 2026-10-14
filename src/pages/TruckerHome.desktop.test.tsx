import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock("@/hooks/useOgsReference", () => ({ useOgsReference: () => ({ data: [] }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/components/rdo/ResponsavelInput", () => ({ ResponsavelInput: () => null }));

import TruckerHome from "./TruckerHome";
function Route() { const location = useLocation(); return <output aria-label="Rota">{location.pathname}{location.search}</output>; }
function mount(path = "/carreteiros?origem=gestao-frotas") {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TruckerHome /><Route /></MemoryRouter>);
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Carreteiros desktop", () => {
  it("abre uma central ampla com trilha e mantém Saída como aba inicial", () => {
    const { container } = mount();
    expect(screen.getByRole("heading", { name: "WF Carreteiros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Saída (Obra)" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: "Lançar Saída" })).toBeInTheDocument();
    expect(container.querySelector('[data-testid="carreteiros-content"]')?.className).toContain("max-w-[1680px]");
  });
  it("mantém a origem no atalho para os QR Codes", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Gerar QR Codes" }));
    expect(screen.getByRole("status", { name: "Rota" })).toHaveTextContent("/carreteiros/qrcodes?origem=gestao-frotas");
  });
  it("preserva o cabeçalho compacto e abas anteriores no mobile", () => {
    state.desktop = false;
    const { container } = mount("/carreteiros");
    expect(container.querySelector(".max-w-lg")).not.toBeNull();
    expect(screen.getByRole("tab", { name: /Saída \(Obra\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
  });
});

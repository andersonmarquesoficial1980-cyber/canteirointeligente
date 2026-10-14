import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: null }) }));
vi.mock("@/components/ProgramacoesDoDia", () => ({ default: () => null }));
vi.mock("@/components/IntegracaoObrasCard", () => ({ default: () => <p>Integrações por Obra</p> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const result = Promise.resolve({ data: [{ id: "e1", name: "Ana", role: "Encarregada" }], error: null });
    const q = { select: () => q, or: () => q, order: () => q, then: result.then.bind(result) };
    return q;
  },
} }));
import GestaoPessoasDashboard from "./GestaoPessoasDashboard";
function Location() { const l = useLocation(); return <output aria-label="Rota">{l.pathname}{l.search}</output>; }
function mount() {
  return render(<MemoryRouter initialEntries={["/gestao-pessoas?origem=gestao-frotas"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GestaoPessoasDashboard /><Location /></MemoryRouter>);
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Gestão de Pessoas desktop", () => {
  it("mostra cabeçalho e trilha, custos e cadastros na área de trabalho", async () => {
    await act(async () => { mount(); });
    expect(screen.getByRole("heading", { name: "WF Gestão de Pessoas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByTestId("pessoas-hub").className).toContain("max-w-[1680px]");
    expect(screen.getByTestId("pessoas-grupos").className).toContain("xl:grid-cols-2");
    expect(screen.getByText("Custos MDO (por função, funcionário e equipe)")).toBeInTheDocument();
    expect(screen.getByText("Conferência de Ponto (PDF RH)")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("1 funcionários")).toBeInTheDocument());
  });
  it("preserva origem e retorno ao abrir o cadastro", async () => {
    await act(async () => { mount(); });
    fireEvent.click(screen.getByRole("button", { name: /Cadastro de Funcionários/ }));
    const path = screen.getByRole("status", { name: "Rota" }).textContent || "";
    const [pathname, query] = path.split("?");
    expect(pathname).toBe("/gestao-pessoas/equipe");
    const params = new URLSearchParams(query);
    expect(params.get("origem")).toBe("gestao-frotas");
    expect(params.get("returnTo")).toBe("/gestao-pessoas?origem=gestao-frotas");
  });
  it("mantém o cabeçalho compacto e largura original no mobile", async () => {
    state.desktop = false;
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.queryByRole("heading", { name: "WF Gestão de Pessoas" })).toBeNull();
    expect(view.container.querySelector('[style*="max-width: 760px"]')).not.toBeNull();
    expect(screen.getByText("Cadastro de Funcionários")).toBeInTheDocument();
  });
});

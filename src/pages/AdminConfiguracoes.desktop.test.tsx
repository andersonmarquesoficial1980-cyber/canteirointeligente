import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: true, loading: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ permissions: { is_admin: true }, loading: false }) }));
vi.mock("@/hooks/useCompanyModules", () => ({ useCompanyModules: () => ({ isSuperAdmin: false, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  getUser: async () => ({ data: { user: null } }), signOut: vi.fn(),
} } }));
vi.mock("./WFDashboards", () => ({ default: () => <p>Dashboards do Painel</p> }));
import AdminConfiguracoes from "./AdminConfiguracoes";
function Location() { const location = useLocation(); return <output aria-label="Rota">{location.pathname}{location.search}</output>; }
async function mount() {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={["/admin/configuracoes?section=dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdminConfiguracoes /><Location /></MemoryRouter>);
  });
  return view;
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("Painel de Controle desktop", () => {
  it("mostra cabeçalho e trilha da área de trabalho sem remover a navegação interna por seção", async () => {
    const view = await mount();
    expect(screen.getByRole("heading", { name: "Painel de Controle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(view.container.querySelector("main > div")?.className).toContain("max-w-[1680px]");
    expect(screen.getByRole("navigation", { name: "Seções do Painel de Controle" }).querySelectorAll("button").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Frota (Equipamentos)" })).toHaveLength(2);
    expect(screen.getByRole("status", { name: "Rota" })).toHaveTextContent("section=dashboard");
    expect(screen.queryByRole("button", { name: "Admin Roles" })).toBeNull();
  });
  it("mantém cabeçalho compacto e seções no mobile", async () => {
    state.desktop = false;
    const view = await mount();
    expect(screen.getByRole("heading", { name: "Painel de Controle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
    expect(view.container.querySelector("main > div")?.className).toContain("max-w-5xl");
    expect(screen.getAllByRole("button", { name: "Frota (Equipamentos)" })).toHaveLength(2);
  });
});

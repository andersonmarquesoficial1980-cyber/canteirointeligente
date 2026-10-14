import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const flags = vi.hoisted(() => ({ desktop: true, equipment: ["Rolo"] as string[] }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => flags.desktop }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/useNavigationTrail", () => ({ useNavigationTrail: () => ({ trail: [], goTo: vi.fn() }) }));
vi.mock("@/components/navigation/NavigationTrail", () => ({ NavigationTrail: () => <nav aria-label="Trilha" /> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "usuario" } } }), signOut: vi.fn() },
  from: (table: string) => {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: { is_admin: false, equipamentos_permitidos: flags.equipment } }), maybeSingle: async () => ({ data: { id: "perfil" } }) };
    return q;
  },
} }));
import EquipmentHome from "./EquipmentHome";
function Current() { return <output>{useLocation().pathname}{useLocation().search}</output>; }
afterEach(() => { cleanup(); flags.desktop = true; flags.equipment = ["Rolo"]; });

describe("WF Equipamentos no desktop", () => {
  it("usa cartões leves no padrão da central, sem carregar fotos e respeitando os tipos autorizados", async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EquipmentHome /><Current /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "WF Equipamentos" })).toBeInTheDocument();
    const rolo = await screen.findByRole("button", { name: /Rolo Compactador/ });
    expect(screen.queryByRole("button", { name: /Fresadora/ })).toBeNull();
    expect(document.querySelectorAll('img[src*="equip-"]')).toHaveLength(0);
    fireEvent.click(rolo);
    expect(screen.getByRole("status")).toHaveTextContent("/equipamentos/diario?tipo=Rolo");
  });
  it("mantém o catálogo ilustrado no mobile", async () => {
    flags.desktop = false;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EquipmentHome /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Rolo Compactador/ })).toBeInTheDocument();
    expect(document.querySelectorAll('img[src*="equip-"]')).not.toHaveLength(0);
  });
});

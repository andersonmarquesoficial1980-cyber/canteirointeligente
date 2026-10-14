import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HUB_MODULES } from "@/config/navigation";

vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => true }));
vi.mock("@/hooks/useHubAccess", () => ({ useHubAccess: () => ({
  modules: HUB_MODULES.filter(m => ["obras", "relatorios"].includes(m.id)),
  loading: false, isSuperAdmin: false, companyLogo: null, semPerfil: false,
}) }));
import { DesktopRouteFrame } from "./DesktopRouteFrame";
afterEach(cleanup);

describe("desktop module transition", () => {
  it("keeps one sidebar while switching from Obras to Relatórios", () => {
    render(<MemoryRouter initialEntries={["/obras"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DesktopRouteFrame><Routes>
        <Route path="/obras" element={<h1>Obras</h1>} />
        <Route path="/relatorios" element={<h1>Relatórios</h1>} />
      </Routes></DesktopRouteFrame>
    </MemoryRouter>);
    const sidebar = screen.getByRole("complementary", { name: "Navegação do Workflux" });
    fireEvent.click(screen.getByRole("link", { name: "WF Relatórios" }));
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Navegação do Workflux" })).toBe(sidebar);
  });
  it("does not add a sidebar on QR and presentation pages", () => {
    for (const path of ["/carreteiros/qrcodes", "/relatorios/dashboards-obras/obras"]) {
      const view = render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DesktopRouteFrame><p>Conteúdo independente</p></DesktopRouteFrame>
      </MemoryRouter>);
      expect(screen.getByText("Conteúdo independente")).toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Navegação do Workflux" })).toBeNull();
      view.unmount();
    }
  });
});

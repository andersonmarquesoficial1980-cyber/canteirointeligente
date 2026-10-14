import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: null } }) },
} }));
import MedicoesTerceiros from "./MedicoesTerceiros";
function mount() {
  return render(<MemoryRouter initialEntries={["/medicoes/terceiros"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MedicoesTerceiros /></MemoryRouter>);
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("Medições de Terceiros desktop", () => {
  it("usa cabeçalho/trilha desktop, preserva abas e dados do formulário entre elas", async () => {
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.getByRole("heading", { name: "WF Medições" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByTestId("medicoes-terceiros-content").className).toContain("max-w-[1680px]");
    fireEvent.change(screen.getByPlaceholderText("Ex: FA20, MOBILE01..."), { target: { value: "fa20" } });
    fireEvent.click(screen.getByRole("button", { name: "Histórico (0)" }));
    expect(screen.getByText("Nenhuma medição gerada ainda.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nova Medição" }));
    expect(screen.getByPlaceholderText("Ex: FA20, MOBILE01...")).toHaveValue("FA20");
  });
  it("não modifica cabeçalho compacto nem largura mobile", async () => {
    state.desktop = false;
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.getByRole("heading", { name: "Medições" })).toBeInTheDocument();
    expect(screen.getByText("Equipamentos Terceirizados")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
    expect(view.container.querySelector("main")).toBeNull();
    expect(screen.getByRole("button", { name: "Histórico (0)" })).toBeInTheDocument();
  });
});

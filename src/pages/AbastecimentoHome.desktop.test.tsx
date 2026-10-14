import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/useEquipamentoTipos", () => ({ useEquipamentoTipos: () => ({ categorias: [] }) }));
vi.mock("@/components/ProgramacoesDoDia", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
import AbastecimentoHome from "./AbastecimentoHome";
function mount() { return render(<MemoryRouter initialEntries={["/abastecimento"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AbastecimentoHome /></MemoryRouter>); }
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Abastecimento desktop", () => {
  it("usa a área larga com trilha e mantém duas ações operacionais distintas", async () => {
    let mounted!: ReturnType<typeof mount>;
    await act(async () => { mounted = mount(); });
    expect(screen.getByRole("heading", { name: "WF Abastecimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(mounted.container.querySelector('[data-testid="abastecimento-content"]')?.className).toContain("max-w-[1680px]");
    expect(screen.getByRole("button", { name: /Lançar Abastecimento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Controle de Carga/ })).toBeInTheDocument();
  });
  it("abre lançamento de combustível sem abrir controle de carga", async () => {
    await act(async () => { mount(); });
    fireEvent.click(screen.getByRole("button", { name: /Lançar Abastecimento/ }));
    expect(screen.getByRole("dialog", { name: "Lançar Abastecimento" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Controle de Carga/ })).toBeNull();
  });
  it("abre controle de carga sem abrir lançamento de combustível", async () => {
    await act(async () => { mount(); });
    fireEvent.click(screen.getByRole("button", { name: /Controle de Carga/ }));
    expect(screen.getByRole("dialog", { name: "Controle de Carga do Reservatório" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Lançar Abastecimento" })).toBeNull();
  });
  it("mantém largura e cabeçalho anteriores no mobile", async () => {
    state.desktop = false;
    let mounted!: ReturnType<typeof mount>;
    await act(async () => { mounted = mount(); });
    expect(mounted.container.querySelector(".max-w-4xl")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
  });
});

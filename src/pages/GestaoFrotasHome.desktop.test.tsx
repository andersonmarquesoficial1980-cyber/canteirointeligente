import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useEquipamentoTipos", () => ({ useEquipamentoTipos: () => ({ categorias: [], loading: false }) }));
vi.mock("@/components/ProgramacoesDoDia", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: null } }) },
  from: (table: string) => {
    const result = Promise.resolve({ data: table === "equipamentos" ? [
      { id: "f1", frota: "FA20", tipo: "FRESADORA", status: "ativo", setor: "Equipe A", condicao: "PROPRIO" },
      { id: "f2", frota: "CB01", tipo: "CAMINHÃO", status: "em_manutencao", setor: "Equipe B", condicao: "TERCEIRO" },
    ] : [], error: null });
    const q = { select: () => q, eq: () => q, not: () => q, order: () => q, limit: () => q, then: result.then.bind(result) };
    return q;
  },
} }));
import GestaoFrotasHome from "./GestaoFrotasHome";
function Location() { return <output aria-label="Rota">{useLocation().pathname}</output>; }
function mount() {
  return render(<MemoryRouter initialEntries={["/gestao-frotas"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GestaoFrotasHome /><Location /></MemoryRouter>);
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Gestão de Frotas desktop", () => {
  it("mostra a área de trabalho ampla sem esconder equipamentos fora de operação", async () => {
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.getByRole("heading", { name: "WF Gestão de Frotas" })).toBeInTheDocument();
    expect(screen.getByTestId("frotas-content").className).toContain("max-w-6xl");
    await waitFor(() => expect(screen.getByText("CB01")).toBeInTheDocument());
    expect(screen.getByTestId("frotas-cards").className).toContain("lg:grid-cols-2");
    expect(screen.getByText("FA20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dashboard por Equipe/ })).toBeInTheDocument();
  });
  it("preserva a busca ao alternar Frotas e Documentos", async () => {
    await act(async () => { mount(); });
    fireEvent.change(screen.getByPlaceholderText("Digite frota, placa, modelo ou nome"), { target: { value: "CB01" } });
    fireEvent.click(screen.getByRole("button", { name: /Documentos/ }));
    expect(screen.getByRole("button", { name: /Ver Todos os Documentos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Frotas" }));
    expect(screen.getByPlaceholderText("Digite frota, placa, modelo ou nome")).toHaveValue("CB01");
  });
  it("mantém cabeçalho compacto e largura original no mobile", async () => {
    state.desktop = false;
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.queryByRole("heading", { name: "WF Gestão de Frotas" })).toBeNull();
    expect(view.container.querySelector(".max-w-2xl")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Frotas" })).toBeInTheDocument();
  });
});

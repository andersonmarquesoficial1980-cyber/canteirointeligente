import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/components/ProgramacoesDoDia", () => ({ default: () => <p>Programações do dia</p> }));
vi.mock("@/components/IntegracaoObrasCard", () => ({ default: () => <p>Integrações por Obra</p> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "eng1" } } }) },
  from: (table: string) => {
    const data = table === "profiles" ? { company_id: "c1", nome_completo: "Ana Engenharia", perfil: "engenheiro", role: "engenheiro" }
      : table === "user_permissions" ? { is_admin: false }
      : table === "rdo_diarios" ? [
        { id: "rdo1", data: "2026-09-01", obra_nome: "Obra Autorizada", status_validacao: "enviado", engenheiro_responsavel_user_id: "eng1" },
        { id: "rdo2", data: "2026-09-02", obra_nome: "Obra de Outro Engenheiro", status_validacao: "enviado", engenheiro_responsavel_user_id: "outro" },
      ] : [];
    const result = Promise.resolve({ data, error: null });
    const q = { select: () => q, eq: () => q, in: () => q, is: () => q, gte: () => q, lte: () => q, range: () => q, order: () => q, limit: () => q, maybeSingle: () => result, then: result.then.bind(result) };
    return q;
  },
} }));
import EngHome from "./EngHome";
function Location() { const l = useLocation(); return <output aria-label="Rota">{l.pathname}{l.search}</output>; }
function mount() {
  return render(<MemoryRouter initialEntries={["/engenharia?origem=gestao-frotas"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><EngHome /><Location /></MemoryRouter>);
}
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Engenharia desktop", () => {
  it("mostra a área ampla com trilha sem vazar RDO de outro engenheiro", async () => {
    await act(async () => { mount(); });
    expect(screen.getByRole("heading", { name: "WF Engenharia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByTestId("engenharia-conteudo").className).toContain("max-w-6xl");
    expect(screen.getByTestId("engenharia-paineis").className).toContain("lg:grid-cols-2");
    await waitFor(() => expect(screen.getByText("Obra Autorizada")).toBeInTheDocument());
    expect(screen.queryByText("Obra de Outro Engenheiro")).toBeNull();
    expect(screen.getByText("Aguardando sua validação (1)")).toBeInTheDocument();
  });
  it("preserva origem nos caminhos de RDO técnico e validação", async () => {
    await act(async () => { mount(); });
    fireEvent.click(screen.getByRole("button", { name: /Novo RDO Técnico/ }));
    expect(screen.getByRole("status", { name: "Rota" })).toHaveTextContent("/engenharia/rdo-tecnico?origem=gestao-frotas");
  });
  it("preserva o cabeçalho compacto e a largura no mobile", async () => {
    state.desktop = false;
    let view!: ReturnType<typeof mount>;
    await act(async () => { view = mount(); });
    expect(screen.getByRole("heading", { name: "RDO Engenharia" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WF Engenharia" })).toBeNull();
    expect(view.container.querySelector(".max-w-lg")).not.toBeNull();
  });
});

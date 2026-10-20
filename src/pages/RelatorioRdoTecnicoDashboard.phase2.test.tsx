import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const state = vi.hoisted(() => ({ fail: false, queries: [] as { table: string; filters: [string, unknown][] }[] }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: "c1" } }) }));
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = { table, filters: [] as [string, unknown][] }; state.queries.push(query);
    let start = 0, end = 499;
    const predicates: ((row: Record<string, unknown>) => boolean)[] = [];
    const pending = (id: string, date: string, engineer: string | null, obra = "OGS 2539") => ({ id, company_id: "c1", data: date, obra_nome: obra,
      status_validacao: "enviado", validado_por: null, engenheiro_responsavel_user_id: engineer, engenheiro_responsavel: engineer || "Ana",
      validado_encarregado: true, encarregado_employee_id: "enc1", nao_aprovado_encarregado: false });
    const source = table === "rdo_diarios" ? [pending("p1", "2026-10-01", "ana"), pending("old", "2026-09-01", "ana"), pending("inactive", "2026-10-02", "bia", "OGS 2553"), pending("noid", "2026-10-03", null), { ...pending("done", "2026-10-01", "ana"), validado_por: "ana" }]
      : table === "profiles" ? [{ user_id: "ana", nome_completo: "Ana", email: null, status: "ativo", company_id: "c1" }, { user_id: "bia", nome_completo: "Bia histórica", email: null, status: "inativo", company_id: "c1" }]
      : table === "rdo_engenheiro" ? [{ id: "t1", company_id: "c1", engenheiro_id: "ana", status: "enviado", data: "2026-10-01", ogs_number: "2539", houve_producao: true }, { id: "t2", company_id: "c1", engenheiro_id: "ana", status: "rascunho", data: "2026-10-02", ogs_number: "2539", houve_producao: true }] : [];
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { query.filters.push([key, value]); predicates.push(r => r[key] === value); return q; },
      in: (key: string, values: unknown[]) => { predicates.push(r => values.includes(r[key])); return q; },
      is: (key: string, value: unknown) => { predicates.push(r => r[key] === value); return q; },
      gte: (key: string, value: string) => { predicates.push(r => String(r[key]) >= value); return q; },
      lte: (key: string, value: string) => { predicates.push(r => String(r[key]) <= value); return q; },
      order: () => q,
      range: (a: number, b: number) => { start = a; end = b; return q; },
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: source.filter(r => predicates.every(p => p(r))).slice(start, end + 1), error: state.fail && table === "rdo_diarios" ? { message: "Falha de rede" } : null }).then(resolve),
    }; return q;
  },
} }));
import Dashboard from "./RelatorioRdoTecnicoDashboard";
const section = (name: string) => screen.getByRole("heading", { name }).closest("section")!;
async function mount() { await act(async () => { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>); }); }
beforeEach(() => { state.fail = false; state.queries = []; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T15:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); vi.restoreAllMocks(); });
describe("Dashboard Técnico — fase 2", () => {
  it("concilia total, responsáveis inclusive inativos e pendências sem ID sem atribuir pelo nome", async () => {
    await mount();
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total · 3 vinculados · 1 sem identificação por ID");
    const fila = section("2. Validações pendentes dos RDOs dos apontadores");
    expect(within(fila).getAllByText("Bia histórica").length).toBeGreaterThan(0);
    expect(screen.getByText(/Conferência de vínculos pendentes/)).toBeInTheDocument();
    expect(state.queries.filter(q => q.table !== "ci_equipes").every(q => q.filters.some(([key, value]) => key === "company_id" && value === "c1"))).toBe(true);
  });
  it("troca explicitamente de acumulado para período sem contar setembro", async () => {
    await mount();
    await act(async () => { fireEvent.change(screen.getByLabelText("Recorte da fila"), { target: { value: "periodo" } }); });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("3 pendentes no total · 2 vinculados · 1 sem identificação por ID");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("01/10/2026 até 20/10/2026");
  });
  it("filtros técnicos não contaminam a fila e Status altera também o preenchimento por autor", async () => {
    await mount();
    fireEvent.change(screen.getByPlaceholderText("OGS, equipe/setor, tipo, motivo..."), { target: { value: "inexistente" } });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total");
    fireEvent.change(screen.getByPlaceholderText("OGS, equipe/setor, tipo, motivo..."), { target: { value: "" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "rascunho" } });
    const technical = section("1. Preenchimento de RDO Técnico pelos engenheiros");
    expect(within(technical).getByText(/0 enviados · 1 rascunhos/)).toBeInTheDocument();
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total");
  });
  it("aplica os filtros próprios de obra, responsável, busca e sem identificação", async () => {
    await mount();
    fireEvent.change(screen.getByLabelText("Obra da fila"), { target: { value: "OGS 2553" } });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("1 pendentes no total · 1 vinculados");
    fireEvent.change(screen.getByLabelText("Obra da fila"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Responsável pela validação"), { target: { value: "__sem_identificacao" } });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("1 pendentes no total · 0 vinculados · 1 sem identificação");
    fireEvent.change(screen.getByLabelText("Busca na fila"), { target: { value: "inexistente" } });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("0 pendentes no total");
  });
  it("consulta técnica anterior ao marco mantém painel válido e fila vazia", async () => {
    await mount();
    await act(async () => { fireEvent.change(screen.getByDisplayValue("2026-10-01"), { target: { value: "2026-06-01" } }); });
    await act(async () => { fireEvent.change(screen.getByDisplayValue("2026-10-20"), { target: { value: "2026-06-30" } }); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("0 pendentes no total");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("Não há fila de validação antes do marco de 17/07/2026");
  });
  it("erro de consulta oculta indicadores e não anuncia fila zerada", async () => {
    state.fail = true; vi.spyOn(console, "error").mockImplementation(() => {});
    await mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Nenhum total parcial foi exibido");
    expect(screen.queryByTestId("total-fila-validacao")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resumo Exec/ })).toBeDisabled();
  });
});

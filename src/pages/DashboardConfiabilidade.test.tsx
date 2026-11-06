import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ ind: [] as any[], prod: [] as any[], erroInd: "" , erroProd: "", buscar: vi.fn(), listar: vi.fn() }));

vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { user_id: "u1", company_id: "c1" }, loading: false }) }));
vi.mock("@/assets/logo-workflux.png", () => ({ default: "logo.png" }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>, ComposedChart: ({ data }: any) => <div data-testid="chart">{JSON.stringify(data)}</div>,
  Bar: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => { const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q,
    then: (cb: any) => Promise.resolve({ data: t === "ogs_reference" ? [{ ogs_number: "1001" }, { ogs_number: "2002" }] : [{ id: "e1", frota: "FA01" }, { id: "e2", frota: "VB01" }] }).then(cb) }; return q; } },
}));
vi.mock("@/lib/equipConfiabilidade", async () => {
  const real = await vi.importActual<typeof import("@/lib/equipConfiabilidade")>("@/lib/equipConfiabilidade");
  return { ...real, buscarIndicadores: (...a: any[]) => { h.buscar(...a); return h.erroInd ? Promise.reject(new Error(h.erroInd)) : Promise.resolve(h.ind.map(real.normalizarLinha)); } };
});
vi.mock("@/lib/equipProducao", async () => {
  const real = await vi.importActual<typeof import("@/lib/equipProducao")>("@/lib/equipProducao");
  return { ...real, listarProducao: (...a: any[]) => { h.listar(...a); return h.erroProd ? Promise.reject(new Error(h.erroProd)) : Promise.resolve(h.prod); } };
});

import DashboardConfiabilidade from "./DashboardConfiabilidade";

const lin = (o: any = {}) => ({
  equipamento_id: "e1", frota: "FA01", ogs_number: "1001", dias_programados: 1, tempo_programado_h: 6, tempo_parado_h: 0, disponibilidade_pct: 100,
  qtd_falhas: 0, tempo_operacao_h: 6, mtbf_h: null, qtd_reparadas: 0, tempo_reparo_h: 0, mttr_h: null, falhas_em_aberto: 0, falhas_sem_reparo: 0,
  dias_sem_horario: 0, dias_sem_operacao: 0, dias_excluidos_rdo: 0, ...o,
});
const pv = (o: any = {}) => ({ equipamento_id: "e2", frota: "VB01", ogs_number: "1001", data: "2026-10-05", turno: "noturno", tipo: "vibroacabadora", valor: 200, unidade: "t", fonte: "apontamento", lancado: true, apontamento_id: "a", ...o });
const renderPage = (url = "/relatorios/dashboards-obras/confiabilidade") => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardConfiabilidade /></MemoryRouter>);

beforeEach(() => { h.ind = []; h.prod = []; h.erroInd = ""; h.erroProd = ""; h.buscar.mockClear(); h.listar.mockClear(); });
afterEach(cleanup);

describe("Dashboards Obras — Disponibilidade e Confiabilidade", () => {
  it("exemplo da solicitação: 22h–04h com 2h de quebra → 66,67%, MTBF 4 h, MTTR 1,5 h", async () => {
    h.ind = [lin({ tempo_parado_h: 2, tempo_operacao_h: 4, disponibilidade_pct: 66.67, qtd_falhas: 1, mtbf_h: 4, qtd_reparadas: 1, tempo_reparo_h: 1.5, mttr_h: 1.5 })];
    renderPage();
    expect((await screen.findAllByText("66,67%")).length).toBeGreaterThanOrEqual(2); // KPI + linha
    expect(screen.getAllByText("4,00 h").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,50 h").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2,00 h").length).toBeGreaterThanOrEqual(2); // parado no KPI e na linha
  });

  it("sem falhas: MTBF e MTTR mostram 'Sem dados', nunca zero ou NaN", async () => {
    h.ind = [lin()];
    renderPage();
    await screen.findByText("FA01", { selector: "td" });
    expect(screen.getAllByText("100,00%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sem dados").length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("sem horário cadastrado: disponibilidade 'Sem horário' e aviso de dias fora do cálculo", async () => {
    h.ind = [lin({ tempo_programado_h: 0, tempo_operacao_h: 0, disponibilidade_pct: null, dias_programados: 0, dias_sem_horario: 4 })];
    renderPage();
    await screen.findByText("FA01", { selector: "td" });
    expect(screen.getAllByText("Sem horário").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/4 dia\(s\) de equipamento sem horário programado/)).toBeInTheDocument();
    expect(screen.getByText(/Cadastre os horários programados/)).toBeInTheDocument();
  });

  it("mostra só os 5 indicadores do cabeçalho e o gráfico Produção × Disponibilidade", async () => {
    h.ind = [lin({ equipamento_id: "e2", frota: "VB01" })]; h.prod = [pv()];
    renderPage();
    await screen.findByText("VB01", { selector: "td" });
    for (const t of ["Disponibilidade operacional", "MTBF", "MTTR", "Quantidade de falhas", "Tempo parado por falhas", "Produção × Disponibilidade"]) {
      expect(screen.getAllByText(t).length).toBeGreaterThanOrEqual(1);
    }
    const dados = JSON.parse((await screen.findByTestId("grafico-producao")).textContent || "[]");
    expect(dados[0]).toMatchObject({ frota: "VB01", producao: 200, disponibilidade: 100, unidade: "t" });
  });

  it("alterna para fresadora (m) e avisa produção parcial quando há dia sem lançamento", async () => {
    h.ind = [lin({ equipamento_id: "e1", frota: "FA01" })];
    h.prod = [pv({ equipamento_id: "e1", frota: "FA01", tipo: "fresadora", unidade: "m", fonte: "diario", valor: 150 }),
              pv({ equipamento_id: "e1", frota: "FA01", tipo: "fresadora", unidade: "m", fonte: "diario", valor: null, lancado: false, data: "2026-10-06" })];
    renderPage("/relatorios/dashboards-obras/confiabilidade?tipo=fresadora");
    const dados = JSON.parse((await screen.findByTestId("grafico-producao")).textContent || "[]");
    expect(dados[0]).toMatchObject({ frota: "FA01", producao: 150, unidade: "m", diasPendentes: 1 });
    expect(screen.getByText(/1 dia\(s\) sem produção lançada: o total mostrado é parcial/)).toBeInTheDocument();
  });

  it("filtros por obra e equipamento chegam ao cálculo", async () => {
    h.ind = [lin()];
    renderPage();
    await screen.findByText("FA01", { selector: "td" });
    await waitFor(() => expect((screen.getByLabelText("Obra") as HTMLSelectElement).querySelectorAll("option").length).toBeGreaterThan(1));
    fireEvent.change(screen.getByLabelText("Obra"), { target: { value: "2002" } });
    await waitFor(() => expect(h.buscar).toHaveBeenLastCalledWith(expect.objectContaining({ companyId: "c1", ogs: "2002" })));
    fireEvent.change(screen.getByLabelText("Equipamento"), { target: { value: "e1" } });
    await waitFor(() => expect(h.listar).toHaveBeenLastCalledWith(expect.objectContaining({ ogs: "2002", equipamentoId: "e1" })));
  });

  it("período invertido não consulta e avisa", async () => {
    renderPage("/relatorios/dashboards-obras/confiabilidade?de=2026-10-10&ate=2026-10-01");
    expect(await screen.findByRole("alert")).toHaveTextContent(/data final/i);
    expect(h.buscar).not.toHaveBeenCalled();
  });

  it("erro no cálculo é mostrado sem derrubar a tela; erro de produção não apaga os indicadores", async () => {
    h.erroInd = "Sem acesso a esta empresa";
    renderPage();
    expect(await screen.findByText("Sem acesso a esta empresa")).toBeInTheDocument();
    cleanup(); h.erroInd = ""; h.erroProd = "falha na produção"; h.ind = [lin()];
    renderPage();
    await screen.findByText("FA01", { selector: "td" });
    expect(await screen.findByText("falha na produção")).toBeInTheDocument();
  });

  it("falha em aberto e falha sem reparo são sinalizadas", async () => {
    h.ind = [lin({ qtd_falhas: 2, falhas_em_aberto: 1, falhas_sem_reparo: 1, tempo_parado_h: 3, tempo_operacao_h: 3, disponibilidade_pct: 50, mtbf_h: 1.5 })];
    renderPage();
    await screen.findByText("FA01", { selector: "td" });
    expect(screen.getByText(/1 falha\(s\) em aberto/)).toBeInTheDocument();
    expect(screen.getByText(/1 falha\(s\) sem tempo de reparo/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByTitle("Falha em aberto")).toBeInTheDocument();
  });

  it("estado vazio explícito", async () => {
    renderPage();
    expect(await screen.findByText(/Nenhum equipamento com diário de trabalho/)).toBeInTheDocument();
  });
});

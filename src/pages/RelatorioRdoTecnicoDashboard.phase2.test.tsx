import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TECHNICAL_QUANTITIES } from "@/lib/technicalProduction";
const state = vi.hoisted(() => ({ companyId: "c1", extraProfiles: [] as Record<string, unknown>[], extraPending: [] as Record<string, unknown>[], fail: false, technical: null as Record<string, unknown>[] | null, queries: [] as { table: string; select?: string; filters: [string, unknown][] }[] }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: state.companyId } }) }));
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query: (typeof state.queries)[number] = { table, filters: [] }; state.queries.push(query);
    let start = 0, end = 499;
    const predicates: ((row: Record<string, unknown>) => boolean)[] = [];
    const pending = (id: string, date: string, engineer: string | null, obra = "OGS 2539") => ({ id, company_id: "c1", data: date, obra_nome: obra,
      status_validacao: "enviado", validado_por: null, engenheiro_responsavel_user_id: engineer, engenheiro_responsavel: engineer || "Ana",
      validado_encarregado: true, encarregado_employee_id: "enc1", nao_aprovado_encarregado: false });
    const baseSource = table === "rdo_diarios" ? [pending("p1", "2026-10-01", "ana"), pending("old", "2026-09-01", "ana"), pending("inactive", "2026-10-02", "bia", "OGS 2553"), pending("noid", "2026-10-03", null), { ...pending("done", "2026-10-01", "ana"), validado_por: "ana" }]
      : table === "profiles" ? [{ user_id: "ana", nome_completo: "Ana", email: null, status: "ativo", company_id: "c1" }, { user_id: "bia", nome_completo: "Bia histórica", email: null, status: "inativo", company_id: "c1" }]
      : table === "rdo_engenheiro" ? (state.technical || [{ id: "t1", company_id: "c1", engenheiro_id: "ana", status: "enviado", data: "2026-10-01", ogs_number: "2539", houve_producao: true }, { id: "t2", company_id: "c1", engenheiro_id: "ana", status: "rascunho", data: "2026-10-02", ogs_number: "2539", houve_producao: true }]) : [];
    const source = [...baseSource, ...(table === "profiles" ? state.extraProfiles : table === "rdo_diarios" ? state.extraPending : [])].map(row => ({ ...row, company_id: row.company_id === "c1" ? state.companyId : row.company_id }));
    const q = {
      select: (columns?: string) => { query.select = columns; return q; },
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
const section = (name: string | RegExp) => screen.getByRole("heading", { name }).closest("section")!;
const nav = () => screen.getByRole("navigation", { name: "Seções do Dashboard" });
const irPara = (nome: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp(`^${nome}`) }));
const abrirMaisFiltros = () => fireEvent.click(screen.getByRole("button", { name: /Mais filtros/ }));
const busca = (valor: string) => fireEvent.change(screen.getByLabelText("Busca rápida"), { target: { value: valor } });
async function mount() { await act(async () => { render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>); }); }
beforeEach(() => { state.companyId = "c1"; state.extraProfiles = []; state.extraPending = []; state.fail = false; state.technical = null; state.queries = []; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T15:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Dashboard Técnico — fase 2", () => {
  it("retira Igor somente do acompanhamento, preservando RDO, tonelagem, autoria e pendência vinculada", async () => {
    state.companyId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const igor = "27c76763-85b9-4f95-82bc-ef20cc3cd471";
    state.extraProfiles = [{ user_id: igor, nome_completo: "Igor Capucho", email: null, status: "ativo", company_id: state.companyId }];
    state.technical = [{ id: "historico-igor", company_id: state.companyId, engenheiro_id: igor, status: "enviado", data: "2026-10-01", ogs_number: "2539", houve_producao: true, binder_ton: 12.5 }];
    state.extraPending = [{ id: "pendente-igor", company_id: state.companyId, data: "2026-10-02", obra_nome: "OGS 2539", engenheiro_responsavel_user_id: igor, status_validacao: "enviado", validado_por: null, validado_encarregado: true, encarregado_employee_id: "enc1", nao_aprovado_encarregado: false }];
    await mount();
    irPara("Preenchimento");
    const acompanhamento = section("Preenchimento de RDO Técnico pelos engenheiros");
    expect(within(acompanhamento).queryByText("Igor Capucho")).not.toBeInTheDocument();
    irPara("Validações");
    const fila = section("Validações pendentes dos RDOs dos apontadores");
    expect(within(within(fila).getByRole("table")).getByText("Igor Capucho")).toBeInTheDocument();
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("5 pendentes no total · 4 vinculados · 1 sem identificação por ID");
    irPara("Visão geral");
    const comparison = section("Comparativo com período anterior");
    expect(within(comparison).getByText("Produção (t)").parentElement).toHaveTextContent("12,5");
    busca("Igor Capucho");
    expect(within(comparison).getByText("Produção (t)").parentElement).toHaveTextContent("12,5");
  });
  it("inclui Adenilton, Leticia e Tiago mesmo sem RDO ou designação no período", async () => {
    state.companyId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const pessoas = [
      ["54900f26-da3b-4b0d-ac90-b2f4721de54a", "Adenilton Sousa"],
      ["83e64f4c-5207-477b-926e-a2441f874243", "Leticia Reis"],
      ["217afba8-3280-44fe-a218-f9d16a60bb42", "Tiago Rodrigues"],
    ];
    state.extraProfiles = pessoas.map(([user_id, nome_completo]) => ({ user_id, nome_completo, status: "ativo", email: null, company_id: state.companyId }));
    await mount();
    irPara("Preenchimento");
    const acompanhamento = section("Preenchimento de RDO Técnico pelos engenheiros");
    for (const [, nome] of pessoas) {
      const row = within(acompanhamento).getByText(nome).closest("tr")!;
      expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual([expect.stringContaining(nome), "0", "0", "—"]);
    }
    irPara("Validações");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total · 3 vinculados · 1 sem identificação por ID");
  });
  it("concilia total, responsáveis inclusive inativos e pendências sem ID sem atribuir pelo nome", async () => {
    await mount();
    irPara("Validações");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total · 3 vinculados · 1 sem identificação por ID");
    const fila = section("Validações pendentes dos RDOs dos apontadores");
    expect(within(fila).getAllByText("Bia histórica").length).toBeGreaterThan(0);
    expect(screen.getByText(/Conferência de vínculos pendentes/)).toBeInTheDocument();
    expect(state.queries.filter(q => q.table !== "ci_equipes").every(q => q.filters.some(([key, value]) => key === "company_id" && value === "c1"))).toBe(true);
  });
  it("troca explicitamente de acumulado para período sem contar setembro", async () => {
    await mount();
    irPara("Validações");
    await act(async () => { fireEvent.change(screen.getByLabelText("Recorte da fila"), { target: { value: "periodo" } }); });
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("3 pendentes no total · 2 vinculados · 1 sem identificação por ID");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("01/10/2026 até 20/10/2026");
  });
  it("filtros técnicos não contaminam a fila e Status altera também o preenchimento por autor", async () => {
    await mount();
    irPara("Validações");
    busca("inexistente");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total");
    busca("");
    abrirMaisFiltros();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "rascunho" } });
    irPara("Preenchimento");
    const technical = section("Preenchimento de RDO Técnico pelos engenheiros");
    expect(within(technical).getByText(/0 enviados · 1 rascunhos/)).toBeInTheDocument();
    irPara("Validações");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total");
  });
  it("aplica os filtros próprios de obra, responsável, busca e sem identificação", async () => {
    await mount();
    irPara("Validações");
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
    irPara("Validações");
    await act(async () => { fireEvent.change(screen.getByDisplayValue("2026-10-01"), { target: { value: "2026-06-01" } }); });
    await act(async () => { fireEvent.change(screen.getByDisplayValue("2026-10-20"), { target: { value: "2026-06-30" } }); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("0 pendentes no total");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("Não há fila de validação antes do marco de 17/07/2026");
  });
  it("erro de consulta oculta indicadores e não anuncia fila zerada, mantendo todas as seções sem contagem falsa", async () => {
    state.fail = true; vi.spyOn(console, "error").mockImplementation(() => {});
    await mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Nenhum total parcial foi exibido");
    expect(screen.queryByTestId("total-fila-validacao")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resumo Exec/ })).toBeDisabled();
    const botoes = within(nav()).getAllByRole("button");
    expect(botoes).toHaveLength(10);
    botoes.forEach(b => { expect(b).toHaveTextContent("—"); expect(b.textContent).not.toMatch(/\b0\b/); });
  });
});


describe("Dashboard Técnico — clareza dos KPIs do topo", () => {
  const base = { company_id: "c1", engenheiro_id: "ana", ogs_number: "2539", houve_producao: true, data: "2026-10-01" };
  const kpi = (nome: string) => within(screen.getByTestId("faixa-kpis")).getByText(nome).closest("div.min-w-0")! as HTMLElement;
  it("rotula Total de RDOs com enviados · rascunhos e Problemas em equipamentos contando RDOs com false", async () => {
    state.technical = [
      { ...base, id: "a", status: "enviado", equipamentos_conforme: false },
      { ...base, id: "b", status: "enviado", equipamentos_conforme: true },
      { ...base, id: "c", status: "rascunho", equipamentos_conforme: null },
    ];
    await mount();
    const total = kpi("Total de RDOs");
    expect(total).toHaveTextContent("3");
    const enviados = within(total).getByText("2 enviados");
    const rascunhos = within(total).getByText("1 rascunhos");
    expect(enviados).not.toBe(rascunhos);
    for (const el of [enviados, rascunhos]) {
      expect(el.className).toContain("block");
      const p = el.closest("p")!;
      expect(p.className).not.toMatch(/truncate|line-clamp|overflow-hidden/);
      expect(p.className).toContain("whitespace-normal");
      expect(p.className).toContain("text-xs");
      expect(p.className).not.toMatch(/text-\[\d+px\]/);
    }
    const prob = kpi("Problemas em equipamentos");
    expect(prob).toHaveTextContent("Contagem de RDOs");
    expect(prob).not.toHaveTextContent("problema informado");
    expect(prob.querySelector("p")).toHaveTextContent("1");
    expect(within(screen.getByTestId("faixa-kpis")).queryByText("Não conformes")).not.toBeInTheDocument();
  });
  it("usa os seis títulos claros na faixa de KPIs", async () => {
    await mount();
    const faixa = within(screen.getByTestId("faixa-kpis"));
    for (const t of ["Total de RDOs", "RDOs com produção", "RDOs sem produção", "Problemas em equipamentos", "Produção em toneladas", "Área produzida (m²)"]) {
      expect(faixa.getByText(t)).toBeInTheDocument();
    }
    for (const antigo of ["RDOs (inclui rascunhos)", "Com produção", "Sem produção", "Não conformes", "Produção (t)", "Produção (m²)"]) {
      expect(faixa.queryByText(antigo)).not.toBeInTheDocument();
    }
  });
  it("mostra zeros explícitos no detalhamento", async () => {
    state.technical = [];
    await mount();
    const total = within(kpi("Total de RDOs"));
    expect(total.getByText("0 enviados")).toBeInTheDocument();
    expect(total.getByText("0 rascunhos")).toBeInTheDocument();
  });
  it("em erro ou carregamento mostra — sem contagem antiga ou zero", async () => {
    state.fail = true; vi.spyOn(console, "error").mockImplementation(() => {});
    await mount();
    for (const nome of ["Total de RDOs", "Problemas em equipamentos"]) {
      const c = kpi(nome);
      expect(c).toHaveTextContent("—");
      expect(c.textContent).not.toMatch(/\d/);
    }
  });
  it("em carregamento inicial mostra — sem contagem", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>);
    const c = kpi("Total de RDOs");
    expect(c).toHaveTextContent("—");
    expect(c.textContent).not.toMatch(/\d/);
  });
});

describe("Dashboard Técnico — comparativos da fase 3", () => {
  it("mantém a diferença absoluta e informa sem base percentual quando o anterior é zero", async () => {
    await mount();
    const comparison = section("Comparativo com período anterior");
    expect(within(comparison).getAllByText(/Sem base percentual/).length).toBeGreaterThan(0);
    expect(within(comparison).queryByText(/\(\+100%\)/)).not.toBeInTheDocument();
    expect(within(comparison).getAllByText(/\+2.*Sem base percentual/).length).toBeGreaterThan(0);
  });
});


describe("exportação executiva — fase 3", () => {
  it("exporta Sem base percentual em vez de percentual inventado ou célula vazia", async () => {
    const downloads: NodeBlob[] = [];
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL(blob: NodeBlob) { downloads.push(blob); return "blob:teste"; }
      static revokeObjectURL() {}
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Resumo Exec/ }));
    expect(downloads).toHaveLength(1);
    const csv = await downloads[0].text();
    expect(csv).toContain('"RDOs registrados (inclui rascunhos)";"2";"0";"2";"Sem base percentual"');
  });
});


describe("classificação operacional — fase 3", () => {
  const stopped = { company_id: "c1", engenheiro_id: "ana", status: "enviado", data: "2026-10-01", houve_producao: false,
    motivo_sem_producao: "Folga / Feriado", equipamentos_conforme: null, usina_atendeu: null, houve_ocorrencia: false };
  it("não trata folga como crítica, mas preserva ocorrências independentes no mesmo RDO", async () => {
    state.technical = [
      { ...stopped, id: "folga", ogs_number: "2539" },
      { ...stopped, id: "chuva", ogs_number: "2553", motivo_sem_producao: "Chuva", choveu: true },
      { ...stopped, id: "folga-ocorrencia", ogs_number: "2500", houve_ocorrencia: true, descricao_ocorrencia: "Ocorrência na folga" },
    ];
    await mount();
    expect(screen.getByTestId("resumo-sem-producao")).toHaveTextContent("2 folga/feriado");
    expect(screen.getByTestId("resumo-sem-producao")).toHaveTextContent("1 outros motivos");
    irPara("Alertas");
    const alerts = section(/Pendências prioritárias para validação|Alertas operacionais dos RDOs Técnicos/);
    expect(within(alerts).queryByText("2539")).not.toBeInTheDocument();
    expect(within(alerts).getByText("2553")).toBeInTheDocument();
    expect(within(alerts).getByText("Ocorrência na folga")).toBeInTheDocument();
  });
});


it("não transforma um rascunho em alerta operacional confirmado", async () => {
  state.technical = [{ id: "draft", company_id: "c1", engenheiro_id: "ana", status: "rascunho", data: "2026-10-01", ogs_number: "RASCUNHO-2539", houve_producao: false, motivo_sem_producao: "Chuva", choveu: true }];
  await mount();
  irPara("Alertas");
  const alerts = section("Alertas operacionais dos RDOs Técnicos");
  expect(within(alerts).queryByText("RASCUNHO-2539")).not.toBeInTheDocument();
  expect(within(alerts).getByText("Nenhum alerta operacional encontrado nos filtros atuais.")).toBeInTheDocument();
});


function captureDownloads() {
  const downloads: NodeBlob[] = [];
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(blob: NodeBlob) { downloads.push(blob); return "blob:teste"; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return downloads;
}

it("conta todos os alertas, pagina de 20 em 20, alcança o último alerta e exporta a lista completa", async () => {
  state.technical = Array.from({ length: 23 }, (_, i) => ({ id: `alerta-${i}`, company_id: "c1", engenheiro_id: "ana", status: "enviado", data: "2026-10-01", ogs_number: `ALERTA-${i}`, houve_producao: false, motivo_sem_producao: "Outro", outro_motivo_sem_producao: `Paralisação ${i}`, equipamentos_conforme: null, usina_atendeu: null }));
  const downloads = captureDownloads();
  await mount();
  expect(within(nav()).getByRole("button", { name: /^Alertas/ })).toHaveTextContent("23");
  irPara("Alertas");
  const alerts = section("Alertas operacionais dos RDOs Técnicos");
  expect(within(alerts).getByTestId("paginacao-intervalo")).toHaveTextContent("1–20 de 23 alertas");
  expect(within(alerts).getByTestId("paginacao-status")).toHaveTextContent("Página 1 de 2");
  expect(within(alerts).getAllByRole("row")).toHaveLength(21);
  expect(within(alerts).queryByText("ALERTA-22")).not.toBeInTheDocument();
  expect(within(alerts).queryByRole("button", { name: "Ver todos os alertas" })).not.toBeInTheDocument();
  expect(within(alerts).getByRole("button", { name: "Página anterior" })).toBeDisabled();
  fireEvent.click(within(alerts).getByRole("button", { name: "Próxima página" }));
  expect(within(alerts).getByTestId("paginacao-intervalo")).toHaveTextContent("21–23 de 23 alertas");
  expect(within(alerts).getByTestId("paginacao-status")).toHaveTextContent("Página 2 de 2");
  expect(within(alerts).getAllByRole("row")).toHaveLength(4);
  expect(within(alerts).getByText("ALERTA-22")).toBeInTheDocument();
  expect(within(alerts).getByRole("button", { name: "Próxima página" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Resumo Exec/ }));
  const csv = await downloads[0].text();
  expect(csv).toContain('"ALERTA-22"');
  expect(csv).toContain('"Alertas operacionais"');
  expect(csv).not.toContain('"Pendências prioritárias"');
});


it.each([
  [2, 1, "+1 (+100%)"],
  [1, 2, "-1 (-50%)"],
  [0, 2, "-2 (-100%)"],
])("preserva comparativo real com atual=%s e anterior=%s", async (current, previous, expected) => {
  const base = { company_id: "c1", engenheiro_id: "ana", status: "enviado", ogs_number: "2539", houve_producao: true, equipamentos_conforme: null };
  state.technical = [
    ...Array.from({ length: current }, (_, i) => ({ ...base, id: `atual-${i}`, data: "2026-10-01" })),
    ...Array.from({ length: previous }, (_, i) => ({ ...base, id: `anterior-${i}`, data: "2026-09-20" })),
  ];
  await mount();
  const comparison = section("Comparativo com período anterior");
  const card = within(comparison).getByText("Total de RDOs").parentElement!;
  expect(card).toHaveTextContent(expected);
});


const prod = { company_id: "c1", engenheiro_id: "ana", status: "enviado", data: "2026-10-01", ogs_number: "2539", houve_producao: true };
async function openProducao() { await mount(); irPara("Produção"); }

describe("Dashboard Técnico — descrição de INFRA", () => {
  it("consulta infra_descricao nos períodos atual e anterior", async () => {
    await mount();
    const selects = state.queries.filter(q => q.table === "rdo_engenheiro").map(q => q.select || "");
    expect(selects).toHaveLength(2);
    selects.forEach(sel => expect(sel).toContain("infra_descricao"));
  });
  it("mostra prévia de INFRA na linha e a descrição exata no diálogo, inclusive em serviço misto, e avisa quando ausente", async () => {
    state.technical = [
      { ...prod, id: "i1", tipo_servico: "INFRA", infra_descricao: "  Drenagem\n  profunda  ", perc_conclusao_via: 40 },
      { ...prod, id: "i2", tipo_servico: "FRESAGEM, INFRA", infra_descricao: "Meio-fio", fresagem_m2: 100, perc_conclusao_via: 10 },
      { ...prod, id: "i3", tipo_servico: "INFRA", infra_descricao: "   " },
      { ...prod, id: "i4", tipo_servico: "ENSAIOS E EXTRAÇÕES", infra_descricao: "Não exibir" },
      { ...prod, id: "i5", tipo_servico: "INFRAESTRUTURA", infra_descricao: "Substring" },
    ];
    await openProducao();
    const previa = screen.getByTestId("infra-previa-i1");
    expect(previa.textContent).toBe("  Drenagem\n  profunda  ");
    expect(previa).toHaveClass("whitespace-pre-wrap");
    expect(previa).toHaveClass("line-clamp-2");
    expect(previa.closest("tr")).toHaveTextContent("INFRA • Conclusão: 40%");
    expect(screen.getByTestId("infra-previa-i2").closest("tr")).toHaveTextContent("FRESAGEM, INFRA • Conclusão: 10%");
    expect(screen.getByTestId("infra-previa-i2")).toHaveTextContent("Meio-fio");
    expect(screen.getByTestId("infra-previa-i3")).toHaveTextContent("Descrição de INFRA não informada");
    expect(screen.getAllByText("Descrição de INFRA não informada")).toHaveLength(1);
    expect(screen.queryByTestId("infra-previa-i4")).not.toBeInTheDocument();
    expect(screen.queryByTestId("infra-previa-i5")).not.toBeInTheDocument();
    expect(screen.queryByText("Não exibir")).not.toBeInTheDocument();
    expect(screen.queryByText("Substring")).not.toBeInTheDocument();
    fireEvent.click(within(previa.closest("tr")!).getByRole("button", { name: /Ver detalhes/ }));
    const dialogo = screen.getByRole("dialog");
    const completo = within(dialogo).getByTestId("infra-descricao-i1");
    expect(completo.textContent).toBe("  Drenagem\n  profunda  ");
    expect(completo).toHaveClass("whitespace-pre-wrap");
    expect(within(dialogo).getByText("i1")).toBeInTheDocument();
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("infra-previa-i3").closest("tr")!).getByRole("button", { name: /Ver detalhes/ }));
    expect(within(screen.getByRole("dialog")).getByTestId("infra-descricao-i3")).toHaveTextContent("Descrição de INFRA não informada");
  });
});

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

describe("Dashboard Técnico — CSV geral e busca por INFRA", () => {
  it("anexa ID, descrição de INFRA e as quantidades preservando null, zero, decimais e texto livre", async () => {
    const downloads = captureDownloads();
    state.technical = [
      { ...prod, id: "csv-1", tipo_servico: "INFRA, BINDER", infra_descricao: 'Valeta "A";\n  trecho  ', binder_ton: 12.345678, bm25_ton: 0, fresagem_m2: null, observacoes: "linha 1\nlinha 2  " },
      { ...prod, id: "csv-2", tipo_servico: null, houve_producao: false, motivo_sem_producao: "Chuva", choveu: true, observacoes: "x" },
    ];
    await mount();
    irPara("Sem produção");
    expect(screen.getByText("CSV exporta todos os RDOs dos filtros gerais, independentemente da aba de assunto.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /CSV$/ }));
    expect(downloads).toHaveLength(1);
    expect([...new Uint8Array(await downloads[0].arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const [head, ...data] = parseCsv((await downloads[0].text()).replace(/^﻿/, ""));
    expect(head.slice(0, 15)).toEqual(["Data", "OGS", "Status", "Engenheiro", "Equipe", "Localização", "Houve produção", "Tipo serviço", "Usina", "Usina atendeu", "Equipamentos conformes", "Houve ocorrência", "Motivo sem produção", "Descrição ocorrência", "Observações"]);
    expect(head.slice(15)).toEqual(["ID do RDO", "Descrição de INFRA", ...TECHNICAL_QUANTITIES.map(q => q.label)]);
    expect(head).toHaveLength(17 + TECHNICAL_QUANTITIES.length);
    expect(data).toHaveLength(2);
    const byId = Object.fromEntries(data.map(r => [r[15], r]));
    const a = byId["csv-1"];
    expect(a[14]).toBe("linha 1\nlinha 2  ");
    expect(a[16]).toBe('Valeta "A";\n  trecho  ');
    const col = (r: string[], field: string) => r[17 + TECHNICAL_QUANTITIES.findIndex(q => q.field === field)];
    expect(col(a, "binder_ton")).toBe("12,345678");
    expect(col(a, "bm25_ton")).toBe("0");
    expect(col(a, "fresagem_m2")).toBe("");
    expect(col(a, "egl_ton")).toBe("");
    expect(head[17 + TECHNICAL_QUANTITIES.findIndex(q => q.field === "bm25_ton")]).toBe("BN25 (ton)");
    const b = byId["csv-2"];
    expect(b[16]).toBe("");
    TECHNICAL_QUANTITIES.forEach(q => expect(col(b, q.field)).toBe(""));
  });
  it("busca infra_descricao nos períodos atual e anterior, sem acoplar à validação", async () => {
    state.technical = [
      { ...prod, id: "b1", tipo_servico: "INFRA", infra_descricao: "Bueiro celular" },
      { ...prod, id: "b2", tipo_servico: "INFRA", infra_descricao: "Outro" },
      { ...prod, id: "b3", data: "2026-09-20", tipo_servico: "INFRA", infra_descricao: "Bueiro antigo" },
      { ...prod, id: "b4", data: "2026-09-21", tipo_servico: "INFRA", infra_descricao: "Diferente" },
    ];
    await mount();
    const linha = () => within(section("Comparativo com período anterior")).getByText("Total de RDOs").closest("tr")!;
    const celulas = () => within(linha()).getAllByRole("cell").map(c => c.textContent);
    expect(celulas().slice(1, 3)).toEqual(["2", "2"]);
    busca("bueiro");
    expect(celulas().slice(1, 3)).toEqual(["1", "1"]);
    irPara("Validações");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("4 pendentes no total");
  });
});

describe("Dashboard Técnico — estrutura de uma seção por vez", () => {
  it("abre na Visão geral, lista as 10 seções com contadores e mostra só a seção selecionada", async () => {
    state.technical = [
      { ...prod, id: "n1", tipo_servico: "FRESAGEM", fresagem_m2: 10 },
      { ...prod, id: "n2", houve_producao: false, motivo_sem_producao: "Chuva", choveu: true },
    ];
    await mount();
    const botoes = within(nav()).getAllByRole("button");
    expect(botoes.map(b => b.textContent)).toEqual([
      expect.stringContaining("Visão geral"), expect.stringContaining("Produção"), expect.stringContaining("Preenchimento"),
      expect.stringContaining("Validações"), expect.stringContaining("Alertas"), expect.stringContaining("Clima"),
      expect.stringContaining("Usina"), expect.stringContaining("Equipamentos"), expect.stringContaining("Ocorrências"), expect.stringContaining("Sem produção"),
    ]);
    expect(within(nav()).getByRole("button", { name: /^Visão geral/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("button", { name: /^Produção/ })).toHaveTextContent("1");
    expect(within(nav()).getByRole("button", { name: /^Usina/ })).toHaveTextContent("0");
    expect(within(nav()).getByRole("button", { name: /^Validações/ })).toHaveTextContent("4");
    expect(screen.getByRole("heading", { name: "Comparativo com período anterior" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Alertas operacionais dos RDOs Técnicos" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("total-fila-validacao")).not.toBeInTheDocument();
    irPara("Alertas");
    expect(within(nav()).getByRole("button", { name: /^Alertas/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("button", { name: /^Visão geral/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "Alertas operacionais dos RDOs Técnicos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Comparativo com período anterior" })).not.toBeInTheDocument();
  });
  it("usa casca desktop de altura fixa com painel único limitado", async () => {
    await mount();
    const shell = nav().closest("[data-testid='dashboard-shell']")!;
    expect(shell).toHaveClass("lg:h-[100dvh]", "lg:overflow-hidden");
    const painel = screen.getByTestId("painel-secao");
    expect(painel).toHaveClass("min-h-0", "overflow-y-auto");
    expect(shell.querySelectorAll("[data-testid='painel-secao']")).toHaveLength(1);
    expect(screen.getByTestId("faixa-kpis").className).toContain("shrink-0");
  });
  it("mantém filtros técnicos entre seções; contagem de Validações segue só a fila", async () => {
    await mount();
    busca("inexistente");
    expect(within(nav()).getByRole("button", { name: /^Validações/ })).toHaveTextContent("4");
    expect(within(nav()).getByRole("button", { name: /^Produção/ })).toHaveTextContent("0");
    irPara("Produção");
    irPara("Preenchimento");
    expect(screen.getByLabelText("Busca rápida")).toHaveValue("inexistente");
    irPara("Validações");
    fireEvent.change(screen.getByLabelText("Busca na fila"), { target: { value: "inexistente" } });
    expect(within(nav()).getByRole("button", { name: /^Validações/ })).toHaveTextContent("0");
    irPara("Visão geral");
    irPara("Validações");
    expect(screen.getByLabelText("Busca na fila")).toHaveValue("inexistente");
  });
});

describe("Dashboard Técnico — visão geral compacta e navegação móvel", () => {
  it("visão geral usa linhas densas e chips, sem gráfico, mantendo comparativo de 7 linhas e m³", async () => {
    state.technical = [{ ...prod, id: "v1", tipo_servico: "BGTC", bgtc_m3: 12.5, usina_atendeu: false }];
    await mount();
    expect(screen.queryByText("Top engenheiros por RDOs enviados")).not.toBeInTheDocument();
    const resumo = screen.getByTestId("resumo-status");
    expect(resumo).toHaveTextContent("Enviados");
    expect(resumo).toHaveTextContent("Rascunhos");
    expect(resumo).toHaveTextContent("Conformidade");
    expect(resumo).toHaveTextContent("Base/Volume: 12,5 m³");
    const chips = screen.getByTestId("chips-operacionais");
    expect(within(chips).getByRole("button", { name: /Alertas operacionais: 1/ })).toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: /Validações pendentes.*: 4/ })).toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: /Usina não atendeu: 1/ })).toBeInTheDocument();
    const comparison = section("Comparativo com período anterior");
    expect(within(comparison).getAllByRole("row")).toHaveLength(8);
    fireEvent.click(within(chips).getByRole("button", { name: /Alertas operacionais/ }));
    expect(screen.getByRole("heading", { name: "Alertas operacionais dos RDOs Técnicos" })).toBeInTheDocument();
  });
  it("distribuição por engenheiro fica em diálogo aberto por ação explícita no Preenchimento", async () => {
    await mount();
    irPara("Preenchimento");
    expect(screen.queryByText("Top engenheiros por RDOs enviados")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Distribuição por engenheiro" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Top engenheiros por RDOs enviados")).toBeInTheDocument();
    expect(within(dialogo).getByTestId("distribuicao-engenheiros")).toHaveTextContent("Ana");
    expect(within(dialogo).getByTestId("distribuicao-engenheiros")).toHaveTextContent("1");
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /^Preenchimento/ })).toHaveAttribute("aria-current", "page");
  });
  it("em telas pequenas a navegação é um seletor rotulado, sincronizado com a barra lateral", async () => {
    await mount();
    const seletor = screen.getByLabelText("Seção do Dashboard") as HTMLSelectElement;
    expect(seletor.tagName).toBe("SELECT");
    expect(seletor.options).toHaveLength(10);
    expect(seletor.value).toBe("geral");
    fireEvent.change(seletor, { target: { value: "alertas" } });
    expect(screen.getByRole("heading", { name: "Alertas operacionais dos RDOs Técnicos" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /^Alertas/ })).toHaveAttribute("aria-current", "page");
    expect(seletor.options[4].textContent).toMatch(/Alertas \(\d+\)/);
  });
});

describe("Dashboard Técnico — paginação e detalhes", () => {
  const lote = (n: number, extra: (i: number) => Record<string, unknown> = () => ({})) =>
    Array.from({ length: n }, (_, i) => ({ ...prod, id: `r-${i}`, ogs_number: `P-${i}`, tipo_servico: "FRESAGEM", fresagem_m2: 1, ...extra(i) }));
  it("pagina a Produção em 20 linhas, alcança todos os registros e reinicia/ajusta ao mudar o filtro", async () => {
    state.technical = lote(45);
    await openProducao();
    const intervalo = () => screen.getByTestId("paginacao-intervalo");
    expect(intervalo()).toHaveTextContent("1–20 de 45 registros");
    expect(screen.getByTestId("paginacao-status")).toHaveTextContent("Página 1 de 3");
    expect(screen.getAllByRole("row")).toHaveLength(21);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(intervalo()).toHaveTextContent("41–45 de 45 registros");
    expect(screen.getByText("P-44")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    busca("P-4");
    expect(intervalo()).toHaveTextContent("1–6 de 6 registros");
    expect(screen.getByTestId("paginacao-status")).toHaveTextContent("Página 1 de 1");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    busca("inexistente");
    expect(screen.queryByTestId("paginacao-intervalo")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum lançamento para este assunto com os filtros atuais.")).toBeInTheDocument();
  });
  it("volta à primeira página ao trocar de seção e mantém a página ao fechar o diálogo", async () => {
    state.technical = lote(45, i => ({ observacoes: `Obs\n  ${i}  `, houve_ocorrencia: true, descricao_ocorrencia: `Ocorrência longa ${i}` }));
    await openProducao();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–40 de 45");
    const linha = screen.getByText("P-25").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhes/ }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("r-25")).toBeInTheDocument();
    expect(within(dialogo).getByTestId("detalhe-observacoes-r-25").textContent).toBe("Obs\n  25  ");
    expect(within(dialogo).getByTestId("detalhe-observacoes-r-25")).toHaveClass("whitespace-pre-wrap");
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–40 de 45");
    expect(screen.getByLabelText("Busca rápida")).toHaveValue("");
    irPara("Ocorrências");
    expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("1–20 de 45");
    fireEvent.click(within(screen.getByText("P-3").closest("tr")!).getByRole("button", { name: /Ver detalhes/ }));
    expect(within(screen.getByRole("dialog")).getByText("Ocorrência longa 3")).toBeInTheDocument();
  });
  it("Ver assunto seleciona a seção correta e localiza o RDO alvo numa página posterior", async () => {
    state.technical = Array.from({ length: 25 }, (_, i) => ({ ...prod, id: `s-${i}`, ogs_number: "9000", houve_producao: false, motivo_sem_producao: "Outro", outro_motivo_sem_producao: `Alvo-${i}` }));
    await mount();
    irPara("Alertas");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–25 de 25 alertas");
    const alvo = screen.getByText("Alvo-24").closest("tr")!;
    fireEvent.click(within(alvo).getByRole("button", { name: "Ver assunto" }));
    expect(within(nav()).getByRole("button", { name: /^Sem produção/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Busca rápida")).toHaveValue("9000");
    expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–25 de 25 registros");
    const foco = document.querySelector("[data-foco='true']")!;
    expect(foco).toHaveTextContent("Alvo-24");
  });
  it("Preenchimento: ação por engenheiro abre lista paginada dos RDOs dele", async () => {
    state.technical = Array.from({ length: 12 }, (_, i) => ({ ...prod, id: `e-${i}`, ogs_number: `E-${i}` }));
    await mount();
    irPara("Preenchimento");
    fireEvent.click(screen.getByRole("button", { name: "Ver registros de Ana" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByTestId("paginacao-intervalo")).toHaveTextContent("1–10 de 12 registros");
    expect(within(dialogo).getAllByRole("row")).toHaveLength(11);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Próxima página" }));
    expect(within(dialogo).getByTestId("paginacao-intervalo")).toHaveTextContent("11–12 de 12 registros");
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /^Preenchimento/ })).toHaveAttribute("aria-current", "page");
  });
  it("Validações: pendências do responsável e listas sem vínculo abrem em diálogo paginado, com IDs exatos", async () => {
    state.extraPending = Array.from({ length: 10 }, (_, i) => ({ id: `ext-${i}`, company_id: "c1", data: "2026-10-05", obra_nome: "OGS 2539", engenheiro_responsavel_user_id: "ana", engenheiro_responsavel: "Ana", status_validacao: "enviado", validado_por: null, validado_encarregado: true, encarregado_employee_id: "enc1", nao_aprovado_encarregado: false }));
    await mount();
    irPara("Validações");
    expect(screen.getByTestId("total-fila-validacao")).toHaveTextContent("14 pendentes no total · 13 vinculados · 1 sem identificação por ID");
    fireEvent.click(screen.getByRole("button", { name: "Ver pendências de Ana" }));
    let dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByTestId("paginacao-intervalo")).toHaveTextContent("1–10 de 12 pendências");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Próxima página" }));
    expect(within(dialogo).getByTestId("paginacao-intervalo")).toHaveTextContent("11–12 de 12 pendências");
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver RDOs sem engenheiro vinculado" }));
    dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("ID noid")).toBeInTheDocument();
    expect(within(dialogo).getByTestId("paginacao-intervalo")).toHaveTextContent("1–1 de 1 RDOs");
  });
});

describe("Dashboard Técnico — Atividades qualitativas", () => {
  const counts = () => [screen.getByTestId("qualitativa-infra").textContent, screen.getByTestId("qualitativa-ensaios").textContent];
  const fixture = () => [
    { ...prod, id: "q1", tipo_servico: "INFRA", infra_descricao: "Valeta" },
    { ...prod, id: "q2", tipo_servico: "FRESAGEM,  INFRA , INFRA", infra_descricao: "Sarjeta", fresagem_m2: 100 },
    { ...prod, id: "q3", tipo_servico: "ENSAIOS E EXTRAÇÕES" },
    { ...prod, id: "q4", tipo_servico: "ENSAIOS E EXTRAÇÕES, BINDER", binder_ton: 5 },
    { ...prod, id: "q5", tipo_servico: "INFRAESTRUTURA" },
    { ...prod, id: "q6", tipo_servico: "ENSAIOS E EXTRAÇÕES EXTRA" },
    { ...prod, id: "q7", tipo_servico: "INFRA", status: "rascunho" },
    { ...prod, id: "q8", tipo_servico: "INFRA", houve_producao: false, motivo_sem_producao: "Chuva" },
    { ...prod, id: "q9", tipo_servico: "FRESAGEM", fresagem_m2: 7 },
  ];
  it("conta RDOs por atividade, com tokens exatos, sem alterar somas quantitativas", async () => {
    state.technical = fixture();
    await openProducao();
    const box = screen.getByTestId("atividades-qualitativas");
    expect(box).toHaveTextContent("Atividades qualitativas");
    expect(box).toHaveTextContent("RDOs por atividade");
    expect(box).toHaveTextContent("podem se sobrepor");
    expect(box).toHaveTextContent("não representam t, m² ou m³");
    expect(counts()).toEqual(["3", "2"]);
    irPara("Visão geral");
    expect(within(section("Comparativo com período anterior")).getByText("Produção (m²)").parentElement).toHaveTextContent("107");
    expect(within(section("Comparativo com período anterior")).getByText("Produção (t)").parentElement).toHaveTextContent("5");
  });
  it("respeita os filtros gerais de status e mantém zeros sem linhas de produção", async () => {
    state.technical = fixture();
    await openProducao();
    abrirMaisFiltros();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "enviado" } });
    expect(counts()).toEqual(["2", "2"]);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "rascunho" } });
    expect(counts()).toEqual(["1", "0"]);
    busca("inexistente");
    expect(counts()).toEqual(["0", "0"]);
    expect(screen.getByText("Nenhum lançamento para este assunto com os filtros atuais.")).toBeInTheDocument();
  });
  it("conta ENSAIOS E EXTRAÇÕES sem produção numérica e não rotula outros serviços", async () => {
    state.technical = [{ ...prod, id: "e1", tipo_servico: "ENSAIOS E EXTRAÇÕES" }, { ...prod, id: "e2", tipo_servico: "GEOGRELHA" }];
    await openProducao();
    expect(counts()).toEqual(["0", "1"]);
    expect(screen.getByTestId("atividades-qualitativas")).not.toHaveTextContent("GEOGRELHA");
    irPara("Visão geral");
    expect(within(section("Comparativo com período anterior")).getByText("Produção (t)").parentElement).toHaveTextContent("0");
  });
});

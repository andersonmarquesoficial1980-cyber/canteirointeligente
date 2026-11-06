import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  linhas: [] as any[], gestor: false,
  salvarToneladas: vi.fn(async () => undefined), removerApontamento: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => true }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { user_id: "u1", company_id: "c1" }, loading: false }) }));
vi.mock("@/hooks/useOgsReference", () => ({ useOgsReference: () => ({ data: [{ id: "o1", ogs_number: "1001", client_name: "Obra A" }] }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, then: (cb: any) => Promise.resolve({ data: [{ id: "v1", frota: "VB01" }] }).then(cb) }; return q; } },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: any) => <select role="combobox" disabled={disabled} value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
vi.mock("@/lib/equipDisponibilidade", () => ({ podeGerir: vi.fn(async () => h.gestor) }));
vi.mock("@/lib/equipProducao", async () => {
  const real = await vi.importActual<typeof import("@/lib/equipProducao")>("@/lib/equipProducao");
  return { ...real, listarProducao: vi.fn(async () => h.linhas), salvarToneladas: h.salvarToneladas, removerApontamento: h.removerApontamento };
});

import GestaoFrotasProducao from "./GestaoFrotasProducao";

const base = { ogs_number: "1001", data: "2026-10-05", turno: "noturno", valor: null, lancado: false, apontamento_id: null };
const vibro = (o: any = {}) => ({ ...base, equipamento_id: "v1", frota: "VB01", tipo: "vibroacabadora", unidade: "t", fonte: "apontamento", ...o });
const fresa = (o: any = {}) => ({ ...base, equipamento_id: "f1", frota: "FR01", tipo: "fresadora", unidade: "m", fonte: "diario", ...o });
const renderPage = (url = "/gestao-frotas/producao") => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GestaoFrotasProducao /></MemoryRouter>);

beforeEach(() => { h.linhas = []; h.gestor = false; h.salvarToneladas.mockClear(); h.removerApontamento.mockClear(); });
afterEach(cleanup);

describe("WF Gestão de Frotas — Apontamento de produção", () => {
  it("resumo soma só o lançado e mostra pendências sem virar zero", async () => {
    h.linhas = [vibro({ valor: 300.5, lancado: true, apontamento_id: "a1" }), vibro({ data: "2026-10-06" }), fresa({ valor: 200.5, lancado: true }), fresa({ data: "2026-10-06" })];
    renderPage();
    expect((await screen.findAllByText("300,50 t")).length).toBe(2); // resumo + linha
    expect(screen.getAllByText("1 lançado(s) · 1 pendente(s)").length).toBe(2); // vibro e fresa
    expect(screen.getByText("200,50 m")).toBeInTheDocument(); // só o resumo (aba vibro ativa)
    expect(screen.getByText("Sem lançamento")).toBeInTheDocument();
  });

  it("aba fresadora é somente leitura e explica a fonte única", async () => {
    h.linhas = [fresa({ valor: 200.5, lancado: true })];
    renderPage("/gestao-frotas/producao?aba=fresadora");
    expect(await screen.findByText(/única fonte/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lançar|Corrigir/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo apontamento/ })).toBeNull();
  });

  it("lançar toneladas de um dia pendente grava com a chave do dia", async () => {
    h.linhas = [vibro()];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Lançar/ }));
    fireEvent.change(await screen.findByLabelText("Toneladas descarregadas (t) *"), { target: { value: "312,45" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.salvarToneladas).toHaveBeenCalledTimes(1));
    expect((h.salvarToneladas.mock.calls[0] as any[])[0]).toMatchObject({
      companyId: "c1", userId: "u1", equipamentoId: "v1", ogs: "1001", data: "2026-10-05", turno: "noturno", toneladas: 312.45, apontamentoId: null,
    });
  });

  it("valida toneladas vazias/negativas antes de salvar", async () => {
    h.linhas = [vibro()];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Lançar/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Informe as toneladas/);
    fireEvent.change(screen.getByLabelText("Toneladas descarregadas (t) *"), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/negativas/);
    expect(h.salvarToneladas).not.toHaveBeenCalled();
  });

  it("corrigir mantém a chave fixa e envia o id do apontamento", async () => {
    h.linhas = [vibro({ valor: 100, lancado: true, apontamento_id: "a1" })];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Corrigir/ }));
    const campo = await screen.findByLabelText("Toneladas descarregadas (t) *");
    expect((campo as HTMLInputElement).value).toBe("100");
    expect(screen.getByLabelText("Data do turno *")).toBeDisabled();
    fireEvent.change(campo, { target: { value: "110,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.salvarToneladas).toHaveBeenCalledTimes(1));
    expect((h.salvarToneladas.mock.calls[0] as any[])[0]).toMatchObject({ toneladas: 110.5, apontamentoId: "a1" });
  });

  it("novo apontamento (dia sem diário) exige equipamento e obra", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Novo apontamento/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Selecione a vibroacabadora/);
  });

  it("remover só aparece para a gestão", async () => {
    h.linhas = [vibro({ valor: 100, lancado: true, apontamento_id: "a1" })];
    renderPage();
    await screen.findAllByText("100,00 t");
    expect(screen.queryByLabelText("Remover apontamento")).toBeNull();
    cleanup(); h.gestor = true; renderPage();
    fireEvent.click(await screen.findByLabelText("Remover apontamento"));
    await waitFor(() => expect(h.removerApontamento).toHaveBeenCalledWith("a1"));
  });

  it("período sem dias mostra mensagem de vazio", async () => {
    renderPage();
    expect(await screen.findByText(/Nenhum dia de vibroacabadora/)).toBeInTheDocument();
  });
});

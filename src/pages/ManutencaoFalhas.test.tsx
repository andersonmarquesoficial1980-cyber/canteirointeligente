import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  falhas: [] as any[],
  gestor: false,
  criarFalha: vi.fn(async () => "nova-id"),
  atualizarFalha: vi.fn(async () => undefined),
  adicionarReparo: vi.fn(async () => undefined),
  removerReparo: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => true }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ profile: { user_id: "u1", company_id: "c1", perfil: "Mecânico", nome_completo: "Zé", email: "" }, loading: false }),
}));
vi.mock("@/hooks/useOgsReference", () => ({ useOgsReference: () => ({ data: [{ id: "o1", ogs_number: "1001", client_name: "Obra A" }] }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (cb: any) => Promise.resolve({ data: [{ id: "e1", frota: "FA01", tipo: "Fresadora" }] }).then(cb) };
      return q;
    },
  },
}));
// Select do Radix não é utilizável no jsdom: troca por <select> nativo.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => <select role="combobox" value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
vi.mock("@/lib/equipDisponibilidade", async () => {
  const real = await vi.importActual<typeof import("@/lib/equipDisponibilidade")>("@/lib/equipDisponibilidade");
  return {
    ...real,
    listarFalhas: vi.fn(async () => h.falhas),
    podeGerir: vi.fn(async () => h.gestor),
    criarFalha: h.criarFalha, atualizarFalha: h.atualizarFalha, adicionarReparo: h.adicionarReparo, removerReparo: h.removerReparo,
  };
});

import ManutencaoFalhas from "./ManutencaoFalhas";

const falha = (over: any = {}) => ({
  id: "f1", company_id: "c1", equipamento_id: "e1", ogs_number: "1001", parada_inicio: "2026-10-06T03:00:00Z", parada_fim: "2026-10-06T05:00:00Z",
  causa: "Hidráulica", descricao: null, origem: "mecanico", status: "confirmada", motivo_cancelamento: null, created_by: "u1",
  equipamentos: { frota: "FA01", tipo: "Fresadora" }, equip_falha_reparos: [], ...over,
});
const renderPage = (url = "/manutencao/falhas") => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ManutencaoFalhas /></MemoryRouter>);

beforeEach(() => { h.falhas = []; h.gestor = false; Object.values(h).forEach(v => typeof v === "function" && (v as any).mockClear?.()); });
afterEach(cleanup);

describe("WF Manutenção — Falhas e reparos", () => {
  it("lista falhas com situação, tempo parado e reparo 'não informado'", async () => {
    h.falhas = [falha(), falha({ id: "f2", parada_fim: null, equipamentos: { frota: "FA02", tipo: "Rolo" }, causa: "Motor" })];
    renderPage();
    expect(await screen.findByText("FA01")).toBeInTheDocument();
    expect(screen.getByText("FA02")).toBeInTheDocument();
    expect(screen.getByText("Voltou a operar")).toBeInTheDocument();
    expect(screen.getByText("Parado")).toBeInTheDocument();
    expect(screen.getAllByText(/reparo efetivo: não informado/).length).toBe(2);
    expect(screen.getByText(/parado: 2,00 h/)).toBeInTheDocument();
  });

  it("filtra por situação e busca, mantendo o filtro na URL", async () => {
    h.falhas = [falha(), falha({ id: "f2", parada_fim: null, equipamentos: { frota: "FA02", tipo: "Rolo" }, causa: "Motor" })];
    renderPage();
    await screen.findByText("FA01");
    fireEvent.click(screen.getByRole("button", { name: "Em aberto" }));
    expect(screen.queryByText("FA01")).toBeNull();
    expect(screen.getByText("FA02")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    fireEvent.change(screen.getByLabelText("Frota, obra ou causa"), { target: { value: "fa01" } });
    expect(screen.queryByText("FA02")).toBeNull();
  });

  it("mostra mensagem de vazio sem inventar dados", async () => {
    renderPage();
    expect(await screen.findByText("Nenhuma falha neste período.")).toBeInTheDocument();
  });

  it("autor registra retorno e trecho de reparo; valida reparo fora da parada", async () => {
    h.falhas = [falha({ parada_fim: null })];
    renderPage();
    fireEvent.click(await screen.findByText("FA01"));
    fireEvent.change(await screen.findByLabelText("Início do reparo"), { target: { value: "2026-10-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Fim do reparo"), { target: { value: "2026-10-05T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar trecho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/antes da parada/);
    expect(h.adicionarReparo).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Início do reparo"), { target: { value: "2026-10-06T04:00" } });
    fireEvent.change(screen.getByLabelText("Fim do reparo"), { target: { value: "2026-10-06T05:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar trecho" }));
    await waitFor(() => expect(h.adicionarReparo).toHaveBeenCalledTimes(1));
    expect((h.adicionarReparo.mock.calls[0] as any[])[0]).toMatchObject({ companyId: "c1", falhaId: "f1", userId: "u1" });
  });

  it("retorno em aberto: salvar exige data e grava parada_fim", async () => {
    h.falhas = [falha({ parada_fim: null })];
    renderPage();
    fireEvent.click(await screen.findByText("FA01"));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar retorno" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/voltou a operar/i);
    expect(h.atualizarFalha).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Voltou a operar em"), { target: { value: "2026-10-06T06:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar retorno" }));
    await waitFor(() => expect(h.atualizarFalha).toHaveBeenCalledTimes(1));
    expect((h.atualizarFalha.mock.calls[0] as any[])[1].parada_fim).toMatch(/^2026-10-06T/);
  });

  it("falha de outro autor: usuário comum só consulta; gestão edita", async () => {
    h.falhas = [falha({ created_by: "outro", parada_fim: null })];
    renderPage();
    fireEvent.click(await screen.findByText("FA01"));
    expect(await screen.findByText(/Somente quem registrou ou a gestão/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar retorno" })).toBeNull();
    cleanup();
    h.gestor = true;
    renderPage();
    fireEvent.click(await screen.findByText("FA01"));
    expect(await screen.findByRole("button", { name: "Salvar retorno" })).toBeInTheDocument();
  });

  it("cancelar falha exige motivo", async () => {
    h.falhas = [falha()];
    renderPage();
    fireEvent.click(await screen.findByText("FA01"));
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar falha/ }));
    const confirmar = screen.getByRole("button", { name: "Confirmar cancelamento" });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "Lançada duas vezes" } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(h.atualizarFalha).toHaveBeenCalledWith("f1", { status: "cancelada", motivo_cancelamento: "Lançada duas vezes" }));
  });

  it("modal: valida antes de salvar e grava falha em aberto sem fim", async () => {
    renderPage();
    await screen.findByText("Nenhuma falha neste período.");
    fireEvent.click(screen.getByRole("button", { name: /Registrar falha/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Registrar falha", hidden: false }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Selecione o equipamento/);
    expect(h.criarFalha).not.toHaveBeenCalled();

    const [equip, ogs, causa, origem] = screen.getAllByRole("combobox");
    await waitFor(() => expect(equip.querySelectorAll("option").length).toBeGreaterThan(1));
    fireEvent.change(equip, { target: { value: "e1" } });
    fireEvent.change(ogs, { target: { value: "1001" } });
    fireEvent.change(causa, { target: { value: "Hidráulica" } });
    expect((origem as HTMLSelectElement).value).toBe("mecanico"); // perfil "Mecânico"
    fireEvent.change(screen.getByLabelText("Quando parou? *"), { target: { value: "2026-10-06T01:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar falha" }));
    await waitFor(() => expect(h.criarFalha).toHaveBeenCalledTimes(1));
    expect((h.criarFalha.mock.calls[0] as any[])[0]).toMatchObject({
      companyId: "c1", userId: "u1", equipamentoId: "e1", ogs: "1001", causa: "Hidráulica", fimIso: null, origem: "mecanico",
    });
  });
});

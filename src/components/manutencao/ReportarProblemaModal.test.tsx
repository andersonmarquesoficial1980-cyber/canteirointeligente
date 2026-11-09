import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportarProblemaModal from "./ReportarProblemaModal";

const state = vi.hoisted(() => ({ insert: vi.fn(async () => ({ error: null })), toast: vi.fn() }));
const EQUIPS = [
  { id: "e1", company_id: "c1", frota: "CB027", nome: "Caminhão Basculante", status: "ativo" },
  { id: "e2", company_id: "c1", frota: "VA01", nome: "Vibroacabadora", status: "ativo" },
];
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/useEquipamentos", () => ({ useEquipamentos: () => ({ equipamentos: EQUIPS, loading: false, refetch: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => t === "equipment_diaries" ? { select: () => ({ eq: () => ({ gte: () => ({ lte: async () => ({ data: [{ equipment_fleet: "VA01" }] }) }) }) }) } : ({ insert: state.insert }), storage: { from: () => ({}) }, auth: { getUser: async () => ({ data: { user: null } }) } },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const profile = { user_id: "u1", nome_completo: "Eng Teste", perfil: "engenheiro", company_id: "c1" };

describe("ReportarProblemaModal — lista de frotas cadastradas", () => {
  it("sugere frotas existentes, vincula o equipamento e grava origem/contexto", async () => {
    render(<ReportarProblemaModal profile={profile} origem="rdo_tecnico" contexto="RDO Técnico — OGS 2539 — 2026-11-09" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Frota do equipamento"), { target: { value: "va" } });
    expect(screen.queryByRole("option", { name: /CB027/ })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("option", { name: /VA01/ }));
    fireEvent.change(screen.getByPlaceholderText(/Motor fazendo barulho/), { target: { value: "Temperatura alta" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Registrar Ocorrência" })); });
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({
      equipamento_id: "e2", frota: "VA01", origem: "rdo_tecnico", status: "ABERTA", descricao: "[RDO Técnico — OGS 2539 — 2026-11-09]",
    }));
  });

  it("não aceita frota digitada que não foi escolhida na lista", async () => {
    render(<ReportarProblemaModal profile={profile} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Frota do equipamento"), { target: { value: "XYZ999" } });
    fireEvent.change(screen.getByPlaceholderText(/Motor fazendo barulho/), { target: { value: "Barulho" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Registrar Ocorrência" })); });
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Escolha a frota na lista" }));
  });

  it("permite registrar sem frota (campo opcional)", async () => {
    render(<ReportarProblemaModal profile={profile} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Motor fazendo barulho/), { target: { value: "Problema geral" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Registrar Ocorrência" })); });
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ equipamento_id: null, frota: null, origem: "encarregado" }));
  });

  it("frotas que lançaram diário na obra aparecem primeiro e marcadas", async () => {
    render(<ReportarProblemaModal profile={profile} ogsNumber="2539" dataReferencia="2026-11-09" onClose={vi.fn()} />);
    fireEvent.focus(screen.getByLabelText("Frota do equipamento"));
    await waitFor(() => expect(screen.getAllByRole("option")[0]).toHaveTextContent("VA01"));
    const opcoes = screen.getAllByRole("option");
    expect(opcoes[0]).toHaveTextContent("na obra 2539");
    expect(opcoes[1]).toHaveTextContent("CB027");
    expect(opcoes[1]).not.toHaveTextContent("na obra");
  });

  it("pré-seleciona a frota citada no texto de não conformes e usa o texto como descrição", async () => {
    render(<ReportarProblemaModal profile={profile} textoInicial="Vibroacabadora VA01 com sensor quebrado" onClose={vi.fn()} />);
    expect(await screen.findByText(/Equipamento vinculado: VA01/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Vibroacabadora VA01 com sensor quebrado")).toBeInTheDocument();
  });

  it("não adivinha quando o texto cita mais de uma frota", async () => {
    render(<ReportarProblemaModal profile={profile} textoInicial="VA01 e CB027 com problema" onClose={vi.fn()} />);
    await act(async () => {});
    expect(screen.queryByText(/Equipamento vinculado/)).not.toBeInTheDocument();
  });
});

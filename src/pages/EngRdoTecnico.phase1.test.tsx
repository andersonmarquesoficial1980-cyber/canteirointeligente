import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({ write: vi.fn(), toast: vi.fn(), returned: true, error: null as null | { message: string }, reject: false, selectWrite: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/useFilteredData", () => ({ useTiposServico: () => ({ data: ["DEMOLIÇÃO", "INFRA", "FRESAGEM", "APLICAÇÃO DE FX II - BINDER"].map(nome => ({ nome })) }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "eng-teste" } } }) },
  from: (table: string) => {
    const ogs = { id: "ogs-teste", ogs_number: "1234", client_name: "Obra teste" };
    const data = table === "profiles" ? { company_id: "empresa-teste" }
      : table === "engenheiro_ogs" ? [{ ogs_reference: ogs }]
      : table === "ogs_reference" ? { ...ogs, location_address: "Rua teste" }
      : table === "ci_equipes" ? [{ nome: "Equipe teste" }]
      : table === "fornecedores" ? [{ nome: "Usina atual", tipo_insumos: ["Massa Asfáltica"] }, { nome: "Usina legada", tipo_insumo: "Massa Asfáltica" }, { nome: "Óleo", tipo_insumos: ["Óleo Diesel"] }]
      : table === "rdo_engenheiro" ? {
        id: "rdo-teste", ogs_id: ogs.id, ogs_number: ogs.ogs_number, data: "2026-10-20",
        houve_producao: true, choveu: false, equipamentos_conforme: true, status: "enviado", usina_programada: "Usina histórica", tipo_servico: "DEMOLIÇÃO",
      } : [];
    const result = Promise.resolve({ data, error: null });
    let updating = false;
    const writeResult = () => state.reject ? Promise.reject(new Error("Conexão interrompida")) : Promise.resolve({ data: state.returned ? [{ id: "rdo-teste" }] : [], error: state.error });
    const q = {
      select: (fields?: string) => { if (updating) state.selectWrite(fields); return q; }, eq: () => q, or: () => q, order: () => q,
      single: () => result,
      insert: (payload: unknown) => { state.write(payload); return Promise.resolve({ error: null }); },
      update: (payload: unknown) => { state.write(payload); updating = true; return q; },
      then: (resolve: any, reject: any) => (updating ? writeResult() : result).then(resolve, reject),
    };
    return q;
  },
} }));
import EngRdoTecnico from "./EngRdoTecnico";
import EngRdoTecnicoEditar from "./EngRdoTecnicoEditar";

async function mount(mode: string) {
  const edit = mode === "edição";
  await act(async () => { render(
    <MemoryRouter initialEntries={[edit ? "/editar/rdo-teste" : "/novo"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/novo" element={<EngRdoTecnico />} /><Route path="/editar/:id" element={<EngRdoTecnicoEditar />} /></Routes>
    </MemoryRouter>,
  ); });
  await screen.findByRole("heading", { name: edit ? "Editar RDO Técnico" : "RDO Técnico" });
  if (!edit) {
    await act(async () => { fireEvent.change(screen.getByText("OGS / Obra *").parentElement!.querySelector("select")!, { target: { value: "ogs-teste" } }); });
    fireEvent.click(screen.getByRole("checkbox", { name: "DEMOLIÇÃO" }));
    fireEvent.click(screen.getByRole("button", { name: "Conforme" }));
  }
}
function question(name: string) { return within(screen.getByText(name).parentElement!); }
function submit(mode: string, draft = false) {
  fireEvent.click(screen.getByRole("button", { name: draft ? (mode === "edição" ? "Rascunho" : "Salvar rascunho") : (mode === "edição" ? "Salvar e Enviar" : "Enviar RDO") }));
}
beforeEach(() => { state.write.mockClear(); state.toast.mockClear(); state.selectWrite.mockClear(); state.returned = true; state.error = null; state.reject = false; });
afterEach(() => { cleanup(); sessionStorage.clear(); });

describe.each(["criação", "edição"])("RDO Técnico — %s", (mode) => {
  it("exige medição do Binder no envio, mas permite rascunho sem medição", async () => {
    await mount(mode);
    fireEvent.click(screen.getByRole("checkbox", { name: "APLICAÇÃO DE FX II - BINDER" }));
    await act(async () => submit(mode));
    expect(state.write).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Informe Binder (ton) com valor maior que zero" }));
    await act(async () => submit(mode, true));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "rascunho", binder_ton: null }));
  });
  it("aceita medição decimal positiva no envio", async () => {
    await mount(mode);
    fireEvent.click(screen.getByRole("checkbox", { name: "APLICAÇÃO DE FX II - BINDER" }));
    fireEvent.change(screen.getByText("Binder (ton)").parentElement!.querySelector("input")!, { target: { value: "12.5" } });
    await act(async () => submit(mode));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "enviado", binder_ton: 12.5 }));
  });
  it("permite INFRA descritiva sem tonelagem e preserva a descrição", async () => {
    await mount(mode);
    fireEvent.click(screen.getByRole("checkbox", { name: "DEMOLIÇÃO" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "INFRA" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: execução de galeria, drenagem, guia/sarjeta..."), { target: { value: "Execução de drenagem" } });
    await act(async () => submit(mode));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "enviado", tipo_servico: "INFRA", infra_descricao: "Execução de drenagem", binder_ton: null }));
  });
  it("exige descrição de INFRA no envio, mas não impede rascunho incompleto", async () => {
    await mount(mode);
    fireEvent.click(screen.getByRole("checkbox", { name: "INFRA" }));
    await act(async () => submit(mode));
    expect(state.write).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Descreva o tipo de infra executada" }));
    await act(async () => submit(mode, true));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "rascunho", infra_descricao: null }));
  });
  it("bloqueia envio produtivo sem serviço e permite salvar esse caso como rascunho", async () => {
    await mount(mode);
    fireEvent.click(screen.getByRole("checkbox", { name: "DEMOLIÇÃO" }));
    await act(async () => submit(mode));
    expect(state.write).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Selecione ao menos um serviço executado" }));
    await act(async () => submit(mode, true));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "rascunho", houve_producao: true, tipo_servico: null }));
  });
  it("salva dia parado como rascunho com identificação e observações", async () => {
    await mount(mode);
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Não" }));
    fireEvent.click(screen.getByRole("button", { name: "Folga / Feriado" }));
    fireEvent.change(screen.getByText("Equipe / Setor").parentElement!.querySelector("select")!, { target: { value: "Equipe teste" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Av. Paulista, 1000"), { target: { value: "Rua teste" } });
    fireEvent.change(screen.getByPlaceholderText(mode === "edição" ? "Observações gerais..." : "Observações adicionais..."), { target: { value: "Folga programada" } });
    await act(async () => { submit(mode, true); });
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ status: "rascunho", houve_producao: false,
      equipe: "Equipe teste", localizacao: "Rua teste", choveu: false, intensidade_chuva: null,
      houve_ocorrencia: false, descricao_ocorrencia: null, observacoes: "Folga programada" }));
    expect(screen.queryByRole("heading", { name: "Quantitativos de Produção" })).not.toBeInTheDocument();
  });

  it("exige intensidade de chuva também no dia parado", async () => {
    await mount(mode);
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Não" }));
    fireEvent.click(screen.getByRole("button", { name: "Chuva" }));
    fireEvent.click(question("Choveu no período?").getByRole("button", { name: "Sim" }));
    await act(async () => { submit(mode); });
    expect(state.write).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Selecione a intensidade da chuva" }));
  });

  it("mantém identificação e chuva ao alternar produção de volta para sim", async () => {
    await mount(mode);
    fireEvent.change(screen.getByText("Equipe / Setor").parentElement!.querySelector("select")!, { target: { value: "Equipe teste" } });
    fireEvent.click(question("Choveu no período?").getByRole("button", { name: "Sim" }));
    fireEvent.click(screen.getByRole("button", { name: "Moderado" }));
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Não" }));
    fireEvent.click(screen.getByRole("button", { name: "Sem Atividade" }));
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Sim" }));
    fireEvent.click(screen.getByRole("button", { name: "Conforme" }));
    await act(async () => { submit(mode); });
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ houve_producao: true,
      equipe: "Equipe teste", choveu: true, intensidade_chuva: "Moderado", motivo_sem_producao: null }));
  });

  it("bloqueia motivo Chuva com meteorologia marcada como não", async () => {
    await mount(mode);
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Não" }));
    fireEvent.click(screen.getByRole("button", { name: "Chuva" }));
    await act(async () => { submit(mode); });
    expect(state.write).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Para o motivo Chuva, informe que choveu no período", variant: "destructive" }));
  });

  it("preserva meteorologia, equipe, localização e ocorrência ao mudar para sem produção", async () => {
    await mount(mode);
    fireEvent.change(screen.getByText("Equipe / Setor").parentElement!.querySelector("select")!, { target: { value: "Equipe teste" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Av. Paulista, 1000"), { target: { value: "Rua teste, 20" } });
    fireEvent.click(question("Choveu no período?").getByRole("button", { name: "Sim" }));
    fireEvent.click(screen.getByRole("button", { name: "Forte" }));
    fireEvent.click(question("Houve ocorrência?").getByRole("button", { name: "Sim" }));
    fireEvent.change(screen.getByPlaceholderText("Descreva o que aconteceu..."), { target: { value: "Acesso bloqueado" } });
    fireEvent.click(question("Houve produção?").getByRole("button", { name: "Não" }));
    fireEvent.click(screen.getByRole("button", { name: "Chuva" }));
    expect(screen.getByRole("heading", { name: "Meteorologia" })).toBeVisible();
    expect(screen.getByDisplayValue("Rua teste, 20")).toBeVisible();
    expect(screen.getByDisplayValue("Acesso bloqueado")).toBeVisible();
    submit(mode);
    await waitFor(() => expect(state.write).toHaveBeenCalled());
    expect(state.write.mock.calls[0][0]).toMatchObject({
      houve_producao: false, motivo_sem_producao: "Chuva", choveu: true, intensidade_chuva: "Forte",
      equipe: "Equipe teste", localizacao: "Rua teste, 20", houve_ocorrencia: true, descricao_ocorrencia: "Acesso bloqueado",
      binder_ton: null, usina_programada: null, status: "enviado",
    });
  });
});

describe("Alinhamento do catálogo e confirmação da edição", () => {
  it.each(["criação", "edição"])("usa fornecedores de massa asfáltica na %s, incluindo classificação legada", async (mode) => {
    await mount(mode);
    const select = screen.getByText("Usina Programada").parentElement!.querySelector("select")!;
    expect(within(select).getByRole("option", { name: "Usina atual" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Usina legada" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Óleo" })).not.toBeInTheDocument();
  });
  it("mantém selecionada a usina histórica ausente do catálogo", async () => {
    await mount("edição");
    expect(screen.getByText("Usina Programada").parentElement!.querySelector("select")).toHaveValue("Usina histórica");
    await act(async () => submit("edição"));
    expect(state.write).toHaveBeenCalledWith(expect.objectContaining({ usina_programada: "Usina histórica" }));
    expect(state.selectWrite).toHaveBeenCalledWith("id");
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "RDO atualizado e enviado!" }));
  });
  it.each(["zero linhas", "erro do banco", "falha de conexão"])("não anuncia sucesso com %s", async (failure) => {
    await mount("edição");
    state.returned = false;
    state.error = failure === "erro do banco" ? { message: "Acesso negado" } : null;
    state.reject = failure === "falha de conexão";
    await act(async () => submit("edição"));
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "RDO atualizado e enviado!" }));
    expect(screen.getByRole("button", { name: "Salvar e Enviar" })).toBeEnabled();
  });
});

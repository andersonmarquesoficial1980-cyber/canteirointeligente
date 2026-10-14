import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mock = vi.hoisted(() => ({
  os: { id: "os1", numero_os: 25, equipment_fleet: "F-10", equipment_type: "FRESADORA", status: "aberta", titulo: "Trocar bit", data_abertura: "2026-10-01", "horímetro_conclusao": 120 },
  update: vi.fn(), insert: vi.fn(), updateError: null as null | { message: string },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: mock.os, error: null }), order: async () => ({ data: [], error: null }) }) }),
    update: (payload: unknown) => { mock.update(payload); return { eq: async () => ({ error: mock.updateError, data: null }) }; },
    insert: (payload: unknown) => { mock.insert(payload); return Promise.resolve({ error: null }); },
  }),
} }));
import ManutencaoOS from "./ManutencaoOS";
async function mount() {
  await act(async () => {
    render(<MemoryRouter initialEntries={["/manutencao/os/os1?origem=gestao-frotas"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/manutencao/os/:id" element={<ManutencaoOS />} /></Routes>
    </MemoryRouter>);
  });
}
afterEach(() => { cleanup(); mock.update.mockReset(); mock.insert.mockReset(); mock.updateError = null; });

describe("ordem de serviço — horímetros e gravação", () => {
  it("abre a OS com o horímetro de conclusão registrado", async () => {
    await mount();
    expect(screen.getByText("OS #25")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0")).toHaveValue(120);
  });
  it("grava a coluna real do horímetro e não a variante sem acento", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Bit fresadora"), { target: { value: "Bit" } });
    fireEvent.change(screen.getAllByPlaceholderText("0")[1], { target: { value: "135" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Atualização" }));
    await waitFor(() => expect(mock.update).toHaveBeenCalled());
    expect(mock.update.mock.calls[0][0]).toMatchObject({ "horímetro_conclusao": 120 });
    expect(mock.update.mock.calls[0][0]).not.toHaveProperty("horimetro_conclusao");
    await waitFor(() => expect(mock.insert).toHaveBeenCalled());
    expect(mock.insert.mock.calls[0][0][0]).toMatchObject({ "horímetro_troca": 135 });
    expect(mock.insert.mock.calls[0][0][0]).not.toHaveProperty("horimetro_troca");
  });
  it("não inclui peças se a atualização da OS falhou e informa o erro", async () => {
    mock.updateError = { message: "sem permissão para atualizar" };
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Bit fresadora"), { target: { value: "Bit" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Atualização" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar a OS"));
    expect(mock.insert).not.toHaveBeenCalled();
  });
});

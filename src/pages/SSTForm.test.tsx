import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({ saved: null as Record<string, unknown> | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        single: async () => ({ data: {
          id: "inspecao1", created_at: "2026-10-01T12:00:00Z", company_id: "empresa1",
          nome_obra: "OGS 123", data_inspecao: "2026-10-01", endereco: "Rua A",
          seg_apr: "nao_conforme", ass_engenheiro_img: "assinatura", fotos: [],
          campo_inesperado: "não deve ir ao banco",
        }, error: null }),
        update: (payload: Record<string, unknown>) => { state.saved = payload; return query; },
        then: (resolve: (value: unknown) => void) => Promise.resolve({ data: table === "employees" || table === "ogs_reference" ? [] : null, error: null }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/components/LogoHomeButton", () => ({ LogoHomeButton: () => <span /> }));
import SSTForm from "./SSTForm";

afterEach(() => { cleanup(); state.saved = null; });

describe("salvamento de inspeção SST", () => {
  it("mantém campos da inspeção sem reenviar id, criação ou colunas inesperadas", async () => {
    render(<MemoryRouter initialEntries={["/sst/inspecao1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/sst/:id" element={<SSTForm />} /><Route path="/sst" element={<div>Inspeções</div>} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Editar Inspeção")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Rascunho" }));
    await waitFor(() => expect(state.saved).not.toBeNull());
    expect(state.saved).toMatchObject({ nome_obra: "OGS 123", seg_apr: "nao_conforme", ass_engenheiro_img: "assinatura", status: "rascunho" });
    expect(state.saved).not.toHaveProperty("id");
    expect(state.saved).not.toHaveProperty("created_at");
    expect(state.saved).not.toHaveProperty("campo_inesperado");
  });
});

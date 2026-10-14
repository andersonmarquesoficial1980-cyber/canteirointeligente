import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; nome_obra: string; cliente: string | null; tecnico_responsavel: string | null; data_inspecao: string; status: string; created_at: string }>,
  ranges: [] as Array<[number, number]>,
  errorAt: -1,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    if (table !== "sst_inspections") throw new Error(`Tabela inesperada: ${table}`);
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: async (start: number, end: number) => {
        state.ranges.push([start, end]);
        if (start === state.errorAt) return { data: null, error: new Error("Falha de rede") };
        return { data: state.rows.slice(start, end + 1), error: null };
      },
    };
    return query;
  } },
}));
vi.mock("@/components/LogoHomeButton", () => ({ LogoHomeButton: () => <span /> }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => () => {} }));
import SSTInspecoes from "./SSTInspecoes";

const populate = (count: number) => {
  state.rows = Array.from({ length: count }, (_, i) => ({
    id: `inspecao-${i}`, nome_obra: `OGS ${i}`, cliente: null, tecnico_responsavel: null,
    data_inspecao: "2026-10-14", status: i === 0 ? "rascunho" : "concluido", created_at: "2026-10-14",
  }));
};
afterEach(() => { cleanup(); state.rows = []; state.ranges = []; state.errorAt = -1; });
const mount = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SSTInspecoes /></MemoryRouter>);

describe("lista SST", () => {
  it("exibe todos os 226 registros e contadores, não apenas os 100 primeiros", async () => {
    populate(226);
    mount();
    await waitFor(() => expect(screen.getByText("226 inspeções")).toBeInTheDocument());
    expect(screen.getByText("OGS 225")).toBeInTheDocument();
    expect(screen.getByText("OGS 0")).toBeInTheDocument();
    expect(state.ranges).toEqual([[0, 499]]);
    expect(screen.getByText("225")).toBeInTheDocument();
  });

  it("busca páginas seguintes sem truncar em 500 ou 1000 registros", async () => {
    populate(1001);
    mount();
    await waitFor(() => expect(screen.getByText("1001 inspeções")).toBeInTheDocument());
    expect(screen.getByText("OGS 1000")).toBeInTheDocument();
    expect(state.ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("não mostra contagem parcial como se fosse completa quando página posterior falha", async () => {
    populate(501);
    state.errorAt = 500;
    mount();
    await waitFor(() => expect(screen.getByText(/Não foi possível carregar as inspeções/i)).toBeInTheDocument());
    expect(screen.queryByText("500 inspeções")).not.toBeInTheDocument();
  });
});

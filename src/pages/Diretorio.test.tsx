import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mock = vi.hoisted(() => ({ filters: [] as Array<[string, unknown]> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const q = {
      select: () => q,
      eq: (column: string, value: unknown) => { if (table === "equipamentos") mock.filters.push([column, value]); return q; },
      order: () => q,
      then: (resolve: (result: unknown) => void) => Promise.resolve({ data: table === "equipamentos" && mock.filters.some(([c, v]) => c === "status" && v === "ativo") ? [{ id: "f1", frota: "FA20", status: "ativo", tipo: "FRESADORA" }] : [], error: null }).then(resolve),
    };
    return q;
  },
} }));
import Diretorio from "./Diretorio";
afterEach(() => { cleanup(); mock.filters = []; });

describe("Diretório de equipamentos", () => {
  it("consulta equipamentos ativos pela coluna status, não pela coluna inexistente ativo", async () => {
    render(<Diretorio />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Equipamentos" }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(screen.getByText("Frota/CC: FA20")).toBeInTheDocument());
    expect(mock.filters).toContainEqual(["status", "ativo"]);
    expect(mock.filters.some(([column]) => column === "ativo")).toBe(false);
  });
});

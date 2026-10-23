import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: true }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "aaaa" } } }) },
  from: (table: string) => {
    const data = table === "employees" ? [{ id: "e1", name: "Operador A", matricula: "123", role: "Operador", data_admissao: "2020-01-01", status: "ativo" }]
      : table === "user_permissions" ? [{ modulo_rh: true }]
      : table === "vacation_manual_history" ? [{ id: "m1", employee_id: "e1", data_inicio: "2025-07-01", data_fim: "2025-07-15", dias: 15, fonte: "Recibo RH 2025", tipo: "individual", periodo_inicio: null, periodo_fim: null }] : [];
    const promise = Promise.resolve({ data, error: null });
    const q = { select: () => q, eq: () => q, or: () => q, in: () => q, order: () => q, range: () => q, maybeSingle: async () => ({ data: data[0] || null, error: null }), then: promise.then.bind(promise) };
    return q;
  },
} }));
import ProgramacaoFerias from "./ProgramacaoFerias";

describe("férias — histórico manual no cadastro único", () => {
  it("mostra último gozo conhecido separadamente da programação e abre o registro manual", async () => {
    await act(async () => { render(<MemoryRouter><ProgramacaoFerias /></MemoryRouter>); });
    await waitFor(() => expect(screen.getByText("Operador A")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Operador A"));
    expect(screen.getByText(/Recibo RH 2025/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Registrar férias já gozadas/ }));
    expect(screen.getByRole("dialog", { name: "Registrar férias já gozadas" })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FuncionariosManager from "./FuncionariosManager";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      const rows: Record<string, unknown[]> = {
        employees: [
          { id: "1", name: "FUNCIONARIO PROPRIO", role: "Motorista", matricula: "1", origem: "PROPRIO", status: "ativo" },
          { id: "2", name: "FUNCIONARIO LEGADO", role: "Operador", matricula: "2", origem: null, status: "ativo" },
          { id: "3", name: "FUNCIONARIO TERCEIRO", role: "Ajudante", matricula: "3", origem: "TERCEIRO", status: "ativo" },
        ],
        ci_equipes: [],
        ci_centros_custo: [],
      };
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: rows[table] ?? [] }),
        maybeSingle: async () => ({ data: { company_id: "fremix" } }),
      };
      return query;
    },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useFuncoes", () => ({ useFuncoes: () => ({ funcoes: [] }) }));
vi.mock("@/hooks/useEmpresasParceiras", () => ({ useEmpresasParceiras: () => ({ empresas: [{ id: "parceira", nome: "PARCEIRA" }] }) }));

describe("Painel de Controle — Funcionários", () => {
  it("mostra próprios e legados, sem misturar terceirizados no total nem na lista", async () => {
    render(<FuncionariosManager />);
    await waitFor(() => expect(screen.getByText("2 funcionário(s)")).toBeTruthy());
    expect(screen.getByText("FUNCIONARIO PROPRIO")).toBeTruthy();
    expect(screen.getByText("FUNCIONARIO LEGADO")).toBeTruthy();
    expect(screen.queryByText("FUNCIONARIO TERCEIRO")).toBeNull();
  });

  it("reserva o cadastro do painel aos funcionários próprios", async () => {
    render(<FuncionariosManager />);
    await waitFor(() => expect(screen.getByText("2 funcionário(s)")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Novo/i }));
    expect(screen.queryByText("Empresa")).toBeNull();
    expect(screen.queryByText("PARCEIRA")).toBeNull();
  });
});

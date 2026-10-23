import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/useFuncoes", () => ({ useFuncoes: () => ({ funcoes: [] }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: "c1", perfil: "RH" } }) }));
vi.mock("@/components/EmployeeVacationTimeline", () => ({ EmployeeVacationTimeline: ({ employeeId, companyId }: { employeeId: string; companyId: string }) => <p>Ficha de férias: {employeeId} / {companyId}</p> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from(table: string) {
    const data = table === "employees" ? { id: "e1", company_id: "c1", name: "Operador A", matricula: "123", role: "Operador", status: "ativo", data_admissao: "2020-01-01" } : [];
    const response = Promise.resolve({ data, error: null });
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: table === "employees" ? data : null, error: null }), then: response.then.bind(response) };
    return q;
  },
} }));
import FichaFuncionario from "./FichaFuncionario";
const ProgrammingLocation = () => <p data-testid="programming-link">{useLocation().search}</p>;

describe("ficha do funcionário — férias", () => {
  it("oferece acesso ao histórico específico do empregado no cadastro único", async () => {
    render(<MemoryRouter initialEntries={["/gestao-pessoas/e1"]}><Routes><Route path="/gestao-pessoas/:id" element={<FichaFuncionario />} /><Route path="/programacao-ferias" element={<ProgrammingLocation />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /^Férias$/ }));
    expect(screen.getByText("Ficha de férias: e1 / c1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir programação e registrar histórico/ }));
    const query = new URLSearchParams(screen.getByTestId("programming-link").textContent || "");
    expect(query.get("funcionario_id")).toBe("e1");
    expect(query.get("returnTo")).toBe("/gestao-pessoas/e1?aba=ferias");
  });
});

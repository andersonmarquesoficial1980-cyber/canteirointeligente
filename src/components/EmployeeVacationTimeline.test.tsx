import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const requests: { table: string; filters: Record<string, string> }[] = [];
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from(table: string) {
    const req = { table, filters: {} as Record<string, string> };
    requests.push(req);
    const rows = table === "vacation_manual_history" ? [{ id: "h1", data_inicio: "2025-07-01", data_fim: "2025-07-15", dias: 15, tipo: "individual", fonte: "Recibo assinado RH", observacao: "", periodo_inicio: null, periodo_fim: null, criado_em: "2026-10-23T10:00:00Z" }]
      : table === "vacation_records" ? [{ id: "r1", data_inicio: "2026-12-01", data_fim: "2026-12-15", dias: 15, tipo: "individual", workflow_status: "programada", vacation_period_id: null, created_at: "2026-10-23T10:00:00Z" }] : [];
    const q = { select: () => q, eq: (key: string, value: string) => { req.filters[key] = value; return q; }, order: () => q, range: async () => ({ data: rows, error: null }) };
    return q;
  },
} }));
import { EmployeeVacationTimeline } from "./EmployeeVacationTimeline";

describe("ficha individual de férias", () => {
  it("separa gozo documentado de programação e não homologa saldo", async () => {
    requests.length = 0;
    render(<EmployeeVacationTimeline employeeId="e1" companyId="c1" viewerCompanyId="c1" admission="2020-01-01" />);
    expect(await screen.findByText(/Recibo assinado RH/)).toBeInTheDocument();
    expect(screen.getByText(/Usuário: a identificar/)).toBeInTheDocument();
    expect(screen.getByText(/Férias já gozadas — informadas pelo RH/)).toBeInTheDocument();
    expect(screen.getByText(/Programação — não comprova gozo/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo não homologado/)).toBeInTheDocument();
    expect(requests).toHaveLength(3);
    expect(requests.every(({ filters }) => filters.company_id === "c1" && filters.employee_id === "e1")).toBe(true);
  });
  it("não consulta férias quando a empresa do perfil diverge", async () => {
    requests.length = 0;
    render(<EmployeeVacationTimeline employeeId="e2" companyId="c2" viewerCompanyId="c1" admission="2020-01-01" />);
    expect(screen.getByText(/Acesso ao histórico de férias indisponível/)).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(0));
  });
});

import { describe, expect, it, vi } from "vitest";
import { fetchTeamsForCompany, filterByTeamSelection, excludeReturnedFleet, programadorEmployeesQuery } from "./programadorTeams";

describe("origem do cadastro de pessoas no Programador", () => {
  it("queries only own employees of the selected company, without duplicating the master registry", () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    const client = { from: vi.fn().mockReturnValue(query) };
    expect(programadorEmployeesQuery(client, "fremix")).toBe(query);
    expect(client.from).toHaveBeenCalledWith("employees");
    expect(query.select).toHaveBeenCalledWith("id, name, matricula, role, equipe, status, company_id", { count: "exact" });
    expect(query.eq).toHaveBeenCalledWith("company_id", "fremix");
    expect(query.eq).toHaveBeenCalledWith("origem", "PROPRIO");
  });
});

const company = "fremix";

describe("filtro de equipe no gerenciamento", () => {
  const rows = [{ team: null }, { team: " " }, { team: "CBUQ01" }, { team: "CBUQ02" }];
  it("shows people or equipment without an assigned team only when Sem equipe is selected", () => {
    expect(filterByTeamSelection(rows, "__sem_equipe__", row => row.team)).toEqual(rows.slice(0, 2));
    expect(filterByTeamSelection(rows, "CBUQ01", row => row.team)).toEqual([rows[2]]);
    expect(filterByTeamSelection(rows, "", row => row.team)).toEqual([]);
  });
});

describe("frota disponível para alocação por equipe", () => {
  it("removes returned equipment from the team roster without mutating the master list", () => {
    const fleet = [
      { id: "returned", setor: null, status: " DEVOLVIDO " },
      { id: "pending", setor: null, status: "devolver" },
      { id: "working", setor: "EQUIPE A", status: "ativo" },
    ];
    const available = excludeReturnedFleet(fleet);
    expect(available.map(eq => eq.id)).toEqual(["pending", "working"]);
    expect(filterByTeamSelection(available, "__sem_equipe__", eq => eq.setor).map(eq => eq.id)).toEqual(["pending"]);
    expect(fleet).toHaveLength(3);
  });
});

const people = [
  { id: "p1", company_id: company, equipe: "EQUIPE A" },
  { id: "p2", company_id: company, equipe: null },
  { id: "foreign", company_id: "other", equipe: "EQUIPE DE OUTRA EMPRESA" },
];
const equipment = [{ id: "q1", company_id: company, setor: "EQUIPE B" }];
const catalog = [
  { id: "t1", nome: "EQUIPE A", responsavel: "Ana", ativa: true, responsavel_employee_id: null },
  { id: "t2", nome: "EQUIPE B", responsavel: null, ativa: true, responsavel_employee_id: null },
  { id: "t3", nome: "EQUIPE NOVA", responsavel: "Beto", ativa: true, responsavel_employee_id: "p2" },
  { id: "t4", nome: "EQUIPE DE OUTRA EMPRESA", responsavel: "Outro", ativa: true, responsavel_employee_id: "foreign" },
  { id: "t5", nome: "SEM VÍNCULO", responsavel: null, ativa: true, responsavel_employee_id: null },
];

function clientWithCatalog(error: Error | null = null) {
  const eq = vi.fn((field: string) => {
    if (field === "company_id") throw new Error("column ci_equipes.company_id does not exist");
    return { order: vi.fn().mockResolvedValue({ data: error ? null : catalog, error }) };
  });
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table !== "ci_equipes") throw new Error("Tabela inesperada");
    return { select };
  });
  return { client: { from }, eq, select, from };
}

describe("catálogo de equipes no WF Programador", () => {
  it("loads the real global schema without querying a nonexistent company_id", async () => {
    const { client, eq, from } = clientWithCatalog();
    const rows = await fetchTeamsForCompany(client, company, people, equipment);
    expect(from).toHaveBeenCalledWith("ci_equipes");
    expect(eq).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("ativa", true);
    expect(rows.map(row => row.id)).toEqual(["t1", "t2", "t3"]);
  });
  it("does not disguise a failed team query as an empty catalog", async () => {
    const { client } = clientWithCatalog(new Error("Sem acesso"));
    await expect(fetchTeamsForCompany(client, company, people, equipment)).rejects.toThrow("Sem acesso");
  });
});

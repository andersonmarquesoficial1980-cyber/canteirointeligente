import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFile, unlink } from "node:fs/promises";
import RefeicoesRelatorio from "./RefeicoesRelatorio";

const state = vi.hoisted(() => ({
  failPeople: false,
  orders: [
    { id: "a", meal_date: "2026-10-15", shift: "diurno", supplier: "Luana", status: "entregue", delivered_quantity: 1, delivery_note: "Faltou uma", closed_at: null, delivered_at: null },
    { id: "b", meal_date: "2026-10-15", shift: "noturno", supplier: "Luana", status: "fechado", delivered_quantity: null, delivery_note: null, closed_at: null, delivered_at: null },
    { id: "c", meal_date: "2026-10-16", shift: "diurno", supplier: "Luana", status: "rascunho", delivered_quantity: null, delivery_note: null, closed_at: null, delivered_at: null },
  ],
  people: [
    { order_id: "a", employee_id: "1", employee_name: "Ana", team_name: "Manutenção", active: true },
    { order_id: "a", employee_id: "2", employee_name: "Beto", team_name: "Logística", active: true },
    { order_id: "b", employee_id: "3", employee_name: "Caio", team_name: "Manutenção", active: true },
    { order_id: "c", employee_id: "4", employee_name: "Dora", team_name: "Logística", active: true },
  ],
  calls: [] as {table:string; company:string; from:string; to:string}[],
  workbooks: [] as unknown[],
}));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("xlsx", async importOriginal => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return { ...actual, writeFile: (book: unknown) => { state.workbooks.push(book); } };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table:string) => {
    let company = "", from = "", to = "", ids: string[] = [];
    const q = {
      select: () => q, eq: (column:string, value:string) => { if (column === "company_id") company = value; return q; },
      gte: (_column:string, value:string) => { from = value; return q; },
      lte: (_column:string, value:string) => { to = value; return q; },
      in: (_column:string, value:string[]) => { ids = value; return q; },
      order: () => q,
      range: async (start:number,end:number) => {
        state.calls.push({table,company,from,to});
        if (table === "meal_order_people" && state.failPeople) return {data:null,count:null,error:{message:"falha de leitura"}};
        const rows = table === "meal_orders" ? state.orders.filter(o => o.meal_date >= from && o.meal_date <= to) : state.people.filter(p => ids.includes(p.order_id));
        return {data:rows.slice(start,end+1),count:rows.length,error:null};
      },
    }; return q;
  },
} }));
const pdfFile = "refeicoes-2026-10-15-a-2026-10-16.pdf";
afterEach(async () => {
  await unlink(pdfFile).catch(error => { if (error.code !== "ENOENT") throw error; });
  cleanup(); state.failPeople=false; state.calls=[]; state.workbooks=[]; toast.mockClear();
});

describe("Relatório de refeições", () => {
  it("consulta empresa e período, preserva equipes históricas e não reparte entrega por equipe", async () => {
    render(<RefeicoesRelatorio companyId="company-1" />);
    expect(screen.queryByText("Excel")).toBeNull(); // controls appear only after a complete search
    fireEvent.change(screen.getByLabelText("De"), {target:{value:"2026-10-15"}});
    fireEvent.change(screen.getByLabelText("Até"), {target:{value:"2026-10-16"}});
    fireEvent.click(screen.getByText("Buscar"));
    await screen.findByText("Pedidos (3)");
    expect(state.calls).toHaveLength(2);
    expect(state.calls.every(c=>c.company==="company-1")).toBe(true);
    expect(screen.getByText("Solicitadas").parentElement?.textContent).toContain("3");
    expect(screen.getByText("Entregues (turno)").parentElement?.textContent).toContain("1");
    expect(screen.getByText("Diferença (entregues)").parentElement?.textContent).toContain("-1");
    expect(screen.getByText("Aguardando entrega").parentElement?.textContent).toContain("1");
    fireEvent.change(screen.getByLabelText("Equipe do relatório"), {target:{value:"Manutenção"}});
    expect(screen.getByText("Pedidos (2)")).toBeTruthy();
    expect(screen.getByText("Entregues (turno)").parentElement?.textContent).toContain("—");
    expect(screen.getByText(/Entrega por equipe não registrada/)).toBeTruthy();
    fireEvent.click(screen.getAllByText((_, element) => element?.tagName === "SUMMARY" && element.textContent?.startsWith("Manutenção:") === true)[0]);
    expect(screen.getByText("Ana")).toBeTruthy();
  });
  it("não publica números parciais quando a leitura nominal falha", async () => {
    state.failPeople=true;
    render(<RefeicoesRelatorio companyId="company-1" />);
    fireEvent.change(screen.getByLabelText("De"), {target:{value:"2026-10-15"}});
    fireEvent.change(screen.getByLabelText("Até"), {target:{value:"2026-10-16"}});
    fireEvent.click(screen.getByText("Buscar"));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(screen.queryByText(/Pedidos \(/)).toBeNull();
  });
  it("gera Excel com resumo, pedidos, equipes e nomes sem inventar entrega por equipe", async () => {
    const XLSX = await import("xlsx");
    render(<RefeicoesRelatorio companyId="company-1" />);
    fireEvent.change(screen.getByLabelText("De"), {target:{value:"2026-10-15"}});
    fireEvent.change(screen.getByLabelText("Até"), {target:{value:"2026-10-16"}});
    fireEvent.click(screen.getByText("Buscar"));
    await screen.findByText("Pedidos (3)");
    fireEvent.change(screen.getByLabelText("Equipe do relatório"), {target:{value:"Manutenção"}});
    fireEvent.click(screen.getByText("Excel"));
    await waitFor(() => expect(state.workbooks).toHaveLength(1));
    const buffer = XLSX.write(state.workbooks[0] as import("xlsx").WorkBook, { type: "buffer", bookType: "xlsx" });
    const book = XLSX.read(buffer, { type: "buffer", cellDates: true });
    expect(book.SheetNames).toEqual(["Resumo", "Pedidos", "Equipes", "Funcionários"]);
    const orders = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Pedidos, { header: 1 });
    expect(orders).toHaveLength(3); // cabeçalho + 2 pedidos da equipe
    expect(orders[1][5]).toBe(1); // solicitado pela equipe
    expect(orders[1][6]).toBeUndefined(); // entrega do turno NÃO rateada
    const teams = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Equipes, { header: 1 });
    expect(teams[1][5]).toBe("Não registrado por equipe");
    const nominal = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Funcionários, { header: 1 });
    expect(nominal.map(row => row[3])).toContain("Ana");
    expect(nominal.map(row => row[3])).not.toContain("Beto");
  });
  it("gera PDF com pedidos, quadro por equipe e relação nominal", async () => {
    render(<RefeicoesRelatorio companyId="company-1" />);
    fireEvent.change(screen.getByLabelText("De"), {target:{value:"2026-10-15"}});
    fireEvent.change(screen.getByLabelText("Até"), {target:{value:"2026-10-16"}});
    fireEvent.click(screen.getByText("Buscar"));
    await screen.findByText("Pedidos (3)");
    fireEvent.click(screen.getByText("PDF"));
    await waitFor(() => expect((screen.getByText("PDF") as HTMLButtonElement).disabled).toBe(false));
    expect(toast).not.toHaveBeenCalled();
    const pdf = await readFile(pdfFile);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
    const content = pdf.toString("latin1");
    expect(content).toContain("(Ana)");
    expect(content).toContain("(Beto)");
    expect(content).toContain("(Caio)");
    expect(content).toContain("(Dora)");
  });
  it("PDF nominal respeita o filtro de equipe", async () => {
    render(<RefeicoesRelatorio companyId="company-1" />);
    fireEvent.change(screen.getByLabelText("De"), {target:{value:"2026-10-15"}});
    fireEvent.change(screen.getByLabelText("Até"), {target:{value:"2026-10-16"}});
    fireEvent.click(screen.getByText("Buscar"));
    await screen.findByText("Pedidos (3)");
    fireEvent.change(screen.getByLabelText("Equipe do relatório"), {target:{value:"Manutenção"}});
    fireEvent.click(screen.getByText("PDF"));
    await waitFor(() => expect((screen.getByText("PDF") as HTMLButtonElement).disabled).toBe(false));
    const content = (await readFile(pdfFile)).toString("latin1");
    expect(content).toContain("(Ana)");
    expect(content).toContain("(Caio)");
    expect(content).not.toContain("(Beto)");
    expect(content).not.toContain("(Dora)");
  });
});

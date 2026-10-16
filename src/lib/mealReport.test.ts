import { describe, expect, it } from "vitest";
import { makeMealReport, mealExcelDate, type MealOrderRow, type MealPersonRow } from "./mealReport";
const orders: MealOrderRow[] = [
  { id: "a", meal_date: "2026-10-15", shift: "diurno", supplier: "Fornecedor", status: "entregue", delivered_quantity: 2, delivery_note: null, closed_at: null, delivered_at: null },
  { id: "b", meal_date: "2026-10-15", shift: "noturno", supplier: "Fornecedor", status: "fechado", delivered_quantity: null, delivery_note: null, closed_at: null, delivered_at: null },
  { id: "c", meal_date: "2026-10-16", shift: "diurno", supplier: "Fornecedor", status: "rascunho", delivered_quantity: null, delivery_note: null, closed_at: null, delivered_at: null },
];
const people: MealPersonRow[] = [
  { order_id: "a", employee_id: "1", employee_name: "Ana", team_name: "Manutenção", active: true },
  { order_id: "a", employee_id: "2", employee_name: "Beto", team_name: "Logística", active: true },
  { order_id: "a", employee_id: "3", employee_name: "Inativo", team_name: "Manutenção", active: false },
  { order_id: "b", employee_id: "4", employee_name: "Caio", team_name: "Manutenção", active: true },
  { order_id: "c", employee_id: "5", employee_name: "Dora", team_name: "Logística", active: true },
];
describe("conciliação de refeições", () => {
  it("separa rascunhos, pendências e entregas sem contar inativos", () => {
    const r = makeMealReport(orders, people, { shift: "todos", status: "todos", team: "Todas" });
    expect(r.entries.map(e => e.quantity)).toEqual([2, 1, 1]);
    expect(r.requested).toBe(3);
    expect(r.delivered).toBe(2);
    expect(r.difference).toBe(0); // não subtrair o pedido ainda não entregue
    expect(r.pending).toBe(1);
    expect(r.drafts).toBe(1);
  });
  it("não atribui entrega global a equipe filtrada", () => {
    const r = makeMealReport(orders, people, { shift: "todos", status: "todos", team: "Manutenção" });
    expect(r.entries.map(e => e.quantity)).toEqual([1, 1]);
    expect(r.entries[0].groups[0].people.map(p => p.employee_name)).toEqual(["Ana"]);
    expect(r.requested).toBe(2);
    expect(r.delivered).toBeNull();
    expect(r.difference).toBeNull();
    expect(r.entries[0].delivered).toBeNull();
  });
  it("aplica turno/status e datas reais no Excel", () => {
    const r = makeMealReport(orders, people, { shift: "diurno", status: "entregue", team: "Todas" });
    expect(r.entries.map(e => e.order.id)).toEqual(["a"]);
    const date = mealExcelDate("2026-10-15");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 15]);
  });
});

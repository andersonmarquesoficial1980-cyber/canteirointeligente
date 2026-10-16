export type MealOrderRow = {
  id: string;
  meal_date: string;
  shift: string;
  supplier: string;
  status: "rascunho" | "fechado" | "entregue";
  delivered_quantity: number | null;
  delivery_note: string | null;
  closed_at: string | null;
  delivered_at: string | null;
};
export type MealPersonRow = {
  order_id: string;
  employee_id: string;
  employee_name: string;
  team_name: string;
  active: boolean;
};
export type MealReportEntry = {
  order: MealOrderRow;
  people: MealPersonRow[];
  groups: { team: string; people: MealPersonRow[] }[];
  quantity: number;
  requested: number;
  delivered: number | null;
  difference: number | null;
};
export type MealReportFilters = { shift: string; status: string; team: string };

export function makeMealReport(orders: MealOrderRow[], people: MealPersonRow[], filters: MealReportFilters) {
  const perOrder = new Map<string, MealPersonRow[]>();
  for (const p of people) {
    if (!p.active) continue;
    const list = perOrder.get(p.order_id) || [];
    list.push(p);
    perOrder.set(p.order_id, list);
  }
  const entries: MealReportEntry[] = [];
  for (const order of orders) {
    if (filters.shift !== "todos" && filters.shift !== order.shift) continue;
    if (filters.status !== "todos" && filters.status !== order.status) continue;
    const selected = (perOrder.get(order.id) || []).filter(p => filters.team === "Todas" || filters.team === p.team_name);
    if (filters.team !== "Todas" && selected.length === 0) continue;
    const teams = new Map<string, MealPersonRow[]>();
    for (const p of selected) teams.set(p.team_name, [...(teams.get(p.team_name) || []), p]);
    const groups = [...teams].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([team, members]) => ({ team, people: members.sort((a, b) => a.employee_name.localeCompare(b.employee_name, "pt-BR")) }));
    const requested = order.status === "rascunho" ? 0 : selected.length;
    // Uma entrega é registrada para o TURNO inteiro; jamais repartir entre equipes por estimativa.
    const delivered = filters.team === "Todas" && order.status === "entregue" ? order.delivered_quantity : null;
    const difference = delivered === null ? null : delivered - requested;
    entries.push({ order, people: selected, groups, quantity: selected.length, requested, delivered, difference });
  }
  const deliveredEntries = entries.filter(e => e.order.status === "entregue");
  return {
    entries,
    requested: entries.reduce((sum, e) => sum + e.requested, 0),
    delivered: filters.team === "Todas" ? deliveredEntries.reduce((sum, e) => sum + (e.delivered || 0), 0) : null,
    difference: filters.team === "Todas" ? deliveredEntries.reduce((sum, e) => sum + (e.difference || 0), 0) : null,
    pending: entries.filter(e => e.order.status === "fechado").reduce((sum, e) => sum + e.requested, 0),
    drafts: entries.filter(e => e.order.status === "rascunho").length,
    deliveredCount: deliveredEntries.length,
  };
}
export const brMealDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const mealExcelDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12);

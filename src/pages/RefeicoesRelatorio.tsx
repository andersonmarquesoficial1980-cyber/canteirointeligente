import { useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FileDown, FileText, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { brMealDate, makeMealReport, mealExcelDate, type MealOrderRow, type MealPersonRow } from "@/lib/mealReport";

const db = supabase as SupabaseClient;
const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
type ReportData = { orders: MealOrderRow[]; people: MealPersonRow[]; from: string; to: string };
const formatQuantity = (value: number | null) => value === null ? "—" : String(value);

export default function RefeicoesRelatorio({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => `${isoToday().slice(0, 7)}-01`);
  const [to, setTo] = useState(isoToday);
  const [shift, setShift] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [team, setTeam] = useState("Todas");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);
  const teams = useMemo(() => [...new Set((data?.people || []).filter(p => p.active).map(p => p.team_name))]
    .sort((a, b) => a.localeCompare(b, "pt-BR")), [data]);
  const report = useMemo(() => data ? makeMealReport(data.orders, data.people, { shift, status, team }) : null,
    [data, shift, status, team]);

  function changePeriod(setter: (value: string) => void, value: string) {
    requestId.current++;
    setLoading(false);
    setData(null);
    setTeam("Todas");
    setter(value);
  }
  async function search() {
    if (!from || !to || from > to) {
      toast({ title: "Informe um período válido", variant: "destructive" });
      return;
    }
    const request = ++requestId.current;
    setLoading(true);
    setData(null);
    setTeam("Todas");
    try {
      const orders: MealOrderRow[] = [];
      let expectedOrders: number | null = null;
      for (let offset = 0; ; offset += 500) {
        const { data: page, error, count } = await db.from("meal_orders")
          .select("id,meal_date,shift,supplier,status,delivered_quantity,delivery_note,closed_at,delivered_at", { count: "exact" })
          .eq("company_id", companyId).gte("meal_date", from).lte("meal_date", to)
          .order("meal_date").order("id").range(offset, offset + 499);
        if (error) throw error;
        if (count === null) throw new Error("Não foi possível conferir o total de pedidos.");
        expectedOrders = count;
        orders.push(...((page || []) as MealOrderRow[]));
        if (!page || page.length < 500) break;
      }
      if (orders.length !== expectedOrders) throw new Error("Consulta incompleta de pedidos. Tente novamente.");
      const people: MealPersonRow[] = [];
      for (let i = 0; i < orders.length; i += 50) {
        const ids = orders.slice(i, i + 50).map(o => o.id);
        let expectedPeople: number | null = null;
        let chunkCount = 0;
        for (let offset = 0; ; offset += 500) {
          const { data: page, error, count } = await db.from("meal_order_people")
            .select("order_id,employee_id,employee_name,team_name,active", { count: "exact" })
            .eq("company_id", companyId).in("order_id", ids).eq("active", true)
            .order("order_id").order("employee_id").range(offset, offset + 499);
          if (error) throw error;
          if (count === null) throw new Error("Não foi possível conferir o total de pessoas.");
          expectedPeople = count;
          chunkCount += page?.length || 0;
          people.push(...((page || []) as MealPersonRow[]));
          if (!page || page.length < 500) break;
        }
        if (chunkCount !== expectedPeople) throw new Error("Consulta incompleta de pessoas. Tente novamente.");
      }
      if (request === requestId.current) setData({ orders, people, from, to });
    } catch (error) {
      if (request === requestId.current) toast({ title: "Não foi possível gerar o relatório", description: String(error), variant: "destructive" });
    } finally { if (request === requestId.current) setLoading(false); }
  }

  async function exportExcel() {
    if (!data || !report) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.utils.book_new();
      const summary = XLSX.utils.aoa_to_sheet([
        ["WF REFEIÇÕES — CONFERÊNCIA", ""],
        ["Período", `${brMealDate(data.from)} a ${brMealDate(data.to)}`],
        ["Turno", shift], ["Status", status], ["Equipe", team],
        ["Solicitadas (pedidos fechados/entregues)", report.requested],
        ["Entregues (total do turno)", report.delivered ?? "Não atribuído por equipe"],
        ["Diferença de pedidos entregues", report.difference ?? "Não atribuído por equipe"],
        ["Solicitadas ainda sem entrega", report.pending], ["Pedidos em rascunho", report.drafts],
        ["Observação", "Rascunhos não integram o total solicitado. Entrega é por turno, não por equipe."],
      ]);
      summary["!cols"] = [{ wch: 42 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(book, summary, "Resumo");
      const orders = XLSX.utils.aoa_to_sheet([
        ["Data", "Turno", "Fornecedor", "Status", "Pessoas no pedido", "Solicitadas", "Entregues (turno)", "Diferença (turno)", "Justificativa", "Fechado em", "Entregue em"],
        ...report.entries.map(e => [mealExcelDate(e.order.meal_date), e.order.shift, e.order.supplier, e.order.status, e.quantity,
          e.requested, e.delivered, e.difference, e.order.delivery_note || "", e.order.closed_at || "", e.order.delivered_at || ""]),
      ], { cellDates: true, dateNF: "dd/mm/yyyy" });
      orders["!cols"] = [14, 12, 28, 14, 20, 16, 20, 20, 48, 27, 27].map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(book, orders, "Pedidos");
      const teamRows = XLSX.utils.aoa_to_sheet([
        ["Data", "Turno", "Equipe", "Status", "Pessoas", "Entregues por equipe"],
        ...report.entries.flatMap(e => e.groups.map(g => [mealExcelDate(e.order.meal_date), e.order.shift, g.team, e.order.status,
          g.people.length, "Não registrado por equipe"])),
      ], { cellDates: true, dateNF: "dd/mm/yyyy" });
      teamRows["!cols"] = [14, 12, 36, 14, 16, 30].map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(book, teamRows, "Equipes");
      const nominal = XLSX.utils.aoa_to_sheet([
        ["Data", "Turno", "Equipe no pedido", "Funcionário", "ID funcionário", "Status do pedido"],
        ...report.entries.flatMap(e => e.groups.flatMap(g => g.people.map(p => [mealExcelDate(e.order.meal_date),
          e.order.shift, g.team, p.employee_name, p.employee_id, e.order.status]))),
      ], { cellDates: true, dateNF: "dd/mm/yyyy" });
      nominal["!cols"] = [14, 12, 36, 40, 39, 18].map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(book, nominal, "Funcionários");
      XLSX.writeFile(book, `refeicoes-${data.from}-a-${data.to}.xlsx`, { cellDates: true });
    } catch (error) {
      toast({ title: "Falha ao exportar Excel", description: String(error), variant: "destructive" });
    } finally { setExporting(false); }
  }
  async function exportPdf() {
    if (!data || !report) return;
    setExporting(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("WF Refeições - conferência operacional", 14, 16);
      doc.setFontSize(10);
      doc.text(`Período: ${brMealDate(data.from)} a ${brMealDate(data.to)} | Turno: ${shift} | Status: ${status} | Equipe: ${team}`, 14, 24);
      doc.text(`Solicitadas: ${report.requested} | Entregues: ${formatQuantity(report.delivered)} | Diferença (entregues): ${formatQuantity(report.difference)} | Aguardando entrega: ${report.pending} | Rascunhos: ${report.drafts}`, 14, 31);
      autoTable(doc, {
        startY: 38,
        head: [["Data", "Turno", "Fornecedor", "Status", "Pessoas", "Solicitadas", "Entregues turno", "Diferença turno", "Justificativa"]],
        body: report.entries.map(e => [brMealDate(e.order.meal_date), e.order.shift, e.order.supplier, e.order.status,
          String(e.quantity), String(e.requested), formatQuantity(e.delivered), formatQuantity(e.difference), e.order.delivery_note || ""]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [36, 61, 85] },
      });
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Solicitações por equipe", 14, 16);
      doc.setFontSize(9);
      doc.text("A entrega é registrada apenas por turno. Não há rateio de entregues por equipe.", 14, 23);
      autoTable(doc, {
        startY: 29,
        head: [["Data", "Turno", "Equipe", "Status", "Pessoas no pedido"]],
        body: report.entries.flatMap(e => e.groups.map(g => [brMealDate(e.order.meal_date), e.order.shift, g.team, e.order.status, String(g.people.length)])),
        styles: { fontSize: 9 }, headStyles: { fillColor: [36, 61, 85] },
      });
      const nominalRows = report.entries.flatMap(e => e.groups.flatMap(g => g.people.map(p => [
        brMealDate(e.order.meal_date), e.order.shift, g.team, p.employee_name, e.order.status,
      ])));
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Relação nominal por equipe", 14, 16);
      doc.setFontSize(9);
      doc.text(`${nominalRows.length} pessoas selecionadas no período. Equipe conforme o pedido registrado.`, 14, 23);
      autoTable(doc, {
        startY: 29,
        head: [["Data", "Turno", "Equipe no pedido", "Funcionário", "Status do pedido"]],
        body: nominalRows,
        styles: { fontSize: 9 }, headStyles: { fillColor: [36, 61, 85] },
      });
      doc.save(`refeicoes-${data.from}-a-${data.to}.pdf`);
    } catch (error) {
      toast({ title: "Falha ao exportar PDF", description: String(error), variant: "destructive" });
    } finally { setExporting(false); }
  }

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>Conferência por período</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">O pedido nominal é agrupado pela equipe gravada no dia. A quantidade entregue é conferida somente no total do turno.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">De<Input aria-label="De" type="date" value={from} onChange={e => changePeriod(setFrom, e.target.value)} /></label>
        <label className="space-y-1 text-sm">Até<Input aria-label="Até" type="date" value={to} onChange={e => changePeriod(setTo, e.target.value)} /></label>
        <Button disabled={loading || !from || !to || from > to} onClick={() => void search()}><Search className="mr-2 h-4 w-4" />Buscar</Button>
      </div>
      {data && <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">Turno<select aria-label="Turno do relatório" className="block h-10 rounded-md border bg-background px-3" value={shift} onChange={e => setShift(e.target.value)}><option value="todos">Todos</option><option value="diurno">Diurno</option><option value="noturno">Noturno</option></select></label>
        <label className="space-y-1 text-sm">Status<select aria-label="Status do relatório" className="block h-10 rounded-md border bg-background px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos</option><option value="rascunho">Rascunho</option><option value="fechado">Fechado</option><option value="entregue">Entregue</option></select></label>
        <label className="space-y-1 text-sm">Equipe<select aria-label="Equipe do relatório" className="block h-10 max-w-xs rounded-md border bg-background px-3" value={team} onChange={e => setTeam(e.target.value)}><option>Todas</option>{teams.map(t => <option key={t}>{t}</option>)}</select></label>
      </div>}
    </CardContent></Card>
    {loading && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando todos os pedidos e funcionários do período...</p>}
    {data && report && <>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[["Solicitadas", report.requested], ["Entregues (turno)", formatQuantity(report.delivered)], ["Diferença (entregues)", formatQuantity(report.difference)], ["Aguardando entrega", report.pending], ["Pedidos em rascunho", report.drafts]].map(([label, value]) =>
          <Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{value}</strong></CardContent></Card>) }
      </div>
      <p className="text-sm text-muted-foreground">Período carregado: {brMealDate(data.from)} a {brMealDate(data.to)}. Rascunhos não contam como solicitadas; pedidos fechados sem entrega não entram na diferença. {team !== "Todas" && "Entrega por equipe não registrada: entregues e diferença ficam em branco."}</p>
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Pedidos ({report.entries.length})</CardTitle><div className="flex gap-2">
        <Button variant="outline" disabled={exporting || !report.entries.length} onClick={() => void exportExcel()}><FileDown className="mr-2 h-4 w-4" />Excel</Button>
        <Button variant="outline" disabled={exporting || !report.entries.length} onClick={() => void exportPdf()}><FileText className="mr-2 h-4 w-4" />PDF</Button>
      </div></div></CardHeader><CardContent className="space-y-3">
        {report.entries.length === 0 && <p className="text-sm">Nenhum pedido encontrado para os filtros selecionados.</p>}
        {report.entries.map(e => <details key={e.order.id} className="rounded border p-3 text-sm"><summary className="cursor-pointer font-medium">{brMealDate(e.order.meal_date)} · {e.order.shift} · {e.order.status} · {e.quantity} {e.order.status === "rascunho" ? "previstas" : "solicitadas"} · entregues (turno): {formatQuantity(e.delivered)} · diferença: {formatQuantity(e.difference)}</summary>
          <p className="my-2 text-muted-foreground">Fornecedor: {e.order.supplier}{e.order.delivery_note ? ` · Justificativa: ${e.order.delivery_note}` : ""}</p>
          {e.groups.map(g => <details key={g.team} className="ml-3 border-t py-2"><summary className="cursor-pointer">{g.team}: <strong>{g.people.length} pessoas</strong></summary><ul className="ml-5 list-disc">{g.people.map(p => <li key={p.employee_id}>{p.employee_name}</li>)}</ul></details>)}
        </details>)}
      </CardContent></Card>
    </>}
  </div>;
}

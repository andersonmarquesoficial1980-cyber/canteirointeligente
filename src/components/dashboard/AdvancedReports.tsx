import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileSpreadsheet, Loader2, Truck, Fuel, Download } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function AdvancedReports() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [loadingTransport, setLoadingTransport] = useState(false);
  const [loadingRefuel, setLoadingRefuel] = useState(false);
  const [loadingConsolidado, setLoadingConsolidado] = useState(false);

  const getRange = () => {
    if (!dateFrom || !dateTo) return null;
    return {
      from: format(startOfDay(dateFrom), "yyyy-MM-dd"),
      to: format(endOfDay(dateTo), "yyyy-MM-dd"),
    };
  };

  const fmtDate = (d: string) => {
    if (!d) return "—";
    try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
  };

  const fmtOgs = (raw: string | null) => {
    if (!raw) return "—";
    if (raw === "BASE / PÁTIO CENTRAL") return raw;
    return raw;
  };

  /* ── Exportar Transportes (Carreta) ── */
  const exportTransportes = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingTransport(true);
    try {
      const { data, error } = await supabase
        .from("equipment_time_entries")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, attachment_type, odometer_initial, odometer_final)")
        .gte("equipment_diaries.date", range.from)
        .lte("equipment_diaries.date", range.to);

      if (error) throw error;

      const rows = (data || [])
        .filter((r: any) => r.equipment_diaries?.equipment_type === "Carreta")
        .map((r: any) => {
          const d = r.equipment_diaries;
          const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
          const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
          const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;

          // Parse equipment from description (stored as comma-separated)
          const descParts = (r.description || "").split(",").map((s: string) => s.trim());

          return {
            "Data": fmtDate(d?.date),
            "Prefixo": d?.equipment_fleet || "—",
            "KM Inicial": kmIni != null ? kmIni : "—",
            "KM Final": kmFin != null ? kmFin : "—",
            "KM Percorrido": kmRodado != null ? kmRodado : "—",
            "Equipamento 01": descParts[0] || "—",
            "Equipamento 02": descParts[1] || "—",
            "Equipamento 03": descParts[2] || "—",
            "Origem": fmtOgs(r.origin),
            "Destino": fmtOgs(r.destination),
            "Horário Início": r.start_time || "—",
            "Horário Fim": r.end_time || "—",
            "Observações / Finalidade": r.ogs_destination || r.activity || "—",
          };
        });

      if (rows.length === 0) {
        toast.info("Nenhum transporte de Carreta encontrado no período.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 36 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 36 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transportes Carreta");
      XLSX.writeFile(wb, `Relatorio_Transporte_Periodo_Fremix.xlsx`);
      toast.success(`${rows.length} registros exportados!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingTransport(false);
    }
  };

  /* ── Exportar Abastecimentos (Comboio) ── */
  const exportAbastecimentos = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingRefuel(true);
    try {
      const { data, error } = await supabase
        .from("comboio_equipment_refueling")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, odometer_initial, odometer_final)")
        .gte("equipment_diaries.date", range.from)
        .lte("equipment_diaries.date", range.to);

      if (error) throw error;

      const rows = (data || []).map((r: any) => {
        const d = r.equipment_diaries;
        const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
        const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
        const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
        const services: string[] = [];
        if (r.is_lubricated) services.push("Lubrificação");
        if (r.is_washed) services.push("Lavagem");
        return {
          "Data": fmtDate(d?.date),
          "Prefixo Comboio": d?.equipment_fleet || "—",
          "KM Inicial": kmIni != null ? kmIni : "—",
          "KM Final": kmFin != null ? kmFin : "—",
          "KM Percorrido": kmRodado != null ? kmRodado : "—",
          "Equipamento Abastecido": r.equipment_fleet_fueled || "—",
          "Litros": r.liters_fueled ?? "—",
          "Medição (H/KM)": r.equipment_meter ?? "—",
          "OGS / Local": fmtOgs(r.ogs_destination),
          "Serviços Adicionais": services.length > 0 ? services.join(", ") : "—",
        };
      });

      if (rows.length === 0) {
        toast.info("Nenhum abastecimento de Comboio encontrado no período.");
        return;
      }

      const byEquip: Record<string, number> = {};
      const byOgs: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const eq = r.equipment_fleet_fueled || "—";
        const ogs = r.ogs_destination || "—";
        const liters = Number(r.liters_fueled) || 0;
        byEquip[eq] = (byEquip[eq] || 0) + liters;
        if (ogs !== "—") byOgs[ogs] = (byOgs[ogs] || 0) + liters;
      });

      const summaryEquip = Object.entries(byEquip).sort((a, b) => b[1] - a[1]).map(([eq, l]) => ({ "Equipamento": eq, "Total Litros": l }));
      const summaryOgs = Object.entries(byOgs).sort((a, b) => b[1] - a[1]).map(([ogs, l]) => ({ "OGS / Local": ogs, "Total Litros": l }));

      const wb = XLSX.utils.book_new();
      const wsData = XLSX.utils.json_to_sheet(rows);
      wsData["!cols"] = [
        { wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 36 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsData, "Abastecimentos");

      const wsEquip = XLSX.utils.json_to_sheet(summaryEquip);
      wsEquip["!cols"] = [{ wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsEquip, "Resumo por Equipamento");

      const wsOgs = XLSX.utils.json_to_sheet(summaryOgs);
      wsOgs["!cols"] = [{ wch: 36 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsOgs, "Resumo por OGS");

      XLSX.writeFile(wb, `Relatorio_Abastecimento_Periodo_Fremix.xlsx`);
      toast.success(`${rows.length} registros exportados em 3 abas!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingRefuel(false);
    }
  };

  /* ── Exportar Consolidado ── */
  const exportConsolidado = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingConsolidado(true);
    try {
      const [transportRes, refuelRes] = await Promise.all([
        supabase
          .from("equipment_time_entries")
          .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, attachment_type, odometer_initial, odometer_final)")
          .gte("equipment_diaries.date", range.from)
          .lte("equipment_diaries.date", range.to),
        supabase
          .from("comboio_equipment_refueling")
          .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, odometer_initial, odometer_final)")
          .gte("equipment_diaries.date", range.from)
          .lte("equipment_diaries.date", range.to),
      ]);

      if (transportRes.error) throw transportRes.error;
      if (refuelRes.error) throw refuelRes.error;

      const allRows: any[] = [];

      (transportRes.data || [])
        .filter((r: any) => r.equipment_diaries?.equipment_type === "Carreta")
        .forEach((r: any) => {
          const d = r.equipment_diaries;
          const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
          const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
          const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
          const descParts = (r.description || "").split(",").map((s: string) => s.trim());

          allRows.push({
            "Tipo": "Carreta",
            "Data": fmtDate(d?.date),
            "Prefixo": d?.equipment_fleet || "—",
            "KM Inicial": kmIni ?? "—",
            "KM Final": kmFin ?? "—",
            "KM Percorrido": kmRodado ?? "—",
            "Equipamento 01": descParts[0] || "—",
            "Equipamento 02": descParts[1] || "—",
            "Equipamento 03": descParts[2] || "—",
            "Origem": fmtOgs(r.origin),
            "Destino": fmtOgs(r.destination),
            "Horário Início": r.start_time || "—",
            "Horário Fim": r.end_time || "—",
            "Observações": r.ogs_destination || r.activity || "—",
          });
        });

      (refuelRes.data || []).forEach((r: any) => {
        const d = r.equipment_diaries;
        const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
        const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
        const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
        const services: string[] = [];
        if (r.is_lubricated) services.push("Lubrificação");
        if (r.is_washed) services.push("Lavagem");
        allRows.push({
          "Tipo": "Comboio",
          "Data": fmtDate(d?.date),
          "Prefixo": d?.equipment_fleet || "—",
          "KM Inicial": kmIni ?? "—",
          "KM Final": kmFin ?? "—",
          "KM Percorrido": kmRodado ?? "—",
          "Equipamento 01": r.equipment_fleet_fueled || "—",
          "Equipamento 02": "—",
          "Equipamento 03": "—",
          "Origem": "Comboio",
          "Destino": fmtOgs(r.ogs_destination),
          "Horário Início": `${r.liters_fueled ?? 0} L`,
          "Horário Fim": `Med: ${r.equipment_meter ?? "—"}`,
          "Observações": services.length > 0 ? services.join(", ") : "Abastecimento",
        });
      });

      allRows.sort((a, b) => (a["Data"] || "").localeCompare(b["Data"] || ""));

      if (allRows.length === 0) {
        toast.info("Nenhum registro encontrado no período.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(allRows);
      ws["!cols"] = [
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 36 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 36 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
      XLSX.writeFile(wb, `Relatorio_Transporte_Periodo_Fremix.xlsx`);
      toast.success(`${allRows.length} registros consolidados e exportados!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingConsolidado(false);
    }
  };

  const hasRange = dateFrom && dateTo;

  return (
    <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl">
      <CardContent className="p-5 space-y-5">
        <h2 className="text-sm font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Relatórios Avançados (Excel)
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">Data Inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm font-medium", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">Data Final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm font-medium", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {hasRange && (
            <span className="text-xs text-muted-foreground font-medium pb-2">
              {format(dateFrom!, "dd/MM")} — {format(dateTo!, "dd/MM/yyyy")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button onClick={exportTransportes} disabled={!hasRange || loadingTransport} className="gap-2 font-extrabold py-5 rounded-xl bg-[hsl(215_80%_35%)] hover:bg-[hsl(215_80%_28%)] text-white shadow-md">
            {loadingTransport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Transportes (Carreta)
          </Button>
          <Button onClick={exportAbastecimentos} disabled={!hasRange || loadingRefuel} className="gap-2 font-extrabold py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
            {loadingRefuel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fuel className="w-4 h-4" />}
            Abastecimentos (Comboio)
          </Button>
          <Button onClick={exportConsolidado} disabled={!hasRange || loadingConsolidado} className="gap-2 font-extrabold py-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md">
            {loadingConsolidado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Consolidado (Ambos)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

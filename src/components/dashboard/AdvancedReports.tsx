import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileSpreadsheet, Loader2, Truck, Fuel } from "lucide-react";
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

  const getRange = () => {
    if (!dateFrom || !dateTo) return null;
    return {
      from: format(startOfDay(dateFrom), "yyyy-MM-dd"),
      to: format(endOfDay(dateTo), "yyyy-MM-dd"),
    };
  };

  const exportTransportes = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingTransport(true);
    try {
      const { data, error } = await supabase
        .from("equipment_time_entries")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, attachment_type)")
        .gte("equipment_diaries.date", range.from)
        .lte("equipment_diaries.date", range.to);

      if (error) throw error;

      // Filter only carreta transport entries
      const rows = (data || [])
        .filter((r: any) => r.equipment_diaries?.equipment_type === "Carreta")
        .map((r: any, i: number) => {
          const d = r.equipment_diaries;
          const equips: string[] = [];
          if (r.description) {
            const equipMatch = r.description.match(/^([^|]+)/);
            if (equipMatch) equips.push(equipMatch[1].trim());
          }
          return {
            "#": i + 1,
            "Data": d?.date ? format(new Date(d.date + "T12:00:00"), "dd/MM/yyyy") : "—",
            "Cavalo Mecânico": d?.equipment_fleet || "—",
            "Prancha": d?.attachment_type || "—",
            "Atividade": r.activity || "—",
            "Início": r.start_time || "—",
            "Fim": r.end_time || "—",
            "Origem": r.origin || "—",
            "Destino": r.destination || "—",
            "Equipamento Transportado": equips.join(", ") || r.description || "—",
          };
        });

      if (rows.length === 0) {
        toast.info("Nenhum transporte de Carreta encontrado no período.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 4 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
        { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 28 },
        { wch: 28 }, { wch: 32 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transportes Carreta");
      XLSX.writeFile(wb, `Transportes_Carreta_${range.from}_${range.to}.xlsx`);
      toast.success(`${rows.length} registros exportados!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingTransport(false);
    }
  };

  const exportAbastecimentos = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingRefuel(true);
    try {
      const { data, error } = await supabase
        .from("comboio_equipment_refueling")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type)")
        .gte("equipment_diaries.date", range.from)
        .lte("equipment_diaries.date", range.to);

      if (error) throw error;

      const rows = (data || []).map((r: any, i: number) => {
        const d = r.equipment_diaries;
        return {
          "#": i + 1,
          "Data": d?.date ? format(new Date(d.date + "T12:00:00"), "dd/MM/yyyy") : "—",
          "Comboio": d?.equipment_fleet || "—",
          "Equipamento Abastecido": r.equipment_fleet_fueled || "—",
          "Litros": r.liters_fueled ?? 0,
          "Medição (H/Km)": r.equipment_meter ?? "—",
          "OGS / Local": r.ogs_destination || "—",
          "Lubrificação": r.is_lubricated ? "Sim" : "Não",
          "Lavagem": r.is_washed ? "Sim" : "Não",
          "Saldo Inicial (L)": r.initial_diesel_balance ?? "—",
        };
      });

      if (rows.length === 0) {
        toast.info("Nenhum abastecimento de Comboio encontrado no período.");
        return;
      }

      // Summary sheet
      const byEquip: Record<string, number> = {};
      const byOgs: Record<string, number> = {};
      rows.forEach((r: any) => {
        const eq = r["Equipamento Abastecido"];
        const ogs = r["OGS / Local"];
        const liters = Number(r["Litros"]) || 0;
        byEquip[eq] = (byEquip[eq] || 0) + liters;
        if (ogs && ogs !== "—") byOgs[ogs] = (byOgs[ogs] || 0) + liters;
      });

      const summaryEquip = Object.entries(byEquip)
        .sort((a, b) => b[1] - a[1])
        .map(([eq, l]) => ({ "Equipamento": eq, "Total Litros": l }));

      const summaryOgs = Object.entries(byOgs)
        .sort((a, b) => b[1] - a[1])
        .map(([ogs, l]) => ({ "OGS / Local": ogs, "Total Litros": l }));

      const wb = XLSX.utils.book_new();

      const wsData = XLSX.utils.json_to_sheet(rows);
      wsData["!cols"] = [
        { wch: 4 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
        { wch: 10 }, { wch: 14 }, { wch: 32 }, { wch: 12 },
        { wch: 10 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsData, "Abastecimentos");

      const wsEquip = XLSX.utils.json_to_sheet(summaryEquip);
      wsEquip["!cols"] = [{ wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsEquip, "Resumo por Equipamento");

      const wsOgs = XLSX.utils.json_to_sheet(summaryOgs);
      wsOgs["!cols"] = [{ wch: 36 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsOgs, "Resumo por OGS");

      XLSX.writeFile(wb, `Abastecimentos_Comboio_${range.from}_${range.to}.xlsx`);
      toast.success(`${rows.length} registros exportados em 3 abas!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingRefuel(false);
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

        {/* Date Range Picker */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">
              Data Inicial
            </label>
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
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">
              Data Final
            </label>
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

        {/* Export Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={exportTransportes}
            disabled={!hasRange || loadingTransport}
            className="gap-2 font-extrabold py-5 rounded-xl bg-[hsl(215_80%_35%)] hover:bg-[hsl(215_80%_28%)] text-white shadow-md"
          >
            {loadingTransport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Exportar Transportes (Carreta)
          </Button>
          <Button
            onClick={exportAbastecimentos}
            disabled={!hasRange || loadingRefuel}
            className="gap-2 font-extrabold py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
          >
            {loadingRefuel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fuel className="w-4 h-4" />}
            Exportar Abastecimentos (Comboio)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

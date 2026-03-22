import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileSpreadsheet, FileText, Share2, CalendarIcon, Loader2 } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type DatePreset = "hoje" | "ontem" | "7dias" | "custom";

interface FleetCount {
  em_obra: number;
  transporte: number;
  disponivel: number;
  manutencao: number;
}

interface ExportModuleProps {
  counts: FleetCount;
  total: number;
  availability: number;
}

export default function ExportModule({ counts, total, availability }: ExportModuleProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("hoje");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const getDateRange = (): { from: string; to: string } => {
    const now = new Date();
    let from: Date, to: Date;
    switch (preset) {
      case "ontem":
        from = startOfDay(subDays(now, 1));
        to = endOfDay(subDays(now, 1));
        break;
      case "7dias":
        from = startOfDay(subDays(now, 6));
        to = endOfDay(now);
        break;
      case "custom":
        from = customFrom ? startOfDay(customFrom) : startOfDay(now);
        to = customTo ? endOfDay(customTo) : endOfDay(now);
        break;
      default:
        from = startOfDay(now);
        to = endOfDay(now);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  };

  const fetchData = async () => {
    const { from, to } = getDateRange();

    const [timeRes, fuelRes] = await Promise.all([
      supabase
        .from("equipment_time_entries")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, operator_name, ogs_number)")
        .gte("equipment_diaries.date", from.split("T")[0])
        .lte("equipment_diaries.date", to.split("T")[0]),
      supabase
        .from("comboio_equipment_refueling")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type)")
        .gte("equipment_diaries.date", from.split("T")[0])
        .lte("equipment_diaries.date", to.split("T")[0]),
    ]);

    return {
      timeEntries: (timeRes.data || []) as any[],
      fuelEntries: (fuelRes.data || []) as any[],
    };
  };

  const periodLabel = () => {
    const { from, to } = getDateRange();
    const f = format(new Date(from), "dd/MM/yyyy");
    const t = format(new Date(to), "dd/MM/yyyy");
    return f === t ? f : `${f} — ${t}`;
  };

  // ── PDF ──────────────────────────────────────────────────
  const generatePDF = async () => {
    setLoading(true);
    try {
      const { timeEntries, fuelEntries } = await fetchData();
      const doc = new jsPDF({ orientation: "landscape" });

      // Header
      doc.setFillColor(15, 35, 75);
      doc.rect(0, 0, 297, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("FREMIX — Painel de Controle", 14, 14);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${periodLabel()}`, 14, 22);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 200, 22);

      // Fleet summary
      doc.setTextColor(15, 35, 75);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo da Frota", 14, 38);

      autoTable(doc, {
        startY: 42,
        head: [["Status", "Quantidade", "% do Total"]],
        body: [
          ["🟢 Produzindo", String(counts.em_obra), `${total ? Math.round((counts.em_obra / total) * 100) : 0}%`],
          ["🟡 Em Trânsito", String(counts.transporte), `${total ? Math.round((counts.transporte / total) * 100) : 0}%`],
          ["🔵 Disponível (Base)", String(counts.disponivel), `${total ? Math.round((counts.disponivel / total) * 100) : 0}%`],
          ["🔴 Manutenção", String(counts.manutencao), `${total ? Math.round((counts.manutencao / total) * 100) : 0}%`],
          ["TOTAL", String(total), "100%"],
        ],
        theme: "grid",
        headStyles: { fillColor: [15, 35, 75], fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 60 }, 1: { halign: "center" }, 2: { halign: "center" } },
      });

      doc.setFontSize(11);
      doc.text(`Taxa de Disponibilidade: ${availability}%`, 14, (doc as any).lastAutoTable.finalY + 10);

      // Time entries table
      if (timeEntries.length > 0) {
        const y = (doc as any).lastAutoTable.finalY + 20;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Apontamentos de Horas", 14, y);

        autoTable(doc, {
          startY: y + 4,
          head: [["Frota", "Atividade", "Início", "Fim", "Origem", "Destino", "OGS"]],
          body: timeEntries.map((e: any) => [
            e.equipment_diaries?.equipment_fleet || "-",
            e.activity || "-",
            e.start_time || "-",
            e.end_time || "-",
            e.origin || "-",
            e.destination || "-",
            e.equipment_diaries?.ogs_number || "-",
          ]),
          theme: "striped",
          headStyles: { fillColor: [15, 35, 75], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
        });
      }

      // Fuel entries
      if (fuelEntries.length > 0) {
        const y2 = (doc as any).lastAutoTable.finalY + 14;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Abastecimentos", 14, y2);

        autoTable(doc, {
          startY: y2 + 4,
          head: [["Frota Abastecida", "Litros", "Horímetro/KM", "Lubrificado", "Lavado"]],
          body: fuelEntries.map((e: any) => [
            e.equipment_fleet_fueled || "-",
            e.liters_fueled ?? "-",
            e.equipment_meter ?? "-",
            e.is_lubricated ? "Sim" : "Não",
            e.is_washed ? "Sim" : "Não",
          ]),
          theme: "striped",
          headStyles: { fillColor: [15, 35, 75], fontSize: 8 },
          styles: { fontSize: 7 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`FREMIX — Gerado automaticamente pelo PavLog | Página ${i}/${pageCount}`, 14, 200);
      }

      doc.save(`Fremix_Relatorio_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  // ── Excel ────────────────────────────────────────────────
  const generateExcel = async () => {
    setLoading(true);
    try {
      const { timeEntries, fuelEntries } = await fetchData();
      const wb = XLSX.utils.book_new();

      // Time entries sheet
      const timeRows = timeEntries.map((e: any) => ({
        Data: e.equipment_diaries?.date || "",
        Frota: e.equipment_diaries?.equipment_fleet || "",
        Tipo: e.equipment_diaries?.equipment_type || "",
        Operador: e.equipment_diaries?.operator_name || "",
        Atividade: e.activity || "",
        Início: e.start_time || "",
        Fim: e.end_time || "",
        Origem: e.origin || "",
        Destino: e.destination || "",
        Observação: e.description || "",
        OGS: e.equipment_diaries?.ogs_number || "",
      }));
      const ws1 = XLSX.utils.json_to_sheet(timeRows.length ? timeRows : [{ Info: "Sem registros no período" }]);
      ws1["!cols"] = Array(11).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws1, "Apontamentos");

      // Fuel entries sheet
      const fuelRows = fuelEntries.map((e: any) => ({
        Data: e.equipment_diaries?.date || "",
        "Frota Comboio": e.equipment_diaries?.equipment_fleet || "",
        "Frota Abastecida": e.equipment_fleet_fueled || "",
        Litros: e.liters_fueled ?? "",
        "Horímetro/KM": e.equipment_meter ?? "",
        Lubrificado: e.is_lubricated ? "Sim" : "Não",
        Lavado: e.is_washed ? "Sim" : "Não",
        OGS: e.ogs_destination || "",
      }));
      const ws2 = XLSX.utils.json_to_sheet(fuelRows.length ? fuelRows : [{ Info: "Sem registros no período" }]);
      ws2["!cols"] = Array(8).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws2, "Abastecimentos");

      // Fleet summary sheet
      const summaryRows = [
        { Status: "Produzindo", Quantidade: counts.em_obra },
        { Status: "Em Trânsito", Quantidade: counts.transporte },
        { Status: "Disponível (Base)", Quantidade: counts.disponivel },
        { Status: "Manutenção", Quantidade: counts.manutencao },
        { Status: "TOTAL", Quantidade: total },
        { Status: "Taxa de Disponibilidade", Quantidade: `${availability}%` },
      ];
      const ws3 = XLSX.utils.json_to_sheet(summaryRows);
      ws3["!cols"] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Resumo Frota");

      XLSX.writeFile(wb, `Fremix_Dados_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
      toast.success("Excel gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar Excel");
    } finally {
      setLoading(false);
    }
  };

  // ── WhatsApp ─────────────────────────────────────────────
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `📊 *FREMIX — Painel de Controle*\n` +
      `📅 ${periodLabel()}\n\n` +
      `🟢 Produzindo: ${counts.em_obra}\n` +
      `🟡 Em Trânsito: ${counts.transporte}\n` +
      `🔵 Disponível: ${counts.disponivel}\n` +
      `🔴 Manutenção: ${counts.manutencao}\n\n` +
      `📈 Disponibilidade: ${availability}%\n` +
      `🔧 Total: ${total} equipamentos`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-[hsl(215_80%_22%)] hover:bg-[hsl(215_80%_30%)] text-white font-bold rounded-xl shadow-md"
      >
        <Download className="w-4 h-4" />
        Exportar Relatório
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[hsl(215_80%_22%)] font-extrabold text-lg">
              Exportar Relatório
            </DialogTitle>
            <DialogDescription>Escolha o período e o formato de exportação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Date filter */}
            <div>
              <label className="text-xs font-bold text-[hsl(215_80%_22%)] mb-1.5 block">
                Período
              </label>
              <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl", !customFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customFrom ? format(customFrom, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl", !customTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customTo ? format(customTo, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={generatePDF}
                disabled={loading}
                className="w-full gap-2 rounded-xl bg-[hsl(0_70%_50%)] hover:bg-[hsl(0_70%_40%)] text-white font-bold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Gerar PDF (Visual)
              </Button>

              <Button
                onClick={generateExcel}
                disabled={loading}
                className="w-full gap-2 rounded-xl bg-[hsl(142_70%_35%)] hover:bg-[hsl(142_70%_28%)] text-white font-bold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Baixar Excel (Dados)
              </Button>

              {isMobile && (
                <Button
                  onClick={shareWhatsApp}
                  variant="outline"
                  className="w-full gap-2 rounded-xl border-[hsl(142_70%_35%)] text-[hsl(142_70%_35%)] font-bold"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar via WhatsApp
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

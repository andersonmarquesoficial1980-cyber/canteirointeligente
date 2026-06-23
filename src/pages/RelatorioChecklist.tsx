import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistReport {
  diaryId: string;
  frota: string;
  tipoEquip: string;
  operador: string;
  data: string;
  submittedAt: string;
  totalItems: number;
  okCount: number;
  naoOkCount: number;
  naCount: number;
  entries: {
    itemName: string;
    status: "ok" | "nao_ok" | "na";
    observation: string | null;
    photoUrl: string | null;
  }[];
}

export default function RelatorioChecklist() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ChecklistReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChecklistReport | null>(null);
  const [dataIni, setDataIni] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [dataFim, setDataFim] = useState(new Date().toISOString().split("T")[0]);
  const [searchFrota, setSearchFrota] = useState("");

  const buscarRelatorios = async () => {
    setLoading(true);
    try {
      // Buscar diários que tiveram checklist enviado no período
      const { data: diaries, error } = await (supabase as any)
        .from("equipment_diaries")
        .select("id, frota, equipment_type, operator_name, date, checklist_submitted_at")
        .gte("date", dataIni)
        .lte("date", dataFim)
        .not("checklist_submitted_at", "is", null)
        .order("checklist_submitted_at", { ascending: false });

      if (error || !diaries || diaries.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const diaryIds = diaries.map((d: any) => d.id);

      // Buscar todas as entries + items numa query
      const { data: entries } = await supabase
        .from("checklist_entries")
        .select("diary_id, status, observation, photo_url, item_id")
        .in("diary_id", diaryIds);

      // Buscar nomes dos itens
      const itemIds = [...new Set((entries || []).map((e: any) => e.item_id))];
      const { data: itemsData } = await supabase
        .from("checklist_items_standard")
        .select("id, item_name")
        .in("id", itemIds);

      const itemMap: Record<string, string> = {};
      (itemsData || []).forEach((i: any) => { itemMap[i.id] = i.item_name; });

      const reportList: ChecklistReport[] = diaries.map((d: any) => {
        const diaryEntries = (entries || []).filter((e: any) => e.diary_id === d.id);
        const ok = diaryEntries.filter((e: any) => e.status === "ok").length;
        const naoOk = diaryEntries.filter((e: any) => e.status === "nao_ok").length;
        const na = diaryEntries.filter((e: any) => e.status === "na").length;

        return {
          diaryId: d.id,
          frota: d.frota || "",
          tipoEquip: d.equipment_type || "",
          operador: d.operator_name || "—",
          data: d.date,
          submittedAt: d.checklist_submitted_at,
          totalItems: diaryEntries.length,
          okCount: ok,
          naoOkCount: naoOk,
          naCount: na,
          entries: diaryEntries.map((e: any) => ({
            itemName: itemMap[e.item_id] || e.item_id,
            status: e.status,
            observation: e.observation,
            photoUrl: e.photo_url,
          })),
        };
      });

      setReports(reportList);
    } catch (err) {
      console.error("[RelatorioChecklist]", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    buscarRelatorios();
  }, []);

  const reportsFiltrados = reports.filter(r =>
    !searchFrota || r.frota.toLowerCase().includes(searchFrota.toLowerCase())
  );

  const handleDownloadPDF = async (report: ChecklistReport) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CHECKLIST PRÉ-OPERAÇÃO", pageW / 2, 11, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Frota: ${report.frota}  |  Data: ${fmtDate(report.data)}  |  Operador: ${report.operador}`, pageW / 2, 19, { align: "center" });
    doc.text(`Enviado em: ${new Date(report.submittedAt).toLocaleString("pt-BR")}`, pageW / 2, 24, { align: "center" });

    // Resumo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO", 14, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Total de itens: ${report.totalItems}`, 14, 43);
    doc.setTextColor(34, 197, 94);
    doc.text(`Conformes: ${report.okCount}`, 60, 43);
    doc.setTextColor(239, 68, 68);
    doc.text(`Não conformes: ${report.naoOkCount}`, 100, 43);
    doc.setTextColor(100, 116, 139);
    doc.text(`N/A: ${report.naCount}`, 155, 43);
    doc.setTextColor(0, 0, 0);

    // Tabela de itens
    const tableRows = report.entries.map(e => [
      e.itemName,
      e.status === "ok" ? "CONFORME" : e.status === "nao_ok" ? "NÃO CONFORME" : "N/A",
      e.observation || "—",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["Item de Verificação", "Status", "Observação"]],
      body: tableRows,
      headStyles: { fillColor: [30, 64, 175], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 35 }, 2: { cellWidth: 75 } },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 1) {
          if (data.cell.text[0] === "NÃO CONFORME") data.cell.styles.textColor = [239, 68, 68];
          if (data.cell.text[0] === "CONFORME") data.cell.styles.textColor = [34, 197, 94];
        }
      },
    });

    // Fotos das não conformidades
    const naoOks = report.entries.filter(e => e.status === "nao_ok" && e.photoUrl);
    if (naoOks.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("REGISTROS FOTOGRÁFICOS — NÃO CONFORMIDADES", 14, 16);
      let yPos = 25;
      for (const entry of naoOks) {
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`• ${entry.itemName}`, 14, yPos);
        if (entry.observation) {
          doc.setFont("helvetica", "normal");
          doc.text(`  ${entry.observation}`, 14, yPos + 5);
        }
        if (entry.photoUrl) {
          try {
            const resp = await fetch(entry.photoUrl);
            const blob = await resp.blob();
            const base64 = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.readAsDataURL(blob);
            });
            doc.addImage(base64, "JPEG", 14, yPos + 10, 80, 60);
            yPos += 80;
          } catch {
            yPos += 15;
          }
        } else {
          yPos += 15;
        }
      }
    }

    // Rodapé
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Workflux — ${new Date().toLocaleDateString("pt-BR")} — Pág. ${i}/${totalPages}`, pageW / 2, 290, { align: "center" });
    }

    doc.save(`checklist_${report.frota}_${report.data}.pdf`);
  };

  function fmtDate(d: string) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={() => selectedReport ? setSelectedReport(null) : navigate("/relatorios")}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            Checklist Pré-Operação
          </span>
          <span className="block text-[11px] text-primary-foreground/80">
            {selectedReport ? `${selectedReport.frota} — ${fmtDate(selectedReport.data)}` : "Histórico de checklists enviados"}
          </span>
        </div>
        {selectedReport && (
          <Button
            size="sm"
            variant="secondary"
            className="text-xs gap-1.5 font-bold"
            onClick={() => handleDownloadPDF(selectedReport)}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </Button>
        )}
      </header>

      {/* Detalhe do checklist selecionado */}
      {selectedReport ? (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Resumo */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div><span className="text-muted-foreground text-xs">Frota</span><p className="font-bold">{selectedReport.frota}</p></div>
              <div><span className="text-muted-foreground text-xs">Data</span><p className="font-bold">{fmtDate(selectedReport.data)}</p></div>
              <div><span className="text-muted-foreground text-xs">Operador</span><p className="font-bold">{selectedReport.operador}</p></div>
              <div><span className="text-muted-foreground text-xs">Enviado às</span><p className="font-bold">{new Date(selectedReport.submittedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div>
            </div>
            <div className="flex gap-3 pt-3 border-t border-border">
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-emerald-500">{selectedReport.okCount}</p>
                <p className="text-[10px] text-muted-foreground">Conformes</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-rose-500">{selectedReport.naoOkCount}</p>
                <p className="text-[10px] text-muted-foreground">Não conformes</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-slate-400">{selectedReport.naCount}</p>
                <p className="text-[10px] text-muted-foreground">N/A</p>
              </div>
            </div>
          </div>

          {/* Lista de itens */}
          <div className="space-y-2">
            {selectedReport.entries.map((entry, idx) => (
              <div key={idx} className={`bg-card border rounded-xl p-3 shadow-card ${entry.status === "nao_ok" ? "border-rose-300" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold flex-1">{entry.itemName}</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    entry.status === "ok" ? "bg-emerald-100 text-emerald-700" :
                    entry.status === "nao_ok" ? "bg-rose-100 text-rose-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {entry.status === "ok" ? "CONFORME" : entry.status === "nao_ok" ? "NÃO CONFORME" : "N/A"}
                  </span>
                </div>
                {entry.status === "nao_ok" && (
                  <div className="mt-2 pl-2 border-l-2 border-rose-400 space-y-2">
                    {entry.observation && (
                      <p className="text-xs text-muted-foreground italic">{entry.observation}</p>
                    )}
                    {entry.photoUrl && (
                      <img
                        src={entry.photoUrl}
                        alt="Foto da avaria"
                        className="w-32 h-32 object-cover rounded-xl border border-border cursor-pointer hover:opacity-80"
                        onClick={() => window.open(entry.photoUrl!, "_blank")}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Lista de checklists enviados */
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Filtros */}
          <div className="bg-card border border-border rounded-2xl p-3 shadow-card space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">De</label>
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">Até</label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 rounded-xl text-sm" />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchFrota}
                onChange={e => setSearchFrota(e.target.value)}
                placeholder="Filtrar por frota..."
                className="pl-9 h-9 rounded-xl text-sm"
              />
            </div>
            <Button onClick={buscarRelatorios} disabled={loading} className="w-full h-9 rounded-xl font-bold text-sm gap-2">
              <Filter className="w-4 h-4" />
              {loading ? "Buscando..." : "Buscar Checklists"}
            </Button>
          </div>

          {/* Resultados */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : reportsFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Nenhum checklist enviado no período</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">{reportsFiltrados.length} checklist{reportsFiltrados.length > 1 ? "s" : ""} encontrado{reportsFiltrados.length > 1 ? "s" : ""}</p>
              {reportsFiltrados.map(report => (
                <button
                  key={report.diaryId}
                  onClick={() => setSelectedReport(report)}
                  className="w-full text-left bg-card border border-border rounded-2xl p-3.5 shadow-card hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold font-display">{report.frota}</span>
                      <span className="text-xs text-muted-foreground">{report.tipoEquip}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(report.data)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">👷 {report.operador}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">{report.okCount}C</span>
                      {report.naoOkCount > 0 && (
                        <span className="text-rose-600 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {report.naoOkCount}NC
                        </span>
                      )}
                      <span className="text-slate-500">{report.naCount}NA</span>
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Enviado às {new Date(report.submittedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

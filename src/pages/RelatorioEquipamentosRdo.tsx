import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatDateISO(d: string): string {
  /* Convert DD/MM/YYYY to YYYY-MM-DD for display in dialogs */
  if (!d) return "";
  const parts = d.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return d;
}

interface ResultRow {
  data: string;
  obra_nome: string;
  frota: string;
  categoria: string | null;
  tipo: string | null;
  nome: string | null;
  empresa_dona: string | null;
  turno: string | null;
}

type FilterType = "frota" | "obra" | "encarregado";

interface Obra {
  obra_nome: string;
}

interface Encarregado {
  encarregado: string;
}

export default function RelatorioEquipamentosRdo() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  
  const [filterType, setFilterType] = useState<FilterType>("frota");
  const [frota, setFrota] = useState("");
  const [obra, setObra] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [obras, setObras] = useState<Obra[]>([]);
  const [encarregados, setEncarregados] = useState<Encarregado[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Carregar obras e encarregados quando o filtro muda
  useEffect(() => {
    if (!profile?.company_id) return;

    const loadDropdowns = async () => {
      if (filterType === "obra") {
        setLoadingDropdowns(true);
        try {
          const { data, error } = await supabase
            .from("rdo_diarios")
            .select("obra_nome")
            .eq("company_id", profile.company_id!)
            .not("obra_nome", "is", null)
            .order("obra_nome", { ascending: true });

          if (error) throw error;

          // Remove duplicates
          const unique = Array.from(
            new Map((data || []).map((d: any) => [d.obra_nome, d])).values()
          );
          setObras(unique);
        } catch (err) {
          console.error("Erro ao carregar obras:", err);
        } finally {
          setLoadingDropdowns(false);
        }
      } else if (filterType === "encarregado") {
        setLoadingDropdowns(true);
        try {
          const { data, error } = await supabase
            .from("rdo_diarios")
            .select("encarregado")
            .eq("company_id", profile.company_id!)
            .not("encarregado", "is", null)
            .order("encarregado", { ascending: true });

          if (error) throw error;

          // Remove duplicates
          const unique = Array.from(
            new Map((data || []).map((d: any) => [d.encarregado, d])).values()
          );
          setEncarregados(unique);
        } catch (err) {
          console.error("Erro ao carregar encarregados:", err);
        } finally {
          setLoadingDropdowns(false);
        }
      }
    };

    loadDropdowns();
  }, [filterType, profile?.company_id]);

  const buscar = async () => {
    const filter = filterType === "frota" ? frota : (filterType === "obra" ? obra : encarregado);
    
    if (!filter.trim()) return;
    if (!profile?.company_id) return;

    setLoading(true);
    setSearched(true);

    try {
      let query = supabase
        .from("rdo_equipamentos")
        .select("frota, categoria, tipo, nome, empresa_dona, rdo_id, rdo_diarios(data, obra_nome, turno, encarregado)")
        .eq("company_id", profile.company_id!);

      // Apply filter based on type
      if (filterType === "frota") {
        query = query.ilike("frota", `%${filter.trim()}%`);
      } else if (filterType === "obra") {
        query = query.eq("rdo_diarios.obra_nome", filter);
      } else if (filterType === "encarregado") {
        query = query.eq("rdo_diarios.encarregado", filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let result: ResultRow[] = (data || []).map((r: any) => ({
        data: r.rdo_diarios?.data || "",
        obra_nome: r.rdo_diarios?.obra_nome || "",
        frota: r.frota || "",
        categoria: r.categoria || null,
        tipo: r.tipo || null,
        nome: r.nome || null,
        empresa_dona: r.empresa_dona || null,
        turno: r.rdo_diarios?.turno || null,
      }));

      // Apply date filters
      if (dataIni) result = result.filter((r) => r.data >= dataIni);
      if (dataFim) result = result.filter((r) => r.data <= dataFim);

      // Sort by date descending
      result.sort((a, b) => b.data.localeCompare(a.data));

      setRows(result);
    } catch (err: any) {
      console.error("Erro na busca:", err);
    } finally {
      setLoading(false);
    }
  };

  const getFilterLabel = (): string => {
    switch (filterType) {
      case "obra":
        return "Obra *";
      case "encarregado":
        return "Encarregado *";
      default:
        return "Frota *";
    }
  };

  const getFilterPlaceholder = (): string => {
    switch (filterType) {
      case "obra":
        return "Selecione uma obra...";
      case "encarregado":
        return "Selecione um encarregado...";
      default:
        return "Ex: FA12, BC75, VA20...";
    }
  };

  const exportToScreen = (): void => {
    // Just show the table - already displayed on the page
    console.log("Exibindo na tela:", rows.length, "registros");
  };

  const exportToPDF = (): void => {
    if (rows.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 10;

    // Title
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Localização de Equipamentos (RDO)", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 8;

    // Metadata
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const filterLabel =
      filterType === "frota"
        ? frota
        : filterType === "obra"
          ? obra
          : encarregado;
    doc.text(`Filtro: ${filterType.toUpperCase()} = ${filterLabel}`, 10, yPosition);
    yPosition += 5;

    if (dataIni) {
      doc.text(`Data Início: ${fmtDate(dataIni)}`, 10, yPosition);
      yPosition += 5;
    }
    if (dataFim) {
      doc.text(`Data Fim: ${fmtDate(dataFim)}`, 10, yPosition);
      yPosition += 5;
    }

    doc.text(`Total de Registros: ${rows.length}`, 10, yPosition);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 10, yPosition, {
      align: "right",
    });
    yPosition += 10;

    // Table
    autoTable(doc, {
      startY: yPosition,
      head: [["Data", "OGS", "Frota", "Equipamento", "Turno"]],
      body: rows.map((r) => [
        fmtDate(r.data),
        r.obra_nome,
        r.frota,
        `${r.tipo || r.categoria || "-"} ${r.nome ? `— ${r.nome}` : ""}`.trim(),
        r.turno || "-",
      ]),
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 50 },
        4: { cellWidth: 25 },
      },
      margin: 10,
      didDrawPage: (hookData) => {
        // Footer
        const pageCount = (doc as any).internal.pages.length - 1;
        const currentPage = hookData.pageNumber;
        doc.setFontSize(8);
        doc.text(
          `Página ${currentPage} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: "center" }
        );
      },
    });

    doc.save(`relatorio-equipamentos-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToExcel = (): void => {
    if (rows.length === 0) return;

    const ws = XLSX.utils.aoa_to_sheet([
      ["LOCALIZAÇÃO DE EQUIPAMENTOS (RDO)"],
      [],
      [
        "Filtro:",
        filterType === "frota" ? frota : filterType === "obra" ? obra : encarregado,
      ],
      [
        "Data Início:",
        dataIni ? fmtDate(dataIni) : "",
      ],
      [
        "Data Fim:",
        dataFim ? fmtDate(dataFim) : "",
      ],
      [
        "Total de Registros:",
        rows.length.toString(),
      ],
      [
        "Gerado em:",
        new Date().toLocaleDateString("pt-BR"),
      ],
      [],
      ["Data", "OGS", "Frota", "Equipamento", "Turno"],
      ...rows.map((r) => [
        fmtDate(r.data),
        r.obra_nome,
        r.frota,
        `${r.tipo || r.categoria || "-"} ${r.nome ? `— ${r.nome}` : ""}`.trim(),
        r.turno || "-",
      ]),
    ]);

    ws.A1.font = { bold: true, size: 12 };
    ws["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 40 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipamentos");
    XLSX.writeFile(wb, `relatorio-equipamentos-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const isFilterValid = (): boolean => {
    if (filterType === "frota") return frota.trim().length > 0;
    if (filterType === "obra") return obra.trim().length > 0;
    if (filterType === "encarregado") return encarregado.trim().length > 0;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/relatorios")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Wrench className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">
            Localização de Equipamentos (RDO)
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Filter Type Selector */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo de Filtro
          </label>
          <div className="flex gap-2">
            <Button
              variant={filterType === "frota" ? "default" : "outline"}
              onClick={() => {
                setFilterType("frota");
                setObra("");
                setEncarregado("");
              }}
              className="flex-1"
            >
              Por Frota
            </Button>
            <Button
              variant={filterType === "obra" ? "default" : "outline"}
              onClick={() => {
                setFilterType("obra");
                setFrota("");
                setEncarregado("");
              }}
              className="flex-1"
            >
              Por Obra
            </Button>
            <Button
              variant={filterType === "encarregado" ? "default" : "outline"}
              onClick={() => {
                setFilterType("encarregado");
                setFrota("");
                setObra("");
              }}
              className="flex-1"
            >
              Por Encarregado
            </Button>
          </div>
        </div>

        {/* Main Filter Card */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {getFilterLabel()}
            </label>

            {filterType === "frota" && (
              <Input
                value={frota}
                onChange={(e) => setFrota(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder={getFilterPlaceholder()}
                className="h-11 bg-secondary border-border"
              />
            )}

            {filterType === "obra" && (
              <select
                value={obra}
                onChange={(e) => setObra(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione uma obra..."}</option>
                {obras.map((o) => (
                  <option key={o.obra_nome} value={o.obra_nome}>
                    {o.obra_nome}
                  </option>
                ))}
              </select>
            )}

            {filterType === "encarregado" && (
              <select
                value={encarregado}
                onChange={(e) => setEncarregado(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione um encarregado..."}</option>
                {encarregados.map((e) => (
                  <option key={e.encarregado} value={e.encarregado}>
                    {e.encarregado}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data Início
              </label>
              <Input
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data Fim
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
          </div>

          <Button
            onClick={buscar}
            disabled={loading || !isFilterValid()}
            className="w-full h-11 gap-2"
          >
            <Search className="w-4 h-4" />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {/* Export Buttons */}
        {searched && !loading && rows.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="flex-1 gap-2"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF
            </Button>
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <Button
              onClick={exportToScreen}
              variant="outline"
              className="flex-1 gap-2"
            >
              <FileText className="w-4 h-4" />
              Tela
            </Button>
          </div>
        )}

        {/* Results Section */}
        {searched && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              {rows.length} registro(s) encontrado(s)
            </p>
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado para o filtro selecionado.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Data
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        OGS
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Frota
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Equipamento
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Turno
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                      >
                        <td className="px-3 py-2 font-medium">
                          {fmtDate(r.data)}
                        </td>
                        <td className="px-3 py-2 text-primary font-semibold">
                          {r.obra_nome}
                        </td>
                        <td className="px-3 py-2 font-bold">{r.frota}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {r.tipo || r.categoria || "-"}
                          {r.nome ? ` — ${r.nome}` : ""}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize">
                          {r.turno || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

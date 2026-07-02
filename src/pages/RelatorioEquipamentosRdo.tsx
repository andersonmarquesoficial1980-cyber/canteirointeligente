import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, FileSpreadsheet, Printer } from "lucide-react";

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtNum(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNumCsv(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toFixed(2).replace(".", ",");
}

interface ResultRow {
  data: string;
  obra_nome: string;
  apontador: string | null;
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

function exportarExcel(filterType: FilterType, filterValue: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Localização de Equipamentos (RDO)"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([]);
  linhas.push(["Data", "OGS", "Apontador", "Frota", "Equipamento", "Turno"]);
  
  rows.forEach(r => {
    linhas.push([
      fmtDate(r.data),
      r.obra_nome || "-",
      r.apontador || "-",
      r.frota || "-",
      `${r.tipo || r.categoria || "-"} ${r.nome ? `— ${r.nome}` : ""}`.trim(),
      r.turno || "-",
    ]);
  });
  
  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}""`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_EquipamentosRdo_${dataIni}_a_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(filterType: FilterType, filterValue: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Localização de Equipamentos (RDO)</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:16px}
    .period{font-size:11px;color:#666;margin-bottom:12px}
    .meta{font-size:10px;color:#666;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:4px 7px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    td{text-align:left}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>🔧 Localização de Equipamentos (RDO)</h1>
  <p class="period"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}</p>
  <p class="meta"><strong>Filtro:</strong> ${filterType.toUpperCase()} = ${filterValue}</p>
  <p class="meta"><strong>Total de Registros:</strong> ${rows.length}</p>
  <table>
    <tr><th>Data</th><th>OGS</th><th>Apontador</th><th>Frota</th><th>Equipamento</th><th>Turno</th></tr>`;
  
  rows.forEach(r => {
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.obra_nome || "-"}</td>
      <td>${r.apontador || "-"}</td>
      <td>${r.frota || "-"}</td>
      <td>${`${r.tipo || r.categoria || "-"} ${r.nome ? `— ${r.nome}` : ""}`.trim()}</td>
      <td>${r.turno || "-"}</td>
    </tr>`;
  });
  
  html += `</table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
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
      // FIX: Estratégia melhorada - buscar RDO IDs com TODOS os filtros aplicados na query
      let rdoQuery = supabase
        .from("rdo_diarios")
        .select("id, data, obra_nome, turno, encarregado, user_id")
        .eq("company_id", profile.company_id!);

      // Aplicar filtro de obra
      if (filterType === "obra") {
        rdoQuery = rdoQuery.ilike("obra_nome", `%${filter.trim()}%`);
      } else if (filterType === "encarregado") {
        // FIX: Usar eq() com trim() ou ilike() mas com exatidão
        rdoQuery = rdoQuery.eq("encarregado", filter.trim());
      }

      // FIX: Aplicar filtros de data NA QUERY, não no client
      if (dataIni) {
        rdoQuery = rdoQuery.gte("data", dataIni);
      }
      if (dataFim) {
        rdoQuery = rdoQuery.lte("data", dataFim);
      }

      const { data: rdos, error: rdoErr } = await rdoQuery;
      if (rdoErr) throw rdoErr;

      console.log(`[DEBUG] RDO Query returned ${rdos?.length || 0} records with filter=${filter}, dataIni=${dataIni}, dataFim=${dataFim}`);

      if (!rdos || rdos.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const rdoIds = rdos.map((r: any) => r.id);
      const rdoMap: Record<string, any> = {};
      rdos.forEach((r: any) => {
        rdoMap[r.id] = r;
      });

      // Buscar equipamentos por RDO IDs
      let equipQuery = supabase
        .from("rdo_equipamentos")
        .select("frota, categoria, tipo, nome, empresa_dona, rdo_id")
        .eq("company_id", profile.company_id!)
        .in("rdo_id", rdoIds);

      // Se filtro é frota, aplicar aqui
      if (filterType === "frota") {
        equipQuery = equipQuery.ilike("frota", `%${filter.trim()}%`);
      }

      const { data: equips, error: equipErr } = await equipQuery;
      if (equipErr) throw equipErr;

      console.log(`[DEBUG] Equipment Query returned ${equips?.length || 0} records`);

      // Buscar nomes dos apontadores (employees)
      const userIds = rdos.map((r: any) => r.user_id).filter(Boolean);
      let employeeMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: emps, error: empErr } = await supabase
          .from("employees")
          .select("id, name")
          .in("id", userIds);
        if (empErr) console.error("Erro ao buscar employees:", empErr);
        (emps || []).forEach((e: any) => { employeeMap[e.id] = e.name || "N/A"; });
      }

      // Mapear equipamentos + RDO + employee
      // Se não há equipamentos, criar linha do RDO mesmo assim
      let result: ResultRow[] = [];
      
      if (equips && equips.length > 0) {
        // Caso 1: Há equipamentos - mapear cada um
        result = equips.map((e: any) => {
          const rdo = rdoMap[e.rdo_id];
          return {
            data: rdo?.data || "",
            obra_nome: rdo?.obra_nome || "",
            apontador: employeeMap[rdo?.user_id] || null,
            frota: e.frota || "",
            categoria: e.categoria || null,
            tipo: e.tipo || null,
            nome: e.nome || null,
            empresa_dona: e.empresa_dona || null,
            turno: rdo?.turno || null,
          };
        });
      } else {
        // Caso 2: Sem equipamentos - criar linhas dos RDOs
        result = rdos.map((rdo: any) => ({
          data: rdo.data || "",
          obra_nome: rdo.obra_nome || "",
          apontador: employeeMap[rdo.user_id] || null,
          frota: "",
          categoria: null,
          tipo: null,
          nome: null,
          empresa_dona: null,
          turno: rdo.turno || null,
        }));
      }

      // FIX: Data filters já foram aplicados na query, mas aplicamos novamente se necessário
      // (não prejudica, apenas redundante com o fix acima)
      if (dataIni) result = result.filter((r) => r.data >= dataIni);
      if (dataFim) result = result.filter((r) => r.data <= dataFim);

      // Sort by date descending
      result.sort((a, b) => b.data.localeCompare(a.data));

      console.log(`[DEBUG] Final result count: ${result.length}`);
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

  const getFilterValue = (): string => {
    switch (filterType) {
      case "obra":
        return obra;
      case "encarregado":
        return encarregado;
      default:
        return frota;
    }
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
              onClick={() => exportarExcel(filterType, getFilterValue(), dataIni, dataFim, rows)}
              variant="outline"
              className="flex-1 gap-2 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
            </Button>
            <Button
              onClick={() => exportarPdf(filterType, getFilterValue(), dataIni, dataFim, rows)}
              variant="outline"
              className="flex-1 gap-2 text-xs"
            >
              <Printer className="w-4 h-4" />
              Download PDF
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
                        Apontador
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
                        <td className="px-3 py-2 text-primary font-semibold text-xs">
                          {r.obra_nome}
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">
                          {r.apontador || "-"}
                        </td>
                        <td className="px-3 py-2 font-bold text-xs">{r.frota}</td>
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

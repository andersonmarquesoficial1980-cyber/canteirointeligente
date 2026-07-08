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

interface ResultRow {
  data: string;
  apontador: string | null;
  encarregado: string | null;
  ogs: string;
  contratante: string | null;
  local: string | null;
  frota: string;
  empresa: string | null;
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
  linhas.push(["Data", "Apontador", "Encarregado", "OGS", "Contratante", "Local", "Frota", "Empresa"]);
  
  rows.forEach(r => {
    linhas.push([
      fmtDate(r.data),
      r.apontador || "-",
      r.encarregado || "-",
      r.ogs || "-",
      r.contratante || "-",
      r.local || "-",
      r.frota || "-",
      r.empresa || "-",
    ]);
  });
  
  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
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
    <tr><th>Data</th><th>Apontador</th><th>Encarregado</th><th>OGS</th><th>Contratante</th><th>Local</th><th>Frota</th><th>Empresa</th></tr>`;
  
  rows.forEach(r => {
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.apontador || "-"}</td>
      <td>${r.encarregado || "-"}</td>
      <td>${r.ogs || "-"}</td>
      <td>${r.contratante || "-"}</td>
      <td>${r.local || "-"}</td>
      <td>${r.frota || "-"}</td>
      <td>${r.empresa || "-"}</td>
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
  const [tipoEquip, setTipoEquip] = useState("");
  const [tiposEquip, setTiposEquip] = useState<string[]>([]);
  const [frotasSelecionaveis, setFrotasSelecionaveis] = useState<string[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [loadingFrotas, setLoadingFrotas] = useState(false);
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
  const [messageNoData, setMessageNoData] = useState("");

  // Carregar tipos de equipamento quando filtro = frota
  useEffect(() => {
    if (filterType !== "frota") return;
    if (!profile?.company_id) return;

    const loadTipos = async () => {
      setLoadingTipos(true);
      try {
        const { data, error } = await supabase
          .from("equipamentos")
          .select("tipo")
          .not("tipo", "is", null)
          .order("tipo", { ascending: true });

        if (error) throw error;

        const unique = Array.from(new Set((data || []).map((d: any) => d.tipo).filter(Boolean))).sort() as string[];
        setTiposEquip(unique);
      } catch (err) {
        console.error("Erro ao carregar tipos de equipamento:", err);
      } finally {
        setLoadingTipos(false);
      }
    };

    loadTipos();
  }, [filterType, profile?.company_id]);

  // Carregar frotas quando tipo é selecionado
  useEffect(() => {
    if (!tipoEquip || filterType !== "frota") return;

    const loadFrotas = async () => {
      setLoadingFrotas(true);
      setFrota("");
      try {
        const { data, error } = await supabase
          .from("equipamentos")
          .select("frota")
          .eq("tipo", tipoEquip)
          .not("frota", "is", null)
          .order("frota", { ascending: true });

        if (error) throw error;

        const unique = Array.from(new Set((data || []).map((d: any) => d.frota).filter(Boolean))).sort() as string[];
        setFrotasSelecionaveis(unique);
      } catch (err) {
        console.error("Erro ao carregar frotas:", err);
      } finally {
        setLoadingFrotas(false);
      }
    };

    loadFrotas();
  }, [tipoEquip, filterType]);

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
    const filter = filterType === "frota" ? tipoEquip : (filterType === "obra" ? obra : encarregado);
    
    if (!filter.trim()) return;
    if (!profile?.company_id) return;

    setLoading(true);
    setSearched(true);
    setMessageNoData("");

    try {
      // PASSO 1: Buscar RDOs pelo filtro
      let rdoQuery = supabase
        .from("rdo_diarios")
        .select("id, user_id, data, encarregado, obra_nome, turno, preenchido_por, company_id, responsavel")
        .eq("company_id", profile.company_id!);

      // Aplicar filtro de obra via RDO
      if (filterType === "obra") {
        rdoQuery = rdoQuery.ilike("obra_nome", `%${filter.trim()}%`);
      } else if (filterType === "encarregado") {
        rdoQuery = rdoQuery.eq("encarregado", filter.trim());
      }

      // Aplicar filtros de data
      if (dataIni) {
        rdoQuery = rdoQuery.gte("data", dataIni);
      }
      if (dataFim) {
        rdoQuery = rdoQuery.lte("data", dataFim);
      }

      const { data: rdos, error: rdoErr } = await rdoQuery;
      if (rdoErr) throw rdoErr;

      console.log(`[DEBUG] RDO Query returned ${rdos?.length || 0} records`);

      if (!rdos || rdos.length === 0) {
        setRows([]);
        setMessageNoData("Nenhum RDO encontrado para o filtro selecionado.");
        setLoading(false);
        return;
      }

      const rdoIds = rdos.map((r: any) => r.id);
      const rdoMap: Record<string, any> = {};
      rdos.forEach((r: any) => {
        rdoMap[r.id] = r;
      });

      console.log(`[DEBUG] RDO IDs to search: ${rdoIds.join(", ")}`);
      console.log(`[DEBUG] Company ID: ${profile.company_id}`);

      // PASSO 2: Buscar equipamentos de RDO
      // IMPORTANTE: Se filtro é frota, buscar equipamentos com filtro de frota
      // Se filtro é encarregado ou obra, buscar TODOS os equipamentos para estes RDOs
      let equipQuery = supabase
        .from("rdo_equipamentos")
        .select("id, frota, empresa_dona, rdo_id, categoria, tipo, sub_tipo, nome, patrimonio")
        // NÃO filtrar por company_id aqui — rdo_equipamentos pode ter company_id NULL.
        // O isolamento por empresa já está garantido pelo .in("rdo_id", rdoIds),
        // pois os rdoIds vieram de rdo_diarios filtrado por company_id.
        .in("rdo_id", rdoIds);

      // Se filtro é frota, aplicar aqui PARA REDUZIR RESULTADOS
      if (filterType === "frota") {
        if (frota.trim()) {
          // Frota específica selecionada
          equipQuery = equipQuery.ilike("frota", `%${frota.trim()}%`);
        } else if (frotasSelecionaveis.length > 0) {
          // Tipo selecionado, frota em branco → filtra pelas frotas daquele tipo
          equipQuery = equipQuery.in("frota", frotasSelecionaveis);
        }
        // Se frotasSelecionaveis vazio (tipo sem frotas cadastradas), retorna sem filtro de frota
      }
      // Se for encarregado ou obra, NÃO aplicar filtro de frota - pega TODOS

      const { data: equips, error: equipErr } = await equipQuery;
      if (equipErr) {
        console.error("[DEBUG] ERROR em rdo_equipamentos query:", equipErr);
        throw equipErr;
      }

      console.log(`[DEBUG] rdo_equipamentos Query returned ${equips?.length || 0} records`);
      if (equips && equips.length > 0) {
        console.log(`[DEBUG] Sample equipment:`, equips[0]);
      }

      // Mapa de equipamentos por frota para buscar empresa
      const frotaNames = Array.from(new Set((equips || []).map((e: any) => e.frota).filter(Boolean)));
      let frotaEmpresaMap: Record<string, string> = {};
      
      if (frotaNames.length > 0) {
        // PASSO 2B: Buscar empresa da tabela equipamentos por frota
        // (é onde FrotaNovo.tsx salva o campo empresa — não em maquinas_frota)
        const { data: maquinas, error: maqErr } = await (supabase as any)
          .from("equipamentos")
          .select("frota, empresa")
          .in("frota", frotaNames);
        
        if (maqErr) {
          console.error("Erro ao buscar empresa das frotas:", maqErr);
        } else {
          (maquinas || []).forEach((m: any) => {
            if (m.frota && m.empresa) {
              frotaEmpresaMap[m.frota] = m.empresa;
            }
          });
        }
      }

      console.log(`[DEBUG] Found ${Object.keys(frotaEmpresaMap).length} maquinas_frota with empresa`);

      const allEquips = equips || [];
      if (allEquips.length === 0) {
        console.log("[DEBUG] No equipment found in rdo_equipamentos - creating fallback rows from RDO data");
      }

      // PASSO 3: Buscar nomes dos apontadores (employees)
      const userIds = rdos.map((r: any) => r.user_id).filter(Boolean);
      let employeeMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: emps, error: empErr } = await supabase
          .from("employees")
          .select("id, name")
          .in("id", userIds);
        
        if (empErr) {
          console.error("Erro ao buscar employees:", empErr);
        }
        
        (emps || []).forEach((e: any) => { 
          employeeMap[e.id] = e.name || "N/A";
        });
      }
      
      console.log(`[DEBUG] Found ${Object.keys(employeeMap).length} employees`);

      // PASSO 4: Buscar OGS Reference (para Contratante e Local)
      const ogsNumbers = Array.from(new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean)));
      let ogsMap: Record<string, any> = {};
      
      if (ogsNumbers.length > 0) {
        const { data: ogsRefs, error: ogsErr } = await supabase
          .from("ogs_reference")
          .select("ogs_number, client_name, location_address")
          .eq("company_id", profile.company_id!)
          .in("ogs_number", ogsNumbers);
        
        if (ogsErr) {
          console.error("Erro ao buscar ogs_reference:", ogsErr);
        } else {
          (ogsRefs || []).forEach((o: any) => {
            ogsMap[o.ogs_number] = o;
          });
        }
      }
      
      console.log(`[DEBUG] Found ${Object.keys(ogsMap).length} OGS references`);

      // PASSO 5: Montar resultado final
      let result: ResultRow[] = [];
      
      console.log(`[DEBUG] allEquips.length = ${allEquips.length}, rdos.length = ${rdos.length}`);
      
      if (allEquips.length > 0) {
        // Com equipamentos: criar uma linha por equipamento
        console.log(`[DEBUG] Criando ${allEquips.length} linhas (1 por equipamento)`);
        result = allEquips.map((e: any) => {
          const rdo = rdoMap[e.rdo_id];
          if (!rdo) return null; // Skip if rdo not found
          
          const ogsRef = ogsMap[rdo.obra_nome];
          // Apontador: usar preenchido_por (quem preencheu o RDO)
          const apontador = rdo.preenchido_por || null;
          // Empresa: prioridade empresa_dona, depois maquinas_frota, depois null
          const empresa = e.empresa_dona || frotaEmpresaMap[e.frota] || null;
          
          console.log(`[DEBUG EQUIP] frota=${e.frota}, empresa_dona=${e.empresa_dona}, empresa_final=${empresa}`);
          
          return {
            data: rdo?.data || "",
            apontador,
            encarregado: rdo?.encarregado || null,
            ogs: rdo?.obra_nome || "",
            contratante: ogsRef?.client_name || null,
            local: ogsRef?.location_address || null,
            frota: e.frota || "",
            empresa,
          };
        }).filter((row: any) => row !== null);
      } else if (filterType !== "frota") {
        // Sem equipamentos: fallback somente para busca por obra ou encarregado
        console.log(`[DEBUG] FALLBACK: Criando ${rdos.length} linhas (1 por RDO, equipamentos vazios)`);
        result = rdos.map((rdo: any) => {
          const ogsRef = ogsMap[rdo.obra_nome];
          // Apontador: usar preenchido_por
          const apontador = rdo.preenchido_por || null;
          
          return {
            data: rdo.data || "",
            apontador,
            encarregado: rdo.encarregado || null,
            ogs: rdo.obra_nome || "",
            contratante: ogsRef?.client_name || null,
            local: ogsRef?.location_address || null,
            frota: "",
            empresa: null,
          };
        });
      } else {
        // Filtro por frota/tipo sem resultado em equipamentos
        setRows([]);
        setMessageNoData(`Nenhum equipamento do tipo "${tipoEquip}"${frota ? ` (${frota})` : ""} encontrado nos RDOs do período.`);
        setLoading(false);
        return;
      }

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
    if (filterType === "frota") return tipoEquip.trim().length > 0;
    if (filterType === "obra") return obra.trim().length > 0;
    if (filterType === "encarregado") return encarregado.trim().length > 0;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
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

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
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
                setTipoEquip("");
                setFrota("");
                setFrotasSelecionaveis([]);
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
                setTipoEquip("");
                setFrotasSelecionaveis([]);
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
                setTipoEquip("");
                setFrotasSelecionaveis([]);
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
            {filterType !== "frota" && (
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {getFilterLabel()}
              </label>
            )}

            {filterType === "frota" && (
              <div className="space-y-3">
                {/* Select 1: Tipo de Equipamento */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tipo de Equipamento *
                  </label>
                  <select
                    value={tipoEquip}
                    onChange={(e) => {
                      setTipoEquip(e.target.value);
                      setFrota("");
                      setFrotasSelecionaveis([]);
                    }}
                    disabled={loadingTipos}
                    className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                  >
                    <option value="">{loadingTipos ? "Carregando..." : "Selecione o tipo..."}</option>
                    {tiposEquip.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Select 2: Frota (dependente do tipo) */}
                {tipoEquip && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Frota (opcional — deixe em branco para todas)
                    </label>
                    <select
                      value={frota}
                      onChange={(e) => setFrota(e.target.value)}
                      disabled={loadingFrotas}
                      className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                    >
                      <option value="">{loadingFrotas ? "Carregando frotas..." : frotasSelecionaveis.length === 0 ? "Nenhuma frota cadastrada" : "Todas as frotas"}</option>
                      {frotasSelecionaveis.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
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
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                {messageNoData || "Nenhum registro encontrado para o filtro selecionado."}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-1">
                  {rows.length} registro(s) encontrado(s)
                  {messageNoData && (
                    <>
                      <br /><span className="text-xs italic">{messageNoData}</span>
                    </>
                  )}
                </p>
                <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Data
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Apontador
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Encarregado
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        OGS
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Contratante
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Local
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Frota
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Empresa
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                      >
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {fmtDate(r.data)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {r.apontador || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {r.encarregado || "-"}
                        </td>
                        <td className="px-3 py-2 text-primary font-semibold whitespace-nowrap">
                          {r.ogs}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {r.contratante || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {r.local || "-"}
                        </td>
                        <td className="px-3 py-2 font-bold whitespace-nowrap">
                          {r.frota || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {r.empresa || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

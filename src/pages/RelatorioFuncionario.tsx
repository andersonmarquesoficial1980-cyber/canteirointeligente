import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, User, FileSpreadsheet, Printer } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface ResultRow {
  nome: string;
  data: string;
  obra_nome: string;
  encarregado: string | null;
  funcao: string | null;
  entrada: string | null;
  saida: string | null;
  turno: string | null;
  clima: string | null;
  contratante: string | null;
  local: string | null;
}

type FilterType = "funcao" | "obra" | "encarregado";

function exportarExcel(filterType: FilterType, filterLabel: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Localização de Funcionários (RDO)"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([`Filtro: ${filterLabel}`]);
  linhas.push([]);
  linhas.push(["Funcionário", "Função", "Data", "OGS", "Contratante", "Local", "Encarregado", "Turno", "Status"]);
  rows.forEach(r => {
    linhas.push([
      r.nome || "-", r.funcao || "-", fmtDate(r.data),
      r.obra_nome || "-", r.contratante || "-", r.local || "-",
      r.encarregado || "-", r.turno || "-", r.clima || "Trabalhou",
    ]);
  });
  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_FuncionariosRdo_${dataIni}_a_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(filterType: FilterType, filterLabel: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Localização de Funcionários (RDO)</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:16px}
    .period{font-size:11px;color:#666;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:4px 7px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>👤 Localização de Funcionários (RDO)</h1>
  <p class="period"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}</p>
  <p class="period"><strong>Filtro:</strong> ${filterLabel} | <strong>Total:</strong> ${rows.length} registros</p>
  <table>
    <tr><th>Funcionário</th><th>Função</th><th>Data</th><th>OGS</th><th>Contratante</th><th>Local</th><th>Encarregado</th><th>Turno</th><th>Status</th></tr>`;
  rows.forEach(r => {
    html += `<tr>
      <td>${r.nome||"-"}</td><td>${r.funcao||"-"}</td><td>${fmtDate(r.data)}</td>
      <td>${r.obra_nome||"-"}</td><td>${r.contratante||"-"}</td><td>${r.local||"-"}</td>
      <td>${r.encarregado||"-"}</td><td>${r.turno||"-"}</td><td>${r.clima||"Trabalhou"}</td>
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

export default function RelatorioFuncionario() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const [filterType, setFilterType] = useState<FilterType>("funcao");

  // Por Função
  const [funcao, setFuncao] = useState("");
  const [nome, setNome] = useState("");
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [nomesSelecionaveis, setNomesSelecionaveis] = useState<string[]>([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(false);
  const [loadingNomes, setLoadingNomes] = useState(false);

  // Por Obra / Por Encarregado
  const [obra, setObra] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [obras, setObras] = useState<string[]>([]);
  const [encarregados, setEncarregados] = useState<string[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [messageNoData, setMessageNoData] = useState("");

  // Carregar funções disponíveis
  useEffect(() => {
    if (filterType !== "funcao" || !profile?.company_id) return;
    const load = async () => {
      setLoadingFuncoes(true);
      try {
        const { data } = await (supabase as any)
          .from("rdo_efetivo")
          .select("funcao, rdo_diarios!inner(company_id)")
          .eq("rdo_diarios.company_id", profile.company_id!)
          .not("funcao", "is", null);
        const unique = Array.from(new Set((data || []).map((d: any) => d.funcao).filter(Boolean))).sort() as string[];
        setFuncoes(unique);
      } catch (err) {
        console.error("Erro ao carregar funções:", err);
      } finally {
        setLoadingFuncoes(false);
      }
    };
    load();
  }, [filterType, profile?.company_id]);

  // Carregar nomes quando função é selecionada
  useEffect(() => {
    if (!funcao || filterType !== "funcao" || !profile?.company_id) return;
    const load = async () => {
      setLoadingNomes(true);
      setNome("");
      try {
        const { data } = await (supabase as any)
          .from("rdo_efetivo")
          .select("nome, rdo_diarios!inner(company_id)")
          .eq("funcao", funcao)
          .eq("rdo_diarios.company_id", profile.company_id!)
          .not("nome", "is", null);
        const unique = Array.from(new Set((data || []).map((d: any) => d.nome).filter(Boolean))).sort() as string[];
        setNomesSelecionaveis(unique);
      } catch (err) {
        console.error("Erro ao carregar nomes:", err);
      } finally {
        setLoadingNomes(false);
      }
    };
    load();
  }, [funcao, filterType, profile?.company_id]);

  // Carregar obras ou encarregados
  useEffect(() => {
    if (!profile?.company_id) return;
    if (filterType !== "obra" && filterType !== "encarregado") return;
    const load = async () => {
      setLoadingDropdowns(true);
      try {
        if (filterType === "obra") {
          const { data } = await supabase
            .from("rdo_diarios")
            .select("obra_nome")
            .eq("company_id", profile.company_id!)
            .not("obra_nome", "is", null)
            .order("obra_nome", { ascending: true });
          const unique = Array.from(new Map((data || []).map((d: any) => [d.obra_nome, d])).values()).map((d: any) => d.obra_nome) as string[];
          setObras(unique);
        } else {
          const { data } = await supabase
            .from("rdo_diarios")
            .select("encarregado")
            .eq("company_id", profile.company_id!)
            .not("encarregado", "is", null)
            .order("encarregado", { ascending: true });
          const unique = Array.from(new Map((data || []).map((d: any) => [d.encarregado, d])).values()).map((d: any) => d.encarregado) as string[];
          setEncarregados(unique);
        }
      } catch (err) {
        console.error("Erro ao carregar dropdown:", err);
      } finally {
        setLoadingDropdowns(false);
      }
    };
    load();
  }, [filterType, profile?.company_id]);

  const isValid = () => {
    if (filterType === "funcao") return funcao.trim().length > 0;
    if (filterType === "obra") return obra.trim().length > 0;
    if (filterType === "encarregado") return encarregado.trim().length > 0;
    return false;
  };

  const getFilterLabel = () => {
    if (filterType === "funcao") return `Função: ${funcao}${nome ? ` | ${nome}` : " (todos)"}`;
    if (filterType === "obra") return `Obra: ${obra}`;
    return `Encarregado: ${encarregado}`;
  };

  const buscar = async () => {
    if (!isValid() || !profile?.company_id) return;

    setLoading(true);
    setSearched(true);
    setMessageNoData("");

    try {
      let rdoIds: string[] = [];
      let rdoMap: Record<string, any> = {};

      if (filterType === "funcao") {
        // Busca direta em rdo_efetivo com join
        let query = (supabase as any)
          .from("rdo_efetivo")
          .select("nome, funcao, entrada, saida, rdo_id, rdo_diarios!inner(id, data, obra_nome, encarregado, turno, clima, company_id)")
          .eq("rdo_diarios.company_id", profile.company_id!)
          .eq("funcao", funcao);

        if (nome.trim()) query = query.eq("nome", nome.trim());
        if (dataIni) query = query.gte("rdo_diarios.data", dataIni);
        if (dataFim) query = query.lte("rdo_diarios.data", dataFim);

        const { data, error } = await query;
        if (error) throw error;

        let result: ResultRow[] = [];
        (data || []).forEach((r: any) => {
          // nome pode conter múltiplos nomes separados por "|||"
          const nomes = (r.nome || "").split("|||").map((n: string) => n.trim()).filter(Boolean);
          const lista = nomes.length > 0 ? nomes : [""];
          lista.forEach((n: string) => {
            result.push({
              nome: n,
              data: r.rdo_diarios?.data || "",
              obra_nome: r.rdo_diarios?.obra_nome || "",
              encarregado: r.rdo_diarios?.encarregado || null,
              funcao: r.funcao || null,
              entrada: r.entrada || null,
              saida: r.saida || null,
              turno: r.rdo_diarios?.turno || null,
              clima: r.rdo_diarios?.clima || null,
              contratante: null,
              local: null,
            });
          });
        });

        if (dataIni) result = result.filter(r => r.data >= dataIni);
        if (dataFim) result = result.filter(r => r.data <= dataFim);

        result = await enrichWithOgs(result, profile.company_id!);
        result.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));

        if (result.length === 0) setMessageNoData(`Nenhum funcionário encontrado para "${funcao}"${nome ? ` (${nome})` : ""} no período.`);
        setRows(result);

      } else {
        // Para obra e encarregado: buscar RDOs primeiro, depois efetivo
        let rdoQuery = supabase
          .from("rdo_diarios")
          .select("id, data, obra_nome, encarregado, turno, clima, company_id")
          .eq("company_id", profile.company_id!);

        if (filterType === "obra") rdoQuery = rdoQuery.ilike("obra_nome", `%${obra.trim()}%`);
        if (filterType === "encarregado") rdoQuery = rdoQuery.eq("encarregado", encarregado.trim());
        if (dataIni) rdoQuery = rdoQuery.gte("data", dataIni);
        if (dataFim) rdoQuery = rdoQuery.lte("data", dataFim);

        const { data: rdos, error: rdoErr } = await rdoQuery;
        if (rdoErr) throw rdoErr;

        if (!rdos || rdos.length === 0) {
          setRows([]);
          setMessageNoData("Nenhum RDO encontrado para o filtro selecionado.");
          setLoading(false);
          return;
        }

        rdoIds = rdos.map((r: any) => r.id);
        rdos.forEach((r: any) => { rdoMap[r.id] = r; });

        const { data: efetivo, error: efErr } = await (supabase as any)
          .from("rdo_efetivo")
          .select("nome, funcao, entrada, saida, rdo_id")
          .in("rdo_id", rdoIds);

        if (efErr) throw efErr;

        let result: ResultRow[] = [];
        (efetivo || []).forEach((r: any) => {
          const rdo = rdoMap[r.rdo_id];
          if (!rdo) return;
          // nome pode conter múltiplos nomes separados por "|||"
          const nomes = (r.nome || "").split("|||").map((n: string) => n.trim()).filter(Boolean);
          const lista = nomes.length > 0 ? nomes : [""];
          lista.forEach((n: string) => {
            result.push({
              nome: n,
              data: rdo?.data || "",
              obra_nome: rdo?.obra_nome || "",
              encarregado: rdo?.encarregado || null,
              funcao: r.funcao || null,
              entrada: r.entrada || null,
              saida: r.saida || null,
              turno: rdo?.turno || null,
              clima: rdo?.clima || null,
              contratante: null,
              local: null,
            });
          });
        });

        result = await enrichWithOgs(result, profile.company_id!);
        result.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));

        if (result.length === 0) setMessageNoData("Nenhum funcionário encontrado nos RDOs do período.");
        setRows(result);
      }
    } catch (err: any) {
      console.error("Erro na busca:", err);
    } finally {
      setLoading(false);
    }
  };

  const enrichWithOgs = async (result: ResultRow[], companyId: string): Promise<ResultRow[]> => {
    const ogsNumbers = Array.from(new Set(result.map(r => r.obra_nome).filter(Boolean)));
    if (ogsNumbers.length === 0) return result;

    const { data: ogsRefs } = await supabase
      .from("ogs_reference")
      .select("ogs_number, client_name, location_address")
      .eq("company_id", companyId)
      .in("ogs_number", ogsNumbers as string[]);

    const ogsMap: Record<string, any> = {};
    (ogsRefs || []).forEach((o: any) => { ogsMap[o.ogs_number] = o; });

    return result.map(r => ({
      ...r,
      contratante: ogsMap[r.obra_nome]?.client_name || null,
      local: ogsMap[r.obra_nome]?.location_address || null,
    }));
  };

  const resetFilters = (type: FilterType) => {
    setFilterType(type);
    setFuncao(""); setNome(""); setNomesSelecionaveis([]);
    setObra(""); setEncarregado("");
    setRows([]); setSearched(false); setMessageNoData("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Localização de Funcionários (RDO)</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">

        {/* Seletor de tipo de filtro */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo de Filtro
          </label>
          <div className="flex gap-2">
            <Button variant={filterType === "funcao" ? "default" : "outline"} onClick={() => resetFilters("funcao")} className="flex-1">
              Por Função
            </Button>
            <Button variant={filterType === "obra" ? "default" : "outline"} onClick={() => resetFilters("obra")} className="flex-1">
              Por Obra
            </Button>
            <Button variant={filterType === "encarregado" ? "default" : "outline"} onClick={() => resetFilters("encarregado")} className="flex-1">
              Por Encarregado
            </Button>
          </div>
        </div>

        {/* Card de filtros */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">

          {/* Por Função: cascata Função → Funcionário */}
          {filterType === "funcao" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Função *</label>
                <select
                  value={funcao}
                  onChange={(e) => { setFuncao(e.target.value); setNome(""); setNomesSelecionaveis([]); }}
                  disabled={loadingFuncoes}
                  className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                >
                  <option value="">{loadingFuncoes ? "Carregando..." : "Selecione a função..."}</option>
                  {funcoes.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {funcao && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Funcionário (opcional — deixe em branco para todos)
                  </label>
                  <select
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={loadingNomes}
                    className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                  >
                    <option value="">{loadingNomes ? "Carregando..." : nomesSelecionaveis.length === 0 ? "Nenhum funcionário encontrado" : "Todos os funcionários"}</option>
                    {nomesSelecionaveis.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Por Obra */}
          {filterType === "obra" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obra *</label>
              <select
                value={obra}
                onChange={(e) => setObra(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione uma obra..."}</option>
                {obras.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Por Encarregado */}
          {filterType === "encarregado" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encarregado *</label>
              <select
                value={encarregado}
                onChange={(e) => setEncarregado(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione um encarregado..."}</option>
                {encarregados.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início</label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>

          <Button onClick={buscar} disabled={loading || !isValid()} className="w-full h-11 gap-2">
            <Search className="w-4 h-4" />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {/* Botões de exportação */}
        {searched && !loading && rows.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={() => exportarExcel(filterType, getFilterLabel(), dataIni, dataFim, rows)} variant="outline" className="flex-1 gap-2 text-xs">
              <FileSpreadsheet className="w-4 h-4" /> Download Excel
            </Button>
            <Button onClick={() => exportarPdf(filterType, getFilterLabel(), dataIni, dataFim, rows)} variant="outline" className="flex-1 gap-2 text-xs">
              <Printer className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        )}

        {/* Resultados */}
        {searched && !loading && (
          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                {messageNoData || "Nenhum registro encontrado."}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-1">{rows.length} registro(s) encontrado(s)</p>
                <div className="bg-card rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Funcionário</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Função</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Data</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">OGS</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Contratante</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Local</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Encarregado</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Turno</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.nome || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.funcao || "-"}</td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{fmtDate(r.data)}</td>
                          <td className="px-3 py-2 text-primary font-semibold whitespace-nowrap">{r.obra_nome || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.contratante || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.local || "-"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.encarregado || "-"}</td>
                          <td className="px-3 py-2 text-xs capitalize whitespace-nowrap">{r.turno || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              r.clima === "Cancelou" ? "bg-red-100 text-red-700" :
                              r.clima === "Folga" ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {r.clima || "Trabalhou"}
                            </span>
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

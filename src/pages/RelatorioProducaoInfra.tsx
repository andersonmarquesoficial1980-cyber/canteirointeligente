import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Construction, FileSpreadsheet, Printer, Search } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtNum(n: any, decimais = 2) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}

function fmtNumCsv(n: any, decimais = 2) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toFixed(decimais).replace(".", ",");
}

function toAbsNum(n: any): number | null {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? null : Math.abs(v);
}

interface InfraRow {
  data: string;
  apontador: string | null;
  obra_nome: string;
  local: string | null;
  tipo_servico: string | null;
  sentido_faixa: string | null;
  comprimento_m: number | null;
  largura_m: number | null;
  area_m2: number | null;
  espessura_cm: number | null;
  volume_m3: number | null;
  is_retrabalho: boolean;
}

// ---------- EXPORTAR EXCEL (CSV) ----------
function exportarExcel(dataIni: string, dataFim: string, rows: InfraRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Relatório de Produção de Infraestrutura"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([]);
  linhas.push(["Data", "Apontador", "OGS", "Local", "Serviço", "Sentido/Faixa", "Retrabalho", "Comp(m)", "Larg(m)", "Área(m²)", "Esp(cm)", "Volume(m³)", "TOTAL Área(m²)"]);

  let totalArea = 0;
  rows.forEach(r => {
    const area = getArea(r);
    totalArea += area ?? 0;
    linhas.push([
      fmtDate(r.data),
      r.apontador || "-",
      r.obra_nome || "-",
      r.local || "-",
      r.tipo_servico || "-",
      r.sentido_faixa || "-",
      r.is_retrabalho ? "SIM" : "NÃO",
      getComp(r) != null ? fmtNumCsv(getComp(r)!) : "-",
      r.largura_m != null ? fmtNumCsv(r.largura_m, 3) : "-",
      area != null ? fmtNumCsv(area) : "-",
      r.espessura_cm != null ? fmtNumCsv(r.espessura_cm, 3) : "-",
      getVol(r) != null ? fmtNumCsv(getVol(r)!, 3) : "-",
      "", // coluna TOTAL vazia por linha (total geral abaixo)
    ]);
  });

  linhas.push(["", "", "", "", "", "", "", "", "TOTAL", fmtNumCsv(totalArea), "", "", fmtNumCsv(totalArea)]);

  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_ProducaoInfra_${dataIni}_a_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- EXPORTAR PDF ----------
function exportarPdf(dataIni: string, dataFim: string, rows: InfraRow[], filtros: string) {
  let totalArea = 0;
  rows.forEach(r => { totalArea += getArea(r) ?? 0; });

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Produção de Infraestrutura</title><style>
    body{font-family:Arial,sans-serif;padding:16px;color:#333;font-size:11px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:15px;margin-bottom:4px}
    .info{font-size:10px;color:#666;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}
    th,td{border:1px solid #d1d5db;padding:3px 6px;text-align:left}
    th{background:#f3f4f6;font-weight:600;white-space:nowrap}
    td.num{text-align:right}
    .total{font-weight:bold;background:#f3f4f6}
    .total td{font-weight:bold}
    .total td.num{color:#1a56db}
    @media print{body{padding:6px}}
  </style></head><body>
  <h1>🏗️ Relatório de Produção de Infraestrutura</h1>
  <p class="info"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}${filtros ? ` &nbsp;|&nbsp; <strong>Filtros:</strong> ${filtros}` : ""}</p>
  <table>
    <tr>
      <th>Data</th><th>Apontador</th><th>OGS</th><th>Local</th>
      <th>Serviço</th><th>Sentido/Faixa</th><th>Retrabalho</th>
      <th class="num">Comp(m)</th><th class="num">Larg(m)</th>
      <th class="num">Área(m²)</th><th class="num">Esp(cm)</th>
      <th class="num">Volume(m³)</th><th class="num">TOTAL</th>
    </tr>`;

  rows.forEach(r => {
    const area = getArea(r);
    const vol = getVol(r);
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.apontador || "-"}</td>
      <td>${r.obra_nome || "-"}</td>
      <td>${r.local || "-"}</td>
      <td>${r.tipo_servico || "-"}</td>
      <td>${r.sentido_faixa || "-"}</td>
      <td>${r.is_retrabalho ? "SIM" : "NÃO"}</td>
      <td class="num">${getComp(r) != null ? fmtNum(getComp(r)!) : "-"}</td>
      <td class="num">${r.largura_m != null ? fmtNum(r.largura_m, 3) : "-"}</td>
      <td class="num">${area != null ? fmtNum(area) : "-"}</td>
      <td class="num">${r.espessura_cm != null ? fmtNum(r.espessura_cm, 3) : "-"}</td>
      <td class="num">${vol != null ? fmtNum(vol, 3) : "-"}</td>
      <td class="num">${area != null ? fmtNum(area) : "-"}</td>
    </tr>`;
  });

  html += `<tr class="total">
    <td colspan="9">TOTAL GERAL</td>
    <td class="num">${fmtNum(totalArea)}</td>
    <td></td><td></td>
    <td class="num">${fmtNum(totalArea)}</td>
  </tr>`;
  html += `</table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// Helpers — calcula área/vol se nulo no banco (compatibilidade com RDOs antigos)
function getArea(r: InfraRow): number | null {
  if (r.area_m2 != null) return toAbsNum(r.area_m2);
  const comp = toAbsNum(r.comprimento_m);
  const larg = toAbsNum(r.largura_m);
  if (comp != null && larg != null) {
    return Math.round(comp * larg * 100) / 100;
  }
  return null;
}
function getVol(r: InfraRow): number | null {
  if (r.volume_m3 != null) return toAbsNum(r.volume_m3);
  const area = getArea(r);
  const esp = toAbsNum(r.espessura_cm);
  if (area && esp && esp > 0) {
    return Math.round(area * (esp / 100) * 1000) / 1000;
  }
  return null;
}

function getComp(r: InfraRow): number | null {
  return toAbsNum(r.comprimento_m);
}

// ---------- COMPONENTE PRINCIPAL ----------
export default function RelatorioProducaoInfra() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  // Filtros
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroOgs, setFiltroOgs] = useState("");
  const [filtroApontador, setFiltroApontador] = useState("");
  const [filtroServico, setFiltroServico] = useState("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InfraRow[]>([]);
  const [searched, setSearched] = useState(false);

  const totalArea = rows.reduce((s, r) => s + (getArea(r) ?? 0), 0);

  const buscar = async () => {
    if (!dataIni || !dataFim || !profile?.company_id) return;
    setLoading(true);
    setSearched(true);
    try {
      // 1. RDOs de INFRAESTRUTURA no período
      let rdoQ = (supabase as any)
        .from("rdo_diarios")
        .select("id, obra_nome, data, encarregado, preenchido_por")
        .eq("company_id", profile.company_id)
        .eq("tipo_rdo", "INFRAESTRUTURA")
        .gte("data", dataIni)
        .lte("data", dataFim);

      if (filtroOgs.trim()) rdoQ = rdoQ.ilike("obra_nome", `%${filtroOgs.trim()}%`);
      if (filtroApontador.trim()) rdoQ = rdoQ.ilike("preenchido_por", `%${filtroApontador.trim()}%`);

      const { data: rdos, error: rdoErr } = await rdoQ;
      if (rdoErr) throw rdoErr;
      if (!rdos || rdos.length === 0) { setRows([]); setLoading(false); return; }

      const rdoIds = rdos.map((r: any) => r.id);
      const rdoMap: Record<string, any> = {};
      rdos.forEach((r: any) => { rdoMap[r.id] = r; });

      // 2. OGS Reference para Local
      const ogsNumbers = Array.from(new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean)));
      let ogsMap: Record<string, any> = {};
      if (ogsNumbers.length > 0) {
        const { data: ogsRefs } = await (supabase as any)
          .from("ogs_reference")
          .select("ogs_number, location_address")
          .eq("company_id", profile.company_id)
          .in("ogs_number", ogsNumbers);
        (ogsRefs || []).forEach((o: any) => { ogsMap[o.ogs_number] = o; });
      }

      // 3. Produção desses RDOs
      const { data: prods, error: prodErr } = await (supabase as any)
        .from("rdo_producao")
        .select("id, rdo_id, tipo_servico, sentido, sentido_faixa, comprimento_m, largura_m, espessura_cm, area_m2, volume_m3, is_retrabalho")
        .in("rdo_id", rdoIds);
      if (prodErr) throw prodErr;

      // 4. Montar resultado
      let result: InfraRow[] = (prods || []).map((p: any) => {
        const rdo = rdoMap[p.rdo_id];
        const ogsRef = ogsMap[rdo?.obra_nome];
        return {
          data: rdo?.data || "",
          apontador: rdo?.preenchido_por || rdo?.encarregado || null,
          obra_nome: rdo?.obra_nome || "",
          local: ogsRef?.location_address || null,
          tipo_servico: p.tipo_servico || null,
          sentido_faixa: p.sentido_faixa || p.sentido || null,
          comprimento_m: p.comprimento_m != null ? parseFloat(String(p.comprimento_m)) : null,
          largura_m: p.largura_m != null ? parseFloat(String(p.largura_m)) : null,
          area_m2: p.area_m2 != null ? parseFloat(String(p.area_m2)) : null,
          espessura_cm: p.espessura_cm != null ? parseFloat(String(p.espessura_cm)) : null,
          volume_m3: p.volume_m3 != null ? parseFloat(String(p.volume_m3)) : null,
          is_retrabalho: !!p.is_retrabalho,
        };
      });

      // Filtro por Tipo de Serviço (client-side pois não há coluna de RDO para filtrar)
      if (filtroServico.trim()) {
        const s = filtroServico.trim().toUpperCase();
        result = result.filter(r => (r.tipo_servico || "").toUpperCase().includes(s));
      }

      // Ordenar: data DESC, apontador, ogs
      result.sort((a, b) => b.data.localeCompare(a.data) || (a.apontador || "").localeCompare(b.apontador || "") || a.obra_nome.localeCompare(b.obra_nome));

      setRows(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtrosTexto = [
    filtroOgs.trim() && `OGS: ${filtroOgs.trim()}`,
    filtroApontador.trim() && `Apontador: ${filtroApontador.trim()}`,
    filtroServico.trim() && `Serviço: ${filtroServico.trim()}`,
  ].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Construction className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Produção de Infraestrutura</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Card de filtros */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início *</label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim *</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>

          {/* Filtros opcionais */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OGS (opcional)</label>
              <Input
                value={filtroOgs}
                onChange={e => setFiltroOgs(e.target.value)}
                placeholder="Ex: 2544"
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Apontador (opcional)</label>
              <Input
                value={filtroApontador}
                onChange={e => setFiltroApontador(e.target.value)}
                placeholder="Ex: José Amaro"
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Serviço (opcional)</label>
              <Input
                value={filtroServico}
                onChange={e => setFiltroServico(e.target.value)}
                placeholder="Ex: SARJETA"
                className="h-11 bg-secondary border-border"
              />
            </div>
          </div>

          <Button
            onClick={buscar}
            disabled={!dataIni || !dataFim || loading}
            className="w-full h-11 rounded-xl font-display font-bold gap-2"
          >
            <Search className="w-4 h-4" />
            {loading ? "Buscando..." : "Gerar Relatório"}
          </Button>
        </div>

        {/* Resultado */}
        {searched && !loading && (
          <>
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                Nenhuma produção encontrada para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Barra de resumo + botões */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-primary">
                      {rows.length} linha{rows.length !== 1 ? "s" : ""} encontrada{rows.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Área total: <strong>{fmtNum(totalArea)} m²</strong>
                      {filtrosTexto && <> &nbsp;·&nbsp; Filtros: {filtrosTexto}</>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => exportarExcel(dataIni, dataFim, rows)}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => exportarPdf(dataIni, dataFim, rows, filtrosTexto)}
                    >
                      <Printer className="w-3.5 h-3.5" /> PDF
                    </Button>
                  </div>
                </div>

                {/* Tabela */}
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Data</th>
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Apontador</th>
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">OGS</th>
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Local</th>
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Serviço</th>
                          <th className="text-left px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Sentido/Faixa</th>
                          <th className="text-center px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Retrabalho</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Comp(m)</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Larg(m)</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Área(m²)</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Esp(cm)</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap">Volume(m³)</th>
                          <th className="text-right px-3 py-2.5 border-b border-border font-semibold whitespace-nowrap bg-primary/10 text-primary">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const area = getArea(r);
                          const vol = getVol(r);
                          return (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                              <td className="px-3 py-2 border-b border-border/50 whitespace-nowrap font-medium">{fmtDate(r.data)}</td>
                              <td className="px-3 py-2 border-b border-border/50 whitespace-nowrap">{r.apontador || "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 font-medium">{r.obra_nome || "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-muted-foreground max-w-[160px] truncate" title={r.local || ""}>{r.local || "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 font-medium">{r.tipo_servico || "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-muted-foreground">{r.sentido_faixa || "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-center font-semibold">{r.is_retrabalho ? "SIM" : "NÃO"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right">{getComp(r) != null ? fmtNum(getComp(r)!) : "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right">{r.largura_m != null ? fmtNum(r.largura_m, 3) : "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right font-medium">{area != null ? fmtNum(area) : "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right">{r.espessura_cm != null ? fmtNum(r.espessura_cm, 3) : "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right">{vol != null ? fmtNum(vol, 3) : "-"}</td>
                              <td className="px-3 py-2 border-b border-border/50 text-right font-bold text-primary bg-primary/5">{area != null ? fmtNum(area) : "-"}</td>
                            </tr>
                          );
                        })}
                        {/* Linha de total */}
                        <tr className="bg-muted/50 font-bold">
                          <td colSpan={9} className="px-3 py-2.5 text-right font-bold">TOTAL GERAL</td>
                          <td className="px-3 py-2.5 text-right text-primary">{fmtNum(totalArea)}</td>
                          <td className="px-3 py-2.5"></td>
                          <td className="px-3 py-2.5"></td>
                          <td className="px-3 py-2.5 text-right text-primary bg-primary/10">{fmtNum(totalArea)} m²</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

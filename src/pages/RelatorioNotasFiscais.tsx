import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, FileText, FileSpreadsheet, Printer } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtNum(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Para CSV: ponto decimal → vírgula (padrão Excel Brasil)
function fmtNumCsv(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toFixed(2).replace(".", ",");
}

interface NfRow {
  data: string;
  apontador: string | null;
  encarregado: string | null;
  obra_nome: string;
  contratante: string | null;
  local: string | null;
  nf: string | null;
  placa: string | null;
  usina: string | null;
  tonelagem: number | null;
  tipo_material: string | null;
}

function exportarExcel(ogs: string, dataIni: string, dataFim: string, rows: NfRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Relatório de Notas Fiscais de Massa"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([]);
  linhas.push(["Data", "Apontador", "Encarregado", "OGS", "Contratante", "Local", "NF", "Placa", "Usina", "Tipo Material", "Tonelagem(t)"]);
  
  rows.forEach(r => {
    linhas.push([
      fmtDate(r.data),
      r.apontador || "-",
      r.encarregado || "-",
      r.obra_nome || "-",
      r.contratante || "-",
      r.local || "-",
      r.nf || "-",
      r.placa || "-",
      r.usina || "-",
      r.tipo_material || "-",
      r.tonelagem != null ? fmtNumCsv(r.tonelagem) : "-",
    ]);
  });
  
  const total = rows.reduce((s, r) => s + (r.tonelagem || 0), 0);
  linhas.push(["", "", "", "", "", "", "", "", "", "", fmtNumCsv(total)]);

  const csv = "\\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_NotasFiscais_${dataIni}_a_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(ogs: string, dataIni: string, dataFim: string, rows: NfRow[]) {
  const total = rows.reduce((s, r) => s + (r.tonelagem || 0), 0);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notas Fiscais de Massa</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:16px}
    .period{font-size:11px;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:4px 7px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    td{text-align:left}
    td:last-child{text-align:right}
    .total{font-weight:bold;background:#f3f4f6}
    .total td:first-child{font-weight:bold}
    .total td:last-child{font-weight:bold;color:#1a56db}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>📋 Relatório de Notas Fiscais de Massa</h1>
  <p class="period"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}</p>
  <table>
    <tr><th>Data</th><th>Apontador</th><th>Encarregado</th><th>OGS</th><th>Contratante</th><th>Local</th><th>NF</th><th>Placa</th><th>Usina</th><th>Tipo Material</th><th>Tonelagem(t)</th></tr>`;
  
  rows.forEach(r => {
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.apontador || "-"}</td>
      <td>${r.encarregado || "-"}</td>
      <td>${r.obra_nome || "-"}</td>
      <td>${r.contratante || "-"}</td>
      <td>${r.local || "-"}</td>
      <td>${r.nf || "-"}</td>
      <td>${r.placa || "-"}</td>
      <td>${r.usina || "-"}</td>
      <td>${r.tipo_material || "-"}</td>
      <td>${r.tonelagem != null ? fmtNum(r.tonelagem) : "-"}</td>
    </tr>`;
  });
  
  html += `<tr class="total">
    <td colspan="10">TOTAL</td>
    <td>${fmtNum(total)} t</td>
  </tr>`;
  html += `</table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioNotasFiscais() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [ogs, setOgs] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NfRow[]>([]);
  const [searched, setSearched] = useState(false);

  const totalTon = rows.reduce((s, r) => s + (r.tonelagem || 0), 0);

  const buscar = async () => {
    if (!dataIni || !dataFim || !profile?.company_id) return;
    setLoading(true);
    setSearched(true);
    try {
      // PASSO 1: Busca RDOs no período com filtro de company_id (RLS)
      let rdoQuery = (supabase as any)
        .from("rdo_diarios")
        .select("id, obra_nome, data, user_id, encarregado, preenchido_por")
        .eq("company_id", profile.company_id)
        .gte("data", dataIni)
        .lte("data", dataFim);

      if (ogs.trim()) rdoQuery = rdoQuery.ilike("obra_nome", `%${ogs.trim()}%`);

      const { data: rdos, error: rdoErr } = await rdoQuery;
      if (rdoErr) throw rdoErr;

      if (!rdos || rdos.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const rdoIds = rdos.map((r: any) => r.id);
      const ogsNumbers = Array.from(new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean)));
      
      const rdoMap: Record<string, any> = {};
      rdos.forEach((r: any) => { rdoMap[r.id] = r; });

      // PASSO 3: Busca OGS Reference (para Contratante e Local)
      let ogsMap: Record<string, any> = {};
      if (ogsNumbers.length > 0) {
        const { data: ogsRefs, error: ogsErr } = await (supabase as any)
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

      // PASSO 4: Busca NFs desses RDOs
      const { data: nfs, error: nfErr } = await (supabase as any)
        .from("rdo_nf_massa")
        .select("rdo_id, nf, placa, usina, tonelagem, tipo_material")
        .in("rdo_id", rdoIds);

      if (nfErr) throw nfErr;

      // PASSO 5: Montar resultado final
      const result: NfRow[] = (nfs || []).map((n: any) => {
        const rdo = rdoMap[n.rdo_id];
        const ogsRef = ogsMap[rdo?.obra_nome];
        // Apontador: usar preenchido_por (nome do quem preencheu o RDO)
        // Fallback: se preenchido_por for NULL, usa encarregado
        const apontador = rdo?.preenchido_por || rdo?.encarregado || null;
        
        return {
          data: rdo?.data || "",
          apontador,
          encarregado: rdo?.encarregado || null,
          obra_nome: rdo?.obra_nome || "",
          contratante: ogsRef?.client_name || null,
          local: ogsRef?.location_address || null,
          nf: n.nf || null,
          placa: n.placa || null,
          usina: n.usina || null,
          tonelagem: n.tonelagem != null ? parseFloat(String(n.tonelagem)) : null,
          tipo_material: n.tipo_material || null,
        };
      });

      result.sort((a, b) => b.data.localeCompare(a.data) || (a.nf || "").localeCompare(b.nf || ""));
      setRows(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Notas Fiscais de Massa</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OGS (opcional)</label>
            <Input
              value={ogs}
              onChange={e => setOgs(e.target.value)}
              placeholder="Ex: 2532 — deixe vazio para todas"
              className="h-11 bg-secondary border-border"
            />
          </div>
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
          <Button onClick={buscar} disabled={loading || !dataIni || !dataFim} className="w-full h-11 gap-2">
            <Search className="w-4 h-4" /> {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {searched && !loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">{rows.length} nota(s) encontrada(s)</p>
              {rows.length > 0 && (
                <p className="text-sm font-bold text-primary">Total: {fmtNum(totalTon)} t</p>
              )}
            </div>
            
            {rows.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-xs"
                  onClick={() => exportarExcel(ogs, dataIni, dataFim, rows)}
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-xs"
                  onClick={() => exportarPdf(ogs, dataIni, dataFim, rows)}
                >
                  <Printer className="w-4 h-4" /> Download PDF
                </Button>
              </div>
            )}
            
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma nota fiscal encontrada no período.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Apontador</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Encarregado</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">OGS</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Contratante</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Local</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">NF</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Placa</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Usina</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Tipo Material</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Ton</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-3 py-2 font-medium">{fmtDate(r.data)}</td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{r.apontador || "-"}</td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{r.encarregado || "-"}</td>
                        <td className="px-3 py-2 text-primary font-semibold text-xs">{r.obra_nome || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.contratante || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.local || "-"}</td>
                        <td className="px-3 py-2 font-bold">{r.nf || "-"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{r.placa || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.usina || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.tipo_material || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtNum(r.tonelagem)}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 border-t border-border">
                      <td colSpan={11} className="px-3 py-2 font-bold text-sm text-right">TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold text-primary">{fmtNum(totalTon)} t</td>
                    </tr>
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

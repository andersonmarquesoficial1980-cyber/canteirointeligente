import { useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
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

function fmtNumCsv(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toFixed(2).replace(".", ",");
}

interface NfConcretoRow {
  data: string;
  apontador: string | null;
  encarregado: string | null;
  empreiteiro: string | null;
  obra_nome: string;
  contratante: string | null;
  local: string | null;
  nf: string | null;
  equipamento: string | null;
  tipo_concreto: string | null;
  fornecedor: string | null;
  quantidade_m3: number | null;
}

function exportarExcel(dataIni: string, dataFim: string, rows: NfConcretoRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Relatório de Notas Fiscais de Concreto"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([]);
  linhas.push(["Data", "Apontador", "Encarregado", "Empreiteiro", "OGS", "Contratante", "Local", "NF", "Equipamento", "Tipo de Concreto", "Fornecedor", "Quantidade (m³)"]);

  rows.forEach((r) => {
    linhas.push([
      fmtDate(r.data),
      r.apontador || "-",
      r.encarregado || "-",
      r.empreiteiro || "-",
      r.obra_nome || "-",
      r.contratante || "-",
      r.local || "-",
      r.nf || "-",
      r.equipamento || "-",
      r.tipo_concreto || "-",
      r.fornecedor || "-",
      r.quantidade_m3 != null ? fmtNumCsv(r.quantidade_m3) : "-",
    ]);
  });

  const total = rows.reduce((s, r) => s + (r.quantidade_m3 || 0), 0);
  linhas.push(["", "", "", "", "", "", "", "", "", "", "TOTAL", fmtNumCsv(total)]);

  const csv = "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_NotasFiscaisConcreto_${dataIni}_a_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(dataIni: string, dataFim: string, rows: NfConcretoRow[]) {
  const total = rows.reduce((s, r) => s + (r.quantidade_m3 || 0), 0);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notas Fiscais de Concreto</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:16px}
    .period{font-size:11px;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:4px 7px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    td:last-child{text-align:right}
    .total{font-weight:bold;background:#f3f4f6}
    .total td:last-child{font-weight:bold;color:#1a56db}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>🏛️ Relatório de Notas Fiscais de Concreto</h1>
  <p class="period"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}</p>
  <table>
    <tr><th>Data</th><th>Apontador</th><th>Encarregado</th><th>Empreiteiro</th><th>OGS</th><th>Contratante</th><th>Local</th><th>NF</th><th>Equipamento</th><th>Tipo de Concreto</th><th>Fornecedor</th><th>Quantidade (m³)</th></tr>`;

  rows.forEach((r) => {
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.apontador || "-"}</td>
      <td>${r.encarregado || "-"}</td>
      <td>${r.empreiteiro || "-"}</td>
      <td>${r.obra_nome || "-"}</td>
      <td>${r.contratante || "-"}</td>
      <td>${r.local || "-"}</td>
      <td>${r.nf || "-"}</td>
      <td>${r.equipamento || "-"}</td>
      <td>${r.tipo_concreto || "-"}</td>
      <td>${r.fornecedor || "-"}</td>
      <td>${r.quantidade_m3 != null ? fmtNum(r.quantidade_m3) : "-"}</td>
    </tr>`;
  });

  html += `<tr class="total">
    <td colspan="11">TOTAL</td>
    <td>${fmtNum(total)} m³</td>
  </tr>`;
  html += `</table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioNotasFiscaisConcreto() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const [ogs, setOgs] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NfConcretoRow[]>([]);
  const [searched, setSearched] = useState(false);

  const totalM3 = rows.reduce((s, r) => s + (r.quantidade_m3 || 0), 0);

  const buscar = async () => {
    if (!dataIni || !dataFim || !profile?.company_id) return;
    setLoading(true);
    setSearched(true);
    try {
      let rdoQuery = (supabase as any)
        .from("rdo_diarios")
        .select("id, obra_nome, data, encarregado, empreiteiro, preenchido_por, tipo_rdo")
        .eq("company_id", profile.company_id)
        .gte("data", dataIni)
        .lte("data", dataFim)
        .in("tipo_rdo", ["INFRAESTRUTURA", "INFRA"]);

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
      rdos.forEach((r: any) => {
        rdoMap[r.id] = r;
      });

      let ogsMap: Record<string, any> = {};
      if (ogsNumbers.length > 0) {
        const { data: ogsRefs, error: ogsErr } = await (supabase as any)
          .from("ogs_reference")
          .select("ogs_number, client_name, location_address")
          .eq("company_id", profile.company_id!)
          .in("ogs_number", ogsNumbers);

        if (!ogsErr) {
          (ogsRefs || []).forEach((o: any) => {
            ogsMap[o.ogs_number] = o;
          });
        }
      }

      const { data: nfs, error: nfErr } = await (supabase as any)
        .from("rdo_nf_concreto")
        .select("rdo_id, nf, equipamento, quantidade_m3, tipo_concreto, fornecedor")
        .in("rdo_id", rdoIds);

      if (nfErr) throw nfErr;

      const result: NfConcretoRow[] = (nfs || []).map((n: any) => {
        const rdo = rdoMap[n.rdo_id];
        const ogsRef = ogsMap[rdo?.obra_nome];
        const apontador = rdo?.preenchido_por || rdo?.encarregado || null;

        return {
          data: rdo?.data || "",
          apontador,
          encarregado: rdo?.encarregado || null,
          empreiteiro: rdo?.empreiteiro || null,
          obra_nome: rdo?.obra_nome || "",
          contratante: ogsRef?.client_name || null,
          local: ogsRef?.location_address || null,
          nf: n.nf || null,
          equipamento: n.equipamento || null,
          tipo_concreto: n.tipo_concreto || null,
          fornecedor: n.fornecedor || null,
          quantidade_m3: n.quantidade_m3 != null ? parseFloat(String(n.quantidade_m3)) : null,
        };
      });

      result.sort((a, b) => a.data.localeCompare(b.data) || (a.nf || "").localeCompare(b.nf || ""));
      setRows(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Notas Fiscais de Concreto</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OGS (opcional)</label>
            <Input
              value={ogs}
              onChange={(e) => setOgs(e.target.value)}
              placeholder="Ex: 2532 — deixe vazio para todas"
              className="h-11 bg-secondary border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início *</label>
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim *</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
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
              {rows.length > 0 && <p className="text-sm font-bold text-primary">Total: {fmtNum(totalM3)} m³</p>}
            </div>

            {rows.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportarExcel(dataIni, dataFim, rows)}>
                  <FileSpreadsheet className="w-4 h-4" /> Download Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => exportarPdf(dataIni, dataFim, rows)}>
                  <Printer className="w-4 h-4" /> Download PDF
                </Button>
              </div>
            )}

            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma nota fiscal de concreto encontrada no período.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Apontador</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Encarregado</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Empreiteiro</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">OGS</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Contratante</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Local</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">NF</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Equipamento</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Tipo Concreto</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Fornecedor</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-medium">{fmtDate(r.data)}</td>
                          <td className="px-3 py-2 text-sm text-muted-foreground">{r.apontador || "-"}</td>
                          <td className="px-3 py-2 text-sm text-muted-foreground">{r.encarregado || "-"}</td>
                          <td className="px-3 py-2 text-sm text-muted-foreground">{r.empreiteiro || "-"}</td>
                          <td className="px-3 py-2 text-primary font-semibold text-xs">{r.obra_nome || "-"}</td>
                          <td className="px-3 py-2 text-xs">{r.contratante || "-"}</td>
                          <td className="px-3 py-2 text-xs">{r.local || "-"}</td>
                          <td className="px-3 py-2 font-bold">{r.nf || "-"}</td>
                          <td className="px-3 py-2 text-xs">{r.equipamento || "-"}</td>
                          <td className="px-3 py-2 text-xs">{r.tipo_concreto || "-"}</td>
                          <td className="px-3 py-2 text-xs">{r.fornecedor || "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmtNum(r.quantidade_m3)}</td>
                        </tr>
                      ))}
                      <tr className="bg-primary/5 border-t border-border">
                        <td colSpan={11} className="px-3 py-2 font-bold text-sm text-right">TOTAL</td>
                        <td className="px-3 py-2 text-right font-bold text-primary">{fmtNum(totalM3)} m³</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

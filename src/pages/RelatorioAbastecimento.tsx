import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoCi from "@/assets/logo-workflux.png";
import { supabase } from "@/integrations/supabase/client";

interface AbastecimentoRow {
  id: string;
  equipment_fleet: string | null;
  equipment_type: string | null;
  data: string | null;
  hora: string | null;
  litros: number | null;
  horimetro: number | null;
  km_odometro: number | null;
  ogs: string | null;
  fornecedor: string | null;
  observacao: string | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function exportarExcel(fleet: string, rows: AbastecimentoRow[], ini: string, fim: string) {
  const linhas: string[][] = [];
  linhas.push([`Relatório de Abastecimento — ${fleet === "TODAS" ? "Todas as Frotas" : `Frota ${fleet}`}`]);
  linhas.push([`Período: ${fmtDate(ini)} a ${fmtDate(fim)}`]);
  linhas.push([]);
  linhas.push(["Data", "Frota", "Tipo", "Litros", "Horímetro", "Odômetro", "OGS", "Fornecedor", "Observação"]);
  rows.forEach(r => linhas.push([
    fmtDate(r.data),
    r.equipment_fleet || "-",
    r.equipment_type || "-",
    r.litros != null ? String(r.litros.toFixed(1)) : "-",
    r.horimetro != null ? String(r.horimetro) : "-",
    r.km_odometro != null ? String(r.km_odometro) : "-",
    r.ogs || "-",
    r.fornecedor || "-",
    r.observacao || "-",
  ]));
  const total = rows.reduce((s, r) => s + (r.litros || 0), 0);
  linhas.push(["TOTAL", "", "", total.toFixed(1), "", "", "", "", ""]);

  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Abastecimento_${fleet}_${ini}_${fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(fleet: string, rows: AbastecimentoRow[], ini: string, fim: string) {
  const total = rows.reduce((s, r) => s + (r.litros || 0), 0);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Abastecimento</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:16px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:4px 7px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    .total{font-weight:bold;background:#f3f4f6}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>⛽ Relatório de Abastecimento</h1>
  <p><strong>${fleet === "TODAS" ? "Todas as Frotas" : `Frota: ${fleet}`}</strong> &nbsp;|&nbsp; Período: ${fmtDate(ini)} a ${fmtDate(fim)}</p>
  <table>
    <tr><th>Data</th><th>Frota</th><th>Tipo</th><th>Litros</th><th>Horímetro</th><th>Odômetro</th><th>OGS</th><th>Fornecedor</th></tr>`;
  rows.forEach(r => {
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.equipment_fleet || "-"}</td>
      <td>${r.equipment_type || "-"}</td>
      <td>${r.litros != null ? r.litros.toFixed(1) : "-"}</td>
      <td>${r.horimetro != null ? r.horimetro : "-"}</td>
      <td>${r.km_odometro != null ? r.km_odometro : "-"}</td>
      <td>${r.ogs || "-"}</td>
      <td>${r.fornecedor || "-"}</td>
    </tr>`;
  });
  html += `<tr class="total"><td colspan="3">TOTAL</td><td>${total.toFixed(1)} L</td><td colspan="4"></td></tr>`;
  html += `</table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioAbastecimento() {
  const navigate = useNavigate();
  const { fleet = "" } = useParams<{ fleet: string }>();
  const [searchParams] = useSearchParams();

  const iniParam = searchParams.get("ini") || "";
  const fimParam = searchParams.get("fim") || "";

  // Filtros locais (editáveis na tela)
  const today = new Date().toISOString().split("T")[0];
  const [tipoPeriodo, setTipoPeriodo] = useState<"dia" | "periodo">(iniParam === fimParam ? "dia" : "periodo");
  const [dataDia, setDataDia] = useState(iniParam || today);
  const [dataIni, setDataIni] = useState(iniParam || today);
  const [dataFim, setDataFim] = useState(fimParam || today);
  const [frotaFiltro, setFrotaFiltro] = useState(fleet === "TODAS" ? "" : fleet);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AbastecimentoRow[]>([]);
  const [frotas, setFrotas] = useState<string[]>([]);

  const ini = tipoPeriodo === "dia" ? dataDia : dataIni;
  const fim = tipoPeriodo === "dia" ? dataDia : dataFim;

  const carregar = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("abastecimentos")
      .select("id,equipment_fleet,equipment_type,data,hora,litros,horimetro,km_odometro,ogs,fornecedor,observacao")
      .gte("data", ini)
      .lte("data", fim)
      .order("data", { ascending: false })
      .order("equipment_fleet", { ascending: true });

    if (frotaFiltro) query = query.eq("equipment_fleet", frotaFiltro);

    const { data } = await query;
    const resultado = (data || []) as AbastecimentoRow[];
    setRows(resultado);

    // Montar lista de frotas únicas para o filtro
    const unicas = Array.from(new Set(resultado.map(r => r.equipment_fleet).filter(Boolean))) as string[];
    setFrotas(unicas.sort());
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const totalLitros = useMemo(() => rows.reduce((s, r) => s + (r.litros || 0), 0), [rows]);

  const fleetLabel = fleet === "TODAS" ? "Todas as Frotas" : `Frota ${fleet}`;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório Abastecimento</span>
          <span className="block text-[11px] text-primary-foreground/80">{fleetLabel}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          {/* Período */}
          <div className="flex gap-2">
            <button onClick={() => setTipoPeriodo("dia")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tipoPeriodo === "dia" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
              📅 Dia
            </button>
            <button onClick={() => setTipoPeriodo("periodo")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tipoPeriodo === "periodo" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
              📆 Período
            </button>
          </div>

          {tipoPeriodo === "dia" ? (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Data</span>
              <Input type="date" value={dataDia} onChange={e => setDataDia(e.target.value)} className="h-11 rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">De</span>
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Até</span>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
          )}

          {/* Frota */}
          {fleet === "TODAS" && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Equipamento</span>
              <select
                value={frotaFiltro}
                onChange={e => setFrotaFiltro(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm"
              >
                <option value="">Todos os equipamentos</option>
                {frotas.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          <Button onClick={carregar} className="w-full h-11 rounded-xl font-bold gap-2">
            🔍 Buscar
          </Button>
        </div>

        {/* Exportar */}
        {!loading && rows.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarPdf(fleet, rows, ini, fim)}>
              <Printer className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarExcel(fleet, rows, ini, fim)}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        )}

        {/* Resultados */}
        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum abastecimento encontrado.
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div className="rdo-card bg-primary/5 border-primary/20 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{rows.length} abastecimento{rows.length !== 1 ? "s" : ""}</span>
              <span className="text-sm font-bold text-primary">Total: {totalLitros.toFixed(1)} L</span>
            </div>

            {/* Tabela compacta */}
            <div className="rdo-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-semibold">Data</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Frota</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Litros</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Horím.</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Odôm.</th>
                      <th className="text-left py-2.5 px-3 font-semibold">OGS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="py-2 px-3 whitespace-nowrap">{fmtDate(r.data)}</td>
                        <td className="py-2 px-3 font-medium">{r.equipment_fleet || "-"}</td>
                        <td className="py-2 px-3 text-right font-semibold text-primary">{r.litros != null ? r.litros.toFixed(1) : "-"}</td>
                        <td className="py-2 px-3 text-right">{r.horimetro != null ? r.horimetro : "-"}</td>
                        <td className="py-2 px-3 text-right">{r.km_odometro != null ? r.km_odometro : "-"}</td>
                        <td className="py-2 px-3">{r.ogs || "-"}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 font-bold border-t-2 border-primary/30">
                      <td colSpan={2} className="py-2 px-3">TOTAL</td>
                      <td className="py-2 px-3 text-right text-primary">{totalLitros.toFixed(1)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

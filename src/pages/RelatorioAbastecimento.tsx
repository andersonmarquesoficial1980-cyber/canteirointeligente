import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum as fmtNumLib, fmtNumCsv as fmtNumCsvLib } from "@/lib/fmt";

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

function fmtNumLib(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "-";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Para CSV: ponto decimal → vírgula (padrão Excel Brasil)
function fmtNumCsvLib(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "-";
  return value.toFixed(decimals).replace(".", ",");
}

function splitOgs(ogs: string | null): { num: string; local: string } {
  if (!ogs) return { num: "-", local: "-" };
  const parts = ogs.split("|").map(s => s.trim());
  return { num: parts[0] || "-", local: parts[1] || "-" };
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
  linhas.push(["Data", "Frota", "Tipo", "Litros", "Horímetro", "Odômetro", "OGS", "Local", "Fornecedor", "Observação"]);
  rows.forEach(r => {
    const { num, local } = splitOgs(r.ogs);
    linhas.push([
      fmtDate(r.data),
      r.equipment_fleet || "-",
      r.equipment_type || "-",
      r.litros != null ? fmtNumCsvLib(r.litros) : "-",
      r.horimetro != null ? String(r.horimetro) : "-",
      r.km_odometro != null ? String(r.km_odometro) : "-",
      num,
      local,
      r.fornecedor || "-",
      r.observacao || "-",
    ]);
  });
  const total = rows.reduce((s, r) => s + (r.litros || 0), 0);
  linhas.push(["TOTAL", "", "", fmtNumCsvLib(total), "", "", "", "", "", ""]);

  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const frotaSuf = fleet && fleet !== "TODAS" ? `_${fleet.replace(/\s/g,"_")}` : "";
  a.download = `WF_Abastecimento${frotaSuf}_${ini}_a_${fim}.csv`;
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
    <tr><th>Data</th><th>Frota</th><th>Tipo</th><th>Litros</th><th>Horímetro</th><th>Odômetro</th><th>OGS</th><th>Local</th><th>Fornecedor</th></tr>`;
  rows.forEach(r => {
    const { num, local } = splitOgs(r.ogs);
    html += `<tr>
      <td>${fmtDate(r.data)}</td>
      <td>${r.equipment_fleet || "-"}</td>
      <td>${r.equipment_type || "-"}</td>
      <td>${r.litros != null ? fmtNumLib(r.litros) : "-"}</td>
      <td>${r.horimetro != null ? r.horimetro : "-"}</td>
      <td>${r.km_odometro != null ? r.km_odometro : "-"}</td>
      <td>${num}</td>
      <td>${local}</td>
      <td>${r.fornecedor || "-"}</td>
    </tr>`;
  });
  html += `<tr class="total"><td colspan="3">TOTAL</td><td>${fmtNumLib(total)} L</td><td colspan="5"></td></tr>`;
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
  const [searchParams] = useSearchParams();

  const iniParam = searchParams.get("ini") || "";
  const fimParam = searchParams.get("fim") || "";
  const today = new Date().toISOString().split("T")[0];
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  // Filtros
  const [tipoPeriodo, setTipoPeriodo] = useState<"dia" | "periodo">(iniParam && iniParam !== fimParam ? "periodo" : "periodo");
  const [dataDia, setDataDia] = useState(iniParam || today);
  const [dataIni, setDataIni] = useState(iniParam || primeiroDiaMes);
  const [dataFim, setDataFim] = useState(fimParam || today);

  // Seleção tipo → frota (padrão do sistema)
  const [tipoEquip, setTipoEquip] = useState("__todos__");
  const [frotaSel, setFrotaSel] = useState("__todas__");
  const [ogsFiltro, setOgsFiltro] = useState("");

  // Dados auxiliares
  const [tiposEquip, setTiposEquip] = useState<string[]>([]);
  const [frotasPorTipo, setFrotasPorTipo] = useState<Record<string, string[]>>({});

  // Resultados
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [rows, setRows] = useState<AbastecimentoRow[]>([]);

  const ini = tipoPeriodo === "dia" ? dataDia : dataIni;
  const fim = tipoPeriodo === "dia" ? dataDia : dataFim;

  // Carregar tipos e frotas do banco
  useEffect(() => {
    (supabase as any)
      .from("equipamentos")
      .select("frota,tipo")
      .in("status", ["ativo", "Operando"])
      .order("tipo")
      .order("frota")
      .then(({ data }: { data: { frota: string; tipo: string }[] | null }) => {
        if (!data) return;
        const byType: Record<string, Set<string>> = {};
        data.forEach(d => {
          const t = d.tipo || "Outros";
          if (!byType[t]) byType[t] = new Set();
          byType[t].add(d.frota);
        });
        const tipos = Object.keys(byType).sort();
        setTiposEquip(tipos);
        const frotas: Record<string, string[]> = {};
        tipos.forEach(t => { frotas[t] = Array.from(byType[t]).sort(); });
        setFrotasPorTipo(frotas);
      });
  }, []);

  // Frotas disponíveis para o tipo selecionado
  const frotasDisponiveis = tipoEquip === "__todos__"
    ? Object.values(frotasPorTipo).flat().sort()
    : (frotasPorTipo[tipoEquip] || []);

  // Reset frota quando tipo muda
  const handleTipoChange = (tipo: string) => {
    setTipoEquip(tipo);
    setFrotaSel("__todas__");
  };

  const carregar = async () => {
    setLoading(true);
    setBuscado(true);
    let query = (supabase as any)
      .from("abastecimentos")
      .select("id,equipment_fleet,equipment_type,data,hora,litros,horimetro,km_odometro,ogs,fornecedor,observacao")
      .gte("data", ini)
      .lte("data", fim)
      .order("data", { ascending: false })
      .order("equipment_fleet", { ascending: true });

    if (frotaSel !== "__todas__") {
      query = query.eq("equipment_fleet", frotaSel);
    } else if (tipoEquip !== "__todos__") {
      const frotas = frotasPorTipo[tipoEquip] || [];
      if (frotas.length > 0) query = query.in("equipment_fleet", frotas);
    }

    if (ogsFiltro.trim()) {
      query = query.ilike("ogs", `%${ogsFiltro.trim()}%`);
    }

    const { data } = await query;
    setRows((data || []) as AbastecimentoRow[]);
    setLoading(false);
  };

  const totalLitros = useMemo(() => rows.reduce((s, r) => s + (r.litros || 0), 0), [rows]);

  const labelFrota = frotaSel !== "__todas__" ? frotaSel
    : tipoEquip !== "__todos__" ? tipoEquip
    : "Todas as Frotas";

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/relatorios")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoHomeButton className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório Abastecimento</span>
          <span className="block text-[11px] text-primary-foreground/80">{labelFrota}</span>
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

          {/* Tipo de equipamento */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Tipo de equipamento</span>
            <select
              value={tipoEquip}
              onChange={e => handleTipoChange(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm"
            >
              <option value="__todos__">Todos os tipos</option>
              {tiposEquip.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Frota — só aparece se há tipos carregados */}
          {frotasDisponiveis.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                Frota {tipoEquip !== "__todos__" ? `— ${tipoEquip}` : ""}
              </span>
              <select
                value={frotaSel}
                onChange={e => setFrotaSel(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm"
              >
                <option value="__todas__">
                  {tipoEquip !== "__todos__" ? `Todas as ${tipoEquip}` : "Todas as frotas"}
                </option>
                {frotasDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Busca por OGS */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Busca por OGS (opcional)</span>
            <Input
              placeholder="Ex: 2509"
              value={ogsFiltro}
              onChange={e => setOgsFiltro(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <Button onClick={carregar} className="w-full h-11 rounded-xl font-bold gap-2">
            🔍 Buscar
          </Button>
        </div>

        {/* Exportar */}
        {!loading && rows.length > 0 && (
          <div className="flex gap-2">
            <ExportButton variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarPdf(labelFrota, rows, ini, fim)}>
              <Printer className="w-3.5 h-3.5" /> PDF
            </ExportButton>
            <ExportButton variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarExcel(labelFrota, rows, ini, fim)}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </ExportButton>
          </div>
        )}

        {/* Resultados */}
        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : !buscado ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Selecione os filtros acima e clique em Buscar.
          </div>
        ) : rows.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum abastecimento encontrado para os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div className="rdo-card bg-primary/5 border-primary/20 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{rows.length} abastecimento{rows.length !== 1 ? "s" : ""}</span>
              <span className="text-sm font-bold text-primary">Total: {fmtNumLib(totalLitros)} L</span>
            </div>

            {/* Tabela compacta */}
            <div className="rdo-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left py-2.5 px-3 font-semibold">Data</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Frota</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Tipo</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Litros</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Horím.</th>
                      <th className="text-right py-2.5 px-3 font-semibold">Odôm.</th>
                      <th className="text-left py-2.5 px-3 font-semibold">OGS</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const { num, local } = splitOgs(r.ogs);
                      return (
                        <tr key={r.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="py-2 px-3 whitespace-nowrap">{fmtDate(r.data)}</td>
                          <td className="py-2 px-3 font-medium">{r.equipment_fleet || "-"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{r.equipment_type || "-"}</td>
                          <td className="py-2 px-3 text-right font-semibold text-primary">{r.litros != null ? fmtNumLib(r.litros) : "-"}</td>
                          <td className="py-2 px-3 text-right">{r.horimetro != null ? r.horimetro : "-"}</td>
                          <td className="py-2 px-3 text-right">{r.km_odometro != null ? r.km_odometro : "-"}</td>
                          <td className="py-2 px-3 font-medium">{num}</td>
                          <td className="py-2 px-3 text-muted-foreground">{local}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/5 font-bold border-t-2 border-primary/30">
                      <td colSpan={3} className="py-2 px-3">TOTAL</td>
                      <td className="py-2 px-3 text-right text-primary">{fmtNumLib(totalLitros)}</td>
                      <td colSpan={4} />
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

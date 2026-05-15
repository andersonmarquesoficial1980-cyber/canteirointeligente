/**
 * WF Carreteiros — Relatório de Fechamento Mensal
 * Rota: /relatorios/carreteiros
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Search, Loader2, AlertTriangle, MapPin, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import * as XLSX from "xlsx";
import logoCi from "@/assets/logo-workflux.png";

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDateTime(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR");
}

function calcDuracao(saida: string | null, chegada: string | null) {
  if (!saida || !chegada) return "-";
  const diff = new Date(chegada).getTime() - new Date(saida).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

const MONTHS = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

export default function RelatorioCarreteiros() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, "0"));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [placa, setPlaca] = useState("");
  const [placas, setPlacas] = useState<string[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);

  // Carregar placas disponíveis
  useEffect(() => {
    supabase.from("trucker_trips").select("truck_plate").then(({ data }) => {
      if (data) {
        const uniq = [...new Set(data.map((r: any) => r.truck_plate).filter(Boolean))].sort();
        setPlacas(uniq);
      }
    });
  }, []);

  const buscar = async () => {
    setLoading(true);
    setBuscou(true);
    const ini = `${ano}-${mes}-01`;
    const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
    const fim = `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`;

    let query = (supabase as any)
      .from("trucker_trips")
      .select("*")
      .gte("date", ini)
      .lte("date", fim)
      .order("date", { ascending: false })
      .order("truck_plate");

    if (placa) query = query.eq("truck_plate", placa);

    const { data } = await query;
    setTrips(data || []);
    setLoading(false);
  };

  // Viagens incompletas (saída sem chegada há mais de 4h)
  const viagensIncompletas = useMemo(() => {
    const agora = Date.now();
    return trips.filter(t =>
      t.status !== "CONCLUÍDO" &&
      t.departure_time &&
      (agora - new Date(t.departure_time).getTime()) > 4 * 3600000
    );
  }, [trips]);

  // Resumo por placa
  const resumoPorPlaca = useMemo(() => {
    const map: Record<string, { viagens: number; m3: number; ogs: Set<string>; dias: Set<string>; materiais: Record<string, number> }> = {};
    trips.filter(t => t.status === "CONCLUÍDO").forEach(t => {
      const p = t.truck_plate || "-";
      if (!map[p]) map[p] = { viagens: 0, m3: 0, ogs: new Set(), dias: new Set(), materiais: {} };
      map[p].viagens++;
      map[p].m3 += Number(t.quantity) || 0;
      if (t.origin_ogs_id) map[p].ogs.add(t.origin_ogs_id);
      if (t.date) map[p].dias.add(t.date);
      const mat = t.material_type || "Outros";
      map[p].materiais[mat] = (map[p].materiais[mat] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [trips]);

  const totalViagens = resumoPorPlaca.reduce((s, [, v]) => s + v.viagens, 0);
  const totalM3 = resumoPorPlaca.reduce((s, [, v]) => s + v.m3, 0);

  function exportarExcel() {
    const wb = XLSX.utils.book_new();
    const mesLabel = MONTHS.find(m => m.v === mes)?.l || mes;

    // Aba 1: Resumo por placa
    const resumoRows: any[][] = [
      [`FECHAMENTO CARRETEIROS — ${mesLabel}/${ano}`],
      [],
      ["Placa", "Viagens", "m³ Total", "Dias Trabalhados", "OGS", "Materiais"],
      ...resumoPorPlaca.map(([p, v]) => [
        p,
        v.viagens,
        v.m3.toFixed(2),
        v.dias.size,
        [...v.ogs].join(", "),
        Object.entries(v.materiais).map(([m, n]) => `${m}(${n})`).join(", "),
      ]),
      [],
      ["TOTAL", totalViagens, totalM3.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");

    // Aba 2: Detalhe de todas as viagens
    const detalheRows: any[][] = [
      ["Data", "Placa", "Material", "Qtd (m³)", "OGS Origem", "Destino", "Saída", "Chegada", "Duração", "Status", "GPS Saída", "GPS Chegada"],
      ...trips.map(t => [
        fmtDate(t.date),
        t.truck_plate || "-",
        t.material_type || "-",
        Number(t.quantity) || 0,
        t.origin_ogs_id || "-",
        t.destination_id || "-",
        fmtDateTime(t.departure_time),
        fmtDateTime(t.arrival_time),
        calcDuracao(t.departure_time, t.arrival_time),
        t.status || "-",
        t.departure_geo || "-",
        t.arrival_geo || "-",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalheRows), "Detalhe Viagens");

    // Aba 3: Viagens incompletas
    if (viagensIncompletas.length > 0) {
      const incompRows: any[][] = [
        ["⚠️ VIAGENS SEM CHEGADA REGISTRADA"],
        [],
        ["Data", "Placa", "Material", "Qtd", "Saída", "Horas em aberto"],
        ...viagensIncompletas.map(t => {
          const h = Math.floor((Date.now() - new Date(t.departure_time).getTime()) / 3600000);
          return [fmtDate(t.date), t.truck_plate, t.material_type, t.quantity, fmtDateTime(t.departure_time), `${h}h em aberto`];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incompRows), "Incompletas");
    }

    XLSX.writeFile(wb, `Carreteiros_${mesLabel}_${ano}.xlsx`);
  }

  const mesLabel = MONTHS.find(m => m.v === mes)?.l || mes;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg print:hidden">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm text-primary-foreground">Relatório Carreteiros</span>
          <span className="block text-[10px] text-primary-foreground/70">Fechamento mensal de viagens</span>
        </div>
        {buscou && trips.length > 0 && (
          <ExportButton size="sm" onClick={exportarExcel} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </ExportButton>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mês</label>
              <select value={mes} onChange={e => setMes(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none">
                {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ano</label>
              <select value={ano} onChange={e => setAno(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none">
                {["2025", "2026", "2027"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Placa (opcional)</label>
              <select value={placa} onChange={e => setPlaca(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none">
                <option value="">Todas as placas</option>
                {placas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={buscar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Buscando..." : "Gerar Relatório"}
          </Button>
        </div>

        {buscou && !loading && (
          <>
            {/* Alerta de viagens incompletas */}
            {viagensIncompletas.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">
                    {viagensIncompletas.length} viagem{viagensIncompletas.length > 1 ? "ns" : ""} sem chegada registrada
                  </p>
                </div>
                <div className="space-y-1">
                  {viagensIncompletas.map(t => {
                    const h = Math.floor((Date.now() - new Date(t.departure_time).getTime()) / 3600000);
                    return (
                      <p key={t.id} className="text-xs text-amber-700">
                        🚛 <strong>{t.truck_plate}</strong> — saiu em {fmtDateTime(t.departure_time)} ({h}h em aberto) · {t.material_type}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {trips.length === 0 ? (
              <div className="rdo-card py-10 text-center">
                <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma viagem encontrada para {mesLabel}/{ano}.</p>
              </div>
            ) : (
              <>
                {/* Resumo geral */}
                <div className="rdo-card">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-bold text-base">{mesLabel}/{ano}</p>
                      <p className="text-xs text-muted-foreground">{placa || "Todas as placas"}</p>
                    </div>
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">{totalViagens}</p>
                        <p className="text-xs text-muted-foreground">Viagens</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{totalM3.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">m³ Total</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-muted-foreground">{resumoPorPlaca.length}</p>
                        <p className="text-xs text-muted-foreground">Placas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumo por placa */}
                <div className="rdo-card space-y-3">
                  <p className="text-sm font-semibold">Resumo por Placa</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 pr-3">Placa</th>
                          <th className="text-right py-2 pr-3">Viagens</th>
                          <th className="text-right py-2 pr-3">m³ Total</th>
                          <th className="text-right py-2 pr-3">Dias</th>
                          <th className="text-left py-2 pr-3">OGS</th>
                          <th className="text-left py-2">Materiais</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumoPorPlaca.map(([p, v]) => (
                          <tr key={p} className="border-b border-border/40">
                            <td className="py-2 pr-3 font-bold text-primary">{p}</td>
                            <td className="py-2 pr-3 text-right">{v.viagens}</td>
                            <td className="py-2 pr-3 text-right font-medium">{v.m3.toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right">{v.dias.size}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{[...v.ogs].join(", ") || "-"}</td>
                            <td className="py-2 text-muted-foreground">
                              {Object.entries(v.materiais).map(([m, n]) => (
                                <span key={m} className="inline-flex items-center mr-1 px-1.5 py-0.5 rounded bg-muted text-[10px]">{m} ({n})</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-bold">
                          <td className="py-2 pr-3">TOTAL</td>
                          <td className="py-2 pr-3 text-right">{totalViagens}</td>
                          <td className="py-2 pr-3 text-right">{totalM3.toFixed(2)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Detalhe de viagens */}
                <div className="rdo-card space-y-3">
                  <p className="text-sm font-semibold">Detalhe das Viagens</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 pr-3">Data</th>
                          <th className="text-left py-2 pr-3">Placa</th>
                          <th className="text-left py-2 pr-3">Material</th>
                          <th className="text-right py-2 pr-3">m³</th>
                          <th className="text-left py-2 pr-3">OGS</th>
                          <th className="text-left py-2 pr-3">Destino</th>
                          <th className="text-left py-2 pr-3">Saída</th>
                          <th className="text-left py-2 pr-3">Chegada</th>
                          <th className="text-right py-2 pr-3">Duração</th>
                          <th className="text-left py-2">GPS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map(t => (
                          <tr key={t.id} className="border-b border-border/40">
                            <td className="py-2 pr-3">{fmtDate(t.date)}</td>
                            <td className="py-2 pr-3 font-medium">{t.truck_plate || "-"}</td>
                            <td className="py-2 pr-3">{t.material_type || "-"}</td>
                            <td className="py-2 pr-3 text-right">{Number(t.quantity).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{t.origin_ogs_id || "-"}</td>
                            <td className="py-2 pr-3">{t.destination_id || "-"}</td>
                            <td className="py-2 pr-3">{t.departure_time ? new Date(t.departure_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                            <td className="py-2 pr-3">{t.arrival_time ? new Date(t.arrival_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : <span className="text-amber-500 font-medium">Em trânsito</span>}</td>
                            <td className="py-2 pr-3 text-right">{calcDuracao(t.departure_time, t.arrival_time)}</td>
                            <td className="py-2">
                              {t.departure_geo ? (
                                <a href={`https://maps.google.com/?q=${t.departure_geo}`} target="_blank" rel="noopener noreferrer">
                                  <MapPin className="w-3.5 h-3.5 text-primary" />
                                </a>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/**
 * WF Medições — Fechamento de medição de equipamentos terceirizados
 * Rota: /medicoes
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import * as XLSX from "xlsx";
import logoCi from "@/assets/logo-workflux.png";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function getDaysInRange(ini: string, fim: string): string[] {
  const days: string[] = [];
  const cur = new Date(ini + "T00:00:00");
  const end = new Date(fim + "T00:00:00");
  while (cur <= end) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const STATUS_LABEL: Record<string, string> = {
  "Trabalhando": "T",
  "Trabalhando ": "T",
  "Parado": "P",
  "Manutenção": "M",
  "Mobilização": "Mob",
  "Folga": "F",
  "À Disposição": "D",
};

const STATUS_COR: Record<string, string> = {
  "T": "bg-green-100 text-green-700",
  "P": "bg-red-100 text-red-600",
  "M": "bg-yellow-100 text-yellow-700",
  "Mob": "bg-blue-100 text-blue-600",
  "F": "bg-gray-100 text-gray-500",
  "D": "bg-orange-100 text-orange-600",
};

export default function MedicoesHome() {
  const navigate = useNavigate();

  // Período padrão: mês atual
  const hoje = new Date();
  const anoAtual = String(hoje.getFullYear());
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  const [ini, setIni] = useState(`${anoAtual}-${mesAtual}-01`);
  const [fim, setFim] = useState(`${anoAtual}-${mesAtual}-${String(lastDay).padStart(2, "0")}`);
  const [fornecedorSel, setFornecedorSel] = useState("");
  const [fornecedores, setFornecedores] = useState<string[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [diarios, setDiarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  // Carregar fornecedores terceiros disponíveis
  useEffect(() => {
    supabase
      .from("maquinas_frota")
      .select("empresa")
      .neq("empresa", "PRÓPRIO")
      .neq("empresa", "")
      .then(({ data }) => {
        if (data) {
          const uniq = [...new Set(data.map((r: any) => r.empresa).filter(Boolean))].sort();
          setFornecedores(uniq);
        }
      });
  }, []);

  const buscar = async () => {
    if (!fornecedorSel) return;
    setLoading(true);
    setBuscou(true);

    // Pegar equipamentos do fornecedor
    const { data: equips } = await supabase
      .from("maquinas_frota")
      .select("frota, nome, tipo, empresa")
      .eq("empresa", fornecedorSel)
      .order("tipo")
      .order("frota");

    const frotas = (equips || []).map((e: any) => e.frota);
    setEquipamentos(equips || []);

    if (frotas.length === 0) {
      setDiarios([]);
      setLoading(false);
      return;
    }

    // Pegar diários do período para essas frotas
    const { data: diariosData } = await (supabase as any)
      .from("equipment_diaries")
      .select("id, date, equipment_fleet, equipment_type, work_status, operator_name, ogs_number, client_name, meter_initial, meter_final, odometer_initial, odometer_final")
      .in("equipment_fleet", frotas)
      .gte("date", ini)
      .lte("date", fim)
      .order("date");

    setDiarios(diariosData || []);
    // Expandir todos por padrão
    const exp: Record<string, boolean> = {};
    frotas.forEach(f => { exp[f] = true; });
    setExpandido(exp);
    setLoading(false);
  };

  // Organizar diários por frota e por data
  const diariosPorFrota = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    diarios.forEach((d: any) => {
      if (!map[d.equipment_fleet]) map[d.equipment_fleet] = {};
      map[d.equipment_fleet][d.date] = d;
    });
    return map;
  }, [diarios]);

  const days = useMemo(() => getDaysInRange(ini, fim), [ini, fim]);

  // Totais por equipamento
  function getTotais(frota: string) {
    const byDate = diariosPorFrota[frota] || {};
    let trabalhados = 0;
    let horas = 0;
    days.forEach(d => {
      const diary = byDate[d];
      if (!diary) return;
      const s = diary.work_status || "";
      if (s.includes("Trabalh")) trabalhados++;
      const ini = diary.meter_initial ?? diary.odometer_initial;
      const fim = diary.meter_final ?? diary.odometer_final;
      if (typeof ini === "number" && typeof fim === "number" && fim > ini) {
        horas += fim - ini;
      }
    });
    return { trabalhados, horas };
  }

  function exportarExcel() {
    if (!buscou || equipamentos.length === 0) return;
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];

    // Cabeçalho
    rows.push([`MEDIÇÃO — ${fornecedorSel}`]);
    rows.push([`Período: ${fmtDate(ini)} a ${fmtDate(fim)}`]);
    rows.push([]);

    // Header da tabela: Frota | Tipo | dia1 | dia2 | ... | Total Dias | Total Horas
    const header = ["Frota", "Tipo/Nome", ...days.map(d => fmtDate(d).slice(0, 5)), "Dias Trab.", "Horas"];
    rows.push(header);

    equipamentos.forEach((eq: any) => {
      const byDate = diariosPorFrota[eq.frota] || {};
      const { trabalhados, horas } = getTotais(eq.frota);
      const row: any[] = [eq.frota, `${eq.nome} (${eq.tipo})`];
      days.forEach(d => {
        const diary = byDate[d];
        if (!diary) { row.push("-"); return; }
        const s = diary.work_status || "";
        const lbl = STATUS_LABEL[s] || s.slice(0, 3);
        row.push(lbl);
      });
      row.push(trabalhados);
      row.push(horas > 0 ? horas.toFixed(1) : "-");
      rows.push(row);
    });

    // Legenda
    rows.push([]);
    rows.push(["Legenda:", "T = Trabalhando", "P = Parado", "M = Manutenção", "F = Folga", "D = À Disposição", "Mob = Mobilização"]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Medição");

    // Aba 2: Detalhamento por OGS
    const ogsRows: any[][] = [];
    ogsRows.push([`DETALHAMENTO POR OGS — ${fornecedorSel}`]);
    ogsRows.push([`Período: ${fmtDate(ini)} a ${fmtDate(fim)}`]);
    ogsRows.push([]);
    ogsRows.push(["Frota", "Tipo", "Data", "Status", "OGS", "Cliente", "Local", "Operador", "Horas/KM"]);

    equipamentos.forEach((eq: any) => {
      const byDate = diariosPorFrota[eq.frota] || {};
      days.forEach(d => {
        const diary = byDate[d];
        if (!diary) return;
        const marcIni = diary.meter_initial ?? diary.odometer_initial;
        const marcFim = diary.meter_final ?? diary.odometer_final;
        const diff = typeof marcIni === "number" && typeof marcFim === "number" && marcFim > marcIni
          ? (marcFim - marcIni).toFixed(1) : "-";
        ogsRows.push([
          eq.frota,
          eq.tipo,
          fmtDate(d),
          diary.work_status || "-",
          diary.ogs_number || "-",
          diary.client_name || "-",
          diary.location_address || "-",
          diary.operator_name || "-",
          diff,
        ]);
      });
    });

    // Aba 3: Resumo por OGS (custo por obra)
    const ogsResumoRows: any[][] = [];
    ogsResumoRows.push([`RESUMO POR OGS — ${fornecedorSel}`]);
    ogsResumoRows.push([`Período: ${fmtDate(ini)} a ${fmtDate(fim)}`]);
    ogsResumoRows.push([]);
    ogsResumoRows.push(["OGS", "Cliente", "Frota", "Tipo", "Dias Trabalhados", "Horas/KM Total"]);

    // Agrupar por OGS + frota
    const ogsMap: Record<string, Record<string, { dias: number; horas: number; cliente: string }>> = {};
    equipamentos.forEach((eq: any) => {
      const byDate = diariosPorFrota[eq.frota] || {};
      days.forEach(d => {
        const diary = byDate[d];
        if (!diary || !diary.work_status?.includes("Trabalh")) return;
        const ogs = diary.ogs_number || "SEM OGS";
        const cliente = diary.client_name || "-";
        if (!ogsMap[ogs]) ogsMap[ogs] = {};
        if (!ogsMap[ogs][eq.frota]) ogsMap[ogs][eq.frota] = { dias: 0, horas: 0, cliente };
        ogsMap[ogs][eq.frota].dias++;
        const marcIni = diary.meter_initial ?? diary.odometer_initial;
        const marcFim = diary.meter_final ?? diary.odometer_final;
        if (typeof marcIni === "number" && typeof marcFim === "number" && marcFim > marcIni) {
          ogsMap[ogs][eq.frota].horas += marcFim - marcIni;
        }
      });
    });

    Object.entries(ogsMap).sort().forEach(([ogs, frotas]) => {
      Object.entries(frotas).forEach(([frota, info]) => {
        const eq = equipamentos.find((e: any) => e.frota === frota);
        ogsResumoRows.push([
          ogs,
          info.cliente,
          frota,
          eq?.tipo || "-",
          info.dias,
          info.horas > 0 ? info.horas.toFixed(1) : "-",
        ]);
      });
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ogsRows), "Detalhe por OGS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ogsResumoRows), "Resumo por OGS");
    XLSX.writeFile(wb, `Medicao_${fornecedorSel.replace(/\s+/g, "_")}_${ini.slice(0, 7)}.xlsx`);
  }

  const totalDiasTrabalhados = useMemo(() => {
    return equipamentos.reduce((acc, eq) => acc + getTotais(eq.frota).trabalhados, 0);
  }, [equipamentos, diariosPorFrota, days]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg print:hidden">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm text-primary-foreground">WF Medições</span>
          <span className="block text-[10px] text-primary-foreground/70">Fechamento de equipamentos terceirizados</span>
        </div>
        {buscou && equipamentos.length > 0 && (
          <ExportButton size="sm" onClick={exportarExcel} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </ExportButton>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Fornecedor */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fornecedor / Proprietário</label>
              <select
                value={fornecedorSel}
                onChange={e => setFornecedorSel(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione o fornecedor</option>
                {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Período */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <input type="date" value={ini} onChange={e => setIni(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
          </div>

          <Button onClick={buscar} disabled={loading || !fornecedorSel} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Buscando..." : "Gerar Medição"}
          </Button>
        </div>

        {/* Resultado */}
        {buscou && !loading && (
          <>
            {equipamentos.length === 0 ? (
              <div className="rdo-card py-8 text-center text-sm text-muted-foreground">
                Nenhum equipamento encontrado para {fornecedorSel}.
              </div>
            ) : (
              <>
                {/* Resumo */}
                <div className="rdo-card">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-display font-bold text-base">{fornecedorSel}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(ini)} a {fmtDate(fim)} · {equipamentos.length} equipamento{equipamentos.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">{equipamentos.length}</p>
                        <p className="text-xs text-muted-foreground">Equipamentos</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{totalDiasTrabalhados}</p>
                        <p className="text-xs text-muted-foreground">Dias Trabalhados</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-muted-foreground">{days.length}</p>
                        <p className="text-xs text-muted-foreground">Dias no Período</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela por equipamento */}
                {equipamentos.map((eq: any) => {
                  const byDate = diariosPorFrota[eq.frota] || {};
                  const { trabalhados, horas } = getTotais(eq.frota);
                  const isExp = expandido[eq.frota];

                  return (
                    <div key={eq.frota} className="rdo-card space-y-3">
                      {/* Header do equipamento */}
                      <button
                        className="w-full flex items-center justify-between"
                        onClick={() => setExpandido(prev => ({ ...prev, [eq.frota]: !prev[eq.frota] }))}
                      >
                        <div className="text-left">
                          <p className="font-display font-bold text-sm text-primary">{eq.frota} — {eq.nome}</p>
                          <p className="text-xs text-muted-foreground">{eq.tipo}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-sm font-bold text-green-600">{trabalhados} dias trabalhados</span>
                            {horas > 0 && <span className="text-xs text-muted-foreground ml-2">· {horas.toFixed(1)}h</span>}
                          </div>
                          {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {/* Calendário de dias */}
                      {isExp && (
                        <div className="overflow-x-auto">
                          <div className="flex gap-1 min-w-max flex-wrap">
                            {days.map(d => {
                              const diary = byDate[d];
                              const s = diary?.work_status || "";
                              const lbl = diary ? (STATUS_LABEL[s] || s.slice(0, 3) || "?") : "—";
                              const cor = diary ? (STATUS_COR[lbl] || "bg-gray-100 text-gray-500") : "bg-muted text-muted-foreground/40";
                              const dayNum = d.split("-")[2];
                              const ogs = diary?.ogs_number;
                              return (
                                <div key={d} className="flex flex-col items-center gap-0.5" title={diary ? `${fmtDate(d)}\nStatus: ${s}\nOGS: ${ogs || "-"}\nOperador: ${diary.operator_name || "-"}` : fmtDate(d)}>
                                  <span className="text-[9px] text-muted-foreground">{dayNum}</span>
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${cor}`}>
                                    {lbl}
                                  </div>
                                  {ogs && <span className="text-[8px] text-muted-foreground/60">{ogs}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Resumo por OGS */}
                      {isExp && trabalhados > 0 && (() => {
                        const ogsResumo: Record<string, { dias: number; cliente: string; horas: number }> = {};
                        days.forEach(d => {
                          const diary = byDate[d];
                          if (!diary || !diary.work_status?.includes("Trabalh")) return;
                          const ogs = diary.ogs_number || "SEM OGS";
                          if (!ogsResumo[ogs]) ogsResumo[ogs] = { dias: 0, cliente: diary.client_name || "-", horas: 0 };
                          ogsResumo[ogs].dias++;
                          const mIni = diary.meter_initial ?? diary.odometer_initial;
                          const mFim = diary.meter_final ?? diary.odometer_final;
                          if (typeof mIni === "number" && typeof mFim === "number" && mFim > mIni) ogsResumo[ogs].horas += mFim - mIni;
                        });
                        return (
                          <div className="bg-blue-50 rounded-xl px-3 py-2 space-y-1">
                            <p className="text-xs font-semibold text-blue-700">Resumo por OGS</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {Object.entries(ogsResumo).sort().map(([ogs, info]) => (
                                <div key={ogs} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-1.5 border border-blue-100">
                                  <div>
                                    <span className="font-bold text-primary">OGS {ogs}</span>
                                    <span className="text-muted-foreground ml-2">{info.cliente}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold text-green-600">{info.dias} dias</span>
                                    {info.horas > 0 && <span className="text-muted-foreground ml-1">· {info.horas.toFixed(1)}h</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Detalhes dos dias trabalhados */}
                      {isExp && trabalhados > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th className="text-left py-1.5 pr-3">Data</th>
                                <th className="text-left py-1.5 pr-3">Status</th>
                                <th className="text-left py-1.5 pr-3">Operador</th>
                                <th className="text-left py-1.5 pr-3">OGS</th>
                                <th className="text-left py-1.5 pr-3">Cliente</th>
                                <th className="text-right py-1.5">Horas/KM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {days
                                .filter(d => byDate[d])
                                .map(d => {
                                  const diary = byDate[d];
                                  const marcIni = diary.meter_initial ?? diary.odometer_initial;
                                  const marcFim = diary.meter_final ?? diary.odometer_final;
                                  const diff = typeof marcIni === "number" && typeof marcFim === "number" && marcFim > marcIni
                                    ? (marcFim - marcIni).toFixed(1)
                                    : "-";
                                  return (
                                    <tr key={d} className="border-b border-border/40">
                                      <td className="py-1.5 pr-3">{fmtDate(d)}</td>
                                      <td className="py-1.5 pr-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COR[STATUS_LABEL[diary.work_status || ""] || ""] || "bg-muted"}`}>
                                          {diary.work_status || "-"}
                                        </span>
                                      </td>
                                      <td className="py-1.5 pr-3">{diary.operator_name || "-"}</td>
                                      <td className="py-1.5 pr-3">{diary.ogs_number || "-"}</td>
                                      <td className="py-1.5 pr-3">{diary.client_name || "-"}</td>
                                      <td className="py-1.5 text-right">{diff}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border font-semibold">
                                <td colSpan={5} className="py-1.5 pr-3">Total</td>
                                <td className="py-1.5 text-right text-green-600">{trabalhados} dias{horas > 0 ? ` · ${horas.toFixed(1)}h` : ""}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Legenda */}
                <div className="rdo-card">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Legenda</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_COR).map(([k, cor]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded ${cor}`}>
                        {k} = {Object.entries(STATUS_LABEL).find(([, v]) => v === k)?.[0] || k}
                      </span>
                    ))}
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

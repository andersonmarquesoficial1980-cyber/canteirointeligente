import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import logoCi from "@/assets/logo-workflux.png";
import { buildCarretaEmailReport } from "@/lib/buildEquipmentEmailReport";
import { useOgsReference } from "@/hooks/useOgsReference";
import { fmtNum } from "@/lib/fmt";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function fmtNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(decimals);
}

function calculateWorkedHours(timeEntries: any[]) {
  const PARADAS = ["Refeições", "À Disposição", "Manutenção"];
  let total = 0;
  (timeEntries || []).forEach((t: any) => {
    if (!t?.start_time || !t?.end_time) return;
    if (PARADAS.includes(t.activity || "")) return;
    const [sh, sm] = String(t.start_time).split(":").map(Number);
    const [eh, em] = String(t.end_time).split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return;
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    total += diff / 60;
  });
  return total > 0 ? Math.round(total * 10) / 10 : null;
}

// description salva equipamentos como texto: "CP05" ou "PN49, CH33" ou "VAZIO"
function parseEquipamentos(desc: string | null): [string, string, string] {
  if (!desc || desc.toUpperCase() === "VAZIO") return ["", "", ""];
  const parts = desc.split(",").map((s: string) => s.trim()).filter(Boolean);
  return [parts[0] || "", parts[1] || "", parts[2] || ""];
}

// Mapeia time_entry do banco para TimeEntry do buildCarretaEmailReport
function mapTimeEntry(row: any) {
  const [eq1, eq2, eq3] = parseEquipamentos(row.description);
  return {
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    activity: row.activity || "",
    isParada: false,
    origin: row.origin || "",
    destination: row.destination || "",
    transportOgs: row.ogs_destination || "",
    transportEquip1: eq1,
    transportEquip1Custom: "",
    transportEquip2: eq2,
    transportEquip2Custom: "",
    transportEquip3: eq3,
    transportEquip3Custom: "",
    transportObs: "",
    returnReason: "",
    returnDetails: "",
    transportInternalDetails: "",
    maintenanceDetails: "",
  };
}

// ─── Exportar Excel (período) ─────────────────────────────────────────────────
async function exportarExcelPeriodo(ini: string, fim: string, ogsData: any[]) {
  const { data: diaries } = await supabase
    .from("equipment_diaries" as any)
    .select("*")
    .eq("equipment_type", "Carreta")
    .gte("date", ini)
    .lte("date", fim)
    .order("date", { ascending: true });

  if (!diaries || diaries.length === 0) {
    alert("Nenhum transporte de carreta no período selecionado.");
    return;
  }

  const ids = (diaries as any[]).map(d => d.id);
  const { data: allEntries } = await supabase
    .from("equipment_time_entries")
    .select("*")
    .in("diary_id", ids);

  const entriesByDiary: Record<string, any[]> = {};
  (allEntries || []).forEach((e: any) => {
    if (!entriesByDiary[e.diary_id]) entriesByDiary[e.diary_id] = [];
    entriesByDiary[e.diary_id].push(e);
  });

    // Usa endereço já embutido no campo (formato: "2534 | AV GENERAL...") em vez de buscar no lookup
  const resolveAddr = (raw: string) => {
    if (!raw) return "";
    if (raw.toUpperCase().includes("BASE")) return "PÁTIO CENTRAL / OFICINA";
    if (raw.includes("|")) return raw.split("|").slice(1).join("|").trim();
    return raw;
  };

  const linhas: string[][] = [
    ["Data", "Cavalo Mecânico", "Prancha", "Operador", "Turno",
     "KM Inicial", "KM Final", "KM Percorrido",
     "Equip. 01", "Equip. 02", "Equip. 03",
     "OGS Origem", "Endereço Origem", "OGS Destino", "Endereço Destino",
     "Horário Início", "Horário Fim", "Atividade", "Observações"]
  ];

  (diaries as any[]).forEach(d => {
    const entries = entriesByDiary[d.id] || [];
    const kmIni = Number(d.odometer_initial) || 0;
    const kmFin = Number(d.odometer_final) || 0;
    const kmPerc = kmFin - kmIni;
    const prancha = d.attachment_type || "";

    if (entries.length === 0) {
      linhas.push([
        fmtDate(d.date), d.equipment_fleet, prancha, d.operator_name, d.period,
        kmIni > 0 ? String(kmIni) : "", kmFin > 0 ? String(kmFin) : "", kmPerc > 0 ? String(kmPerc) : "",
        "", "", "", "", "", "", "", "", "", "", d.observations || ""
      ]);
    } else {
      entries.forEach(e => {
        const [eq1, eq2, eq3] = parseEquipamentos(e.description);
        const origNum = (e.origin || "").toUpperCase().includes("BASE") ? "BASE" : ((e.origin || "").includes("|") ? (e.origin || "").split("|")[0].trim() : (e.origin || "").split(" ")[0]);
        const destNum = (e.destination || "").toUpperCase().includes("BASE") ? "BASE" : ((e.destination || "").includes("|") ? (e.destination || "").split("|")[0].trim() : (e.destination || "").split(" ")[0]);
        const obs = "";
        linhas.push([
          fmtDate(d.date), d.equipment_fleet, prancha, d.operator_name, d.period,
          kmIni > 0 ? String(kmIni) : "", kmFin > 0 ? String(kmFin) : "", kmPerc > 0 ? String(kmPerc) : "",
          eq1, eq2, eq3,
          origNum, resolveAddr(e.origin), destNum, resolveAddr(e.destination),
          e.start_time || "", e.end_time || "", e.activity || "", obs
        ]);
      });
    }
  });

  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Transportes_Carreta_${ini}_a_${fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function VisualizarLancamento() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: ogsData = [] } = useOgsReference();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diary, setDiary] = useState<any | null>(null);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [bits, setBits] = useState<any[]>([]);

  // Para exportar período (só carreta)
  const [iniPeriodo, setIniPeriodo] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [fimPeriodo, setFimPeriodo] = useState(() => new Date().toISOString().split("T")[0]);
  const [exportandoPeriodo, setExportandoPeriodo] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) { setError("Lançamento não informado."); setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const [
          { data: diaryRow, error: diaryError },
          { data: timeRows, error: timeError },
          { data: areaRows },
          { data: bitRows },
        ] = await Promise.all([
          (supabase as any).from("equipment_diaries").select("*").eq("id", id).maybeSingle(),
          supabase.from("equipment_time_entries").select("*").eq("diary_id", id).order("start_time"),
          supabase.from("equipment_production_areas").select("*").eq("diary_id", id),
          supabase.from("bit_entries").select("*").eq("diary_id", id),
        ]);
        if (diaryError) throw diaryError;
        if (timeError) throw timeError;
        if (!diaryRow) { setError("Lançamento não encontrado."); setDiary(null); return; }
        setDiary(diaryRow);
        setTimeEntries(timeRows || []);
        setAreas(areaRows || []);
        setBits(bitRows || []);
      } catch (err: any) {
        setError(err?.message || "Erro ao carregar lançamento.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const horasTrabalhadas = useMemo(() => {
    // Primeiro tenta calcular pelas time entries
    const fromEntries = calculateWorkedHours(timeEntries);
    if (fromEntries !== null) return fromEntries;
    // Fallback: horímetro final - inicial
    if (diary?.meter_initial != null && diary?.meter_final != null) {
      const diff = Number(diary.meter_final) - Number(diary.meter_initial);
      if (diff > 0) return Math.round(diff * 10) / 10;
    }
    // Fallback: odômetro final - inicial
    if (diary?.odometer_initial != null && diary?.odometer_final != null) {
      const diff = Number(diary.odometer_final) - Number(diary.odometer_initial);
      if (diff > 0) return Math.round(diff * 10) / 10;
    }
    return null;
  }, [timeEntries, diary]);
  const isCarreta = diary?.equipment_type === "Carreta";

  // Gerar HTML do relatório de carreta
  const carretaHtml = useMemo(() => {
    if (!isCarreta || !diary) return "";
    return buildCarretaEmailReport({
      fleet: diary.equipment_fleet || "",
      prancha: diary.attachment_type || "",
      date: diary.date || "",
      operator: diary.operator_name || "",
      turno: diary.period || "",
      odometerInitial: String(diary.odometer_initial || ""),
      odometerFinal: String(diary.odometer_final || ""),
      timeEntries: timeEntries.map(mapTimeEntry),
      observations: diary.observations || "",
      ogsData: ogsData as any[],
    });
  }, [isCarreta, diary, timeEntries, ogsData]);

  const exportarPdf = () => {
    if (!carretaHtml) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(carretaHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg print:hidden">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Visualizar Lançamento</span>
          <span className="block text-[11px] text-primary-foreground/80">{diary ? `${diary.equipment_fleet} • ${diary.date?.split('-').reverse().join('/')}` : 'Somente leitura'}</span>
        </div>
        {diary && !isCarreta && (
          <ExportButton size="sm" onClick={() => window.print()} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
            <Printer className="w-4 h-4" /> PDF
          </ExportButton>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="rdo-card py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rdo-card py-8 text-sm text-destructive">{error}</div>
        ) : !diary ? (
          <div className="rdo-card py-8 text-sm text-muted-foreground">Lançamento não encontrado.</div>
        ) : isCarreta ? (
          /* ── CARRETA: relatório completo ── */
          <>
            {/* Botões de exportação */}
            <div className="flex gap-2 flex-wrap">
              <ExportButton variant="outline" size="sm" className="gap-2 text-xs" onClick={exportarPdf}>
                <Printer className="w-3.5 h-3.5" /> Exportar PDF
              </ExportButton>
            </div>

            {/* Exportar por período */}
            <div className="rdo-card space-y-3">
              <p className="text-xs font-semibold text-foreground">📊 Exportar todos os transportes por período</p>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">De</label>
                  <input type="date" value={iniPeriodo} onChange={e => setIniPeriodo(e.target.value)}
                    className="h-9 text-xs bg-background border border-border rounded-lg px-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Até</label>
                  <input type="date" value={fimPeriodo} onChange={e => setFimPeriodo(e.target.value)}
                    className="h-9 text-xs bg-background border border-border rounded-lg px-2" />
                </div>
                <ExportButton variant="outline" size="sm" className="gap-2 text-xs h-9"
                  disabled={exportandoPeriodo}
                  onClick={async () => {
                    setExportandoPeriodo(true);
                    await exportarExcelPeriodo(iniPeriodo, fimPeriodo, ogsData as any[]);
                    setExportandoPeriodo(false);
                  }}>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {exportandoPeriodo ? "Gerando..." : "Exportar Excel do Período"}
                </ExportButton>
              </div>
            </div>

            {/* Relatório renderizado */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              <iframe
                srcDoc={carretaHtml}
                className="w-full"
                style={{ minHeight: "600px", border: "none" }}
                title="Relatório de Carreta"
              />
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>← Voltar</Button>
          </>
        ) : (
          /* ── OUTROS EQUIPAMENTOS: visualização padrão ── */
          <>
            {/* Cabeçalho do diário */}
            <div className="rdo-card space-y-1 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <p><span className="text-muted-foreground">Frota:</span> <strong>{diary.equipment_fleet || "-"}</strong></p>
                <p><span className="text-muted-foreground">Tipo de Equipamento:</span> <strong>{diary.equipment_type || "-"}</strong></p>
                <p><span className="text-muted-foreground">Data:</span> <strong>{fmtDate(diary.date)}</strong></p>
                <p><span className="text-muted-foreground">Turno:</span> <strong>{diary.period || "-"}</strong></p>
                <p><span className="text-muted-foreground">Operador:</span> <strong>{diary.operator_name || "-"}</strong></p>
                {diary.operator_solo && <p><span className="text-muted-foreground">Auxiliar/Solo:</span> <strong>{diary.operator_solo}</strong></p>}
                <p><span className="text-muted-foreground">OGS:</span> <strong>{diary.ogs_number || "-"}</strong></p>
                <p><span className="text-muted-foreground">Cliente:</span> <strong>{diary.client_name || "-"}</strong></p>
                {diary.location_address && <p><span className="text-muted-foreground">Local/Endereço:</span> <strong>{diary.location_address}</strong></p>}
                {(diary.meter_initial != null || diary.meter_final != null) && (
                  <p><span className="text-muted-foreground">Horímetro Inicial:</span> <strong>{diary.meter_initial ?? "-"}</strong> <span className="text-muted-foreground">→ Final:</span> <strong>{diary.meter_final ?? "-"}</strong></p>
                )}
                {(diary.odometer_initial != null || diary.odometer_final != null) && (
                  <p><span className="text-muted-foreground">Odômetro Inicial:</span> <strong>{diary.odometer_initial ?? "-"}</strong> <span className="text-muted-foreground">→ Final:</span> <strong>{diary.odometer_final ?? "-"}</strong></p>
                )}
                <p><span className="text-muted-foreground">Status:</span> <strong>{diary.work_status || diary.status || "-"}</strong></p>
                <p><span className="text-muted-foreground">Observações:</span> <strong>{diary.observations || "-"}</strong></p>
              </div>
              {diary.created_at && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  Lançado por: <strong>{diary.operator_name || "-"}</strong> em {new Date(diary.created_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>

            {/* Apontamento de Horas */}
            {timeEntries.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-semibold">Apontamento de Horas</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1.5 pr-3">Início</th>
                        <th className="text-left py-1.5 pr-3">Término</th>
                        <th className="text-left py-1.5 pr-3">Atividade</th>
                        <th className="text-left py-1.5 pr-3">Descrição</th>
                        <th className="text-left py-1.5 pr-3">Origem</th>
                        <th className="text-left py-1.5">Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeEntries.map((t: any) => (
                        <tr key={t.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-3">{t.start_time || "-"}</td>
                          <td className="py-1.5 pr-3">{t.end_time || "-"}</td>
                          <td className="py-1.5 pr-3">{t.activity || "-"}</td>
                          <td className="py-1.5 pr-3">{t.description || "-"}</td>
                          <td className="py-1.5 pr-3">{t.origin || "-"}</td>
                          <td className="py-1.5">{t.destination || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Produção / Fresagem — só para Fresadora */}
            {diary.equipment_type === "Fresadora" && areas.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-semibold">Produção / Fresagem</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1.5 pr-3">#</th>
                        <th className="text-right py-1.5 pr-3">Comprimento (m)</th>
                        <th className="text-right py-1.5 pr-3">Largura (m)</th>
                        <th className="text-right py-1.5 pr-3">Espessura (cm)</th>
                        <th className="text-right py-1.5 pr-3">Área (m²)</th>
                        <th className="text-right py-1.5">Volume (m³)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areas.map((a: any, idx: number) => (
                        <tr key={a.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-3">{idx + 1}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNumber(a.length_m, 2)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNumber(a.width_m, 2)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNumber(a.thickness_cm, 2)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmtNumber(a.m2, 2)}</td>
                          <td className="py-1.5 text-right">{fmtNumber(a.m3, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-semibold">
                        <td className="py-1.5 pr-3" colSpan={4}>Totais</td>
                        <td className="py-1.5 pr-3 text-right">{fmtNumber(areas.reduce((s: number, a: any) => s + (Number(a.m2) || 0), 0), 2)}</td>
                        <td className="py-1.5 text-right">{fmtNumber(areas.reduce((s: number, a: any) => s + (Number(a.m3) || 0), 0), 2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Bits Lançados — só para Fresadora */}
            {diary.equipment_type === "Fresadora" && (
            <div className="rdo-card space-y-2">
              <p className="text-sm font-semibold">Bits Lançados</p>
              {bits.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum bit registrado.</p>
              ) : (
                <div className="space-y-1">
                  {bits.map((b: any) => (
                    <div key={b.id} className="text-xs border-b border-border/40 py-1">
                      {`${b.quantity || "-"}x ${b.brand || "-"} — ${b.status || "-"}${b.horimeter ? ` — Horímetro ${b.horimeter}` : ""}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Abastecimento */}
            <div className="rdo-card space-y-2">
              <p className="text-sm font-semibold">Abastecimento</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <p><span className="text-muted-foreground">Tipo combustível:</span> {diary.fuel_type || "-"}</p>
                <p><span className="text-muted-foreground">Litros:</span> {fmtNumber(diary.fuel_liters, 2)}</p>
                <p><span className="text-muted-foreground">Horímetro abastecimento:</span> {diary.fuel_meter ? String(diary.fuel_meter) : "-"}</p>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>← Voltar</Button>
          </>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}

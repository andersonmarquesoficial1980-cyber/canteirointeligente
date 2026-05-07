import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

// Mapeia time_entry do banco para TimeEntry do buildCarretaEmailReport
function mapTimeEntry(row: any) {
  // description carrega os campos extras serialized
  let extras: any = {};
  try { if (row.description) extras = JSON.parse(row.description); } catch {}
  return {
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    activity: row.activity || "",
    isParada: false,
    origin: row.origin || "",
    destination: row.destination || "",
    transportOgs: row.ogs_destination || "",
    transportEquip1: extras.transportEquip1 || "",
    transportEquip1Custom: extras.transportEquip1Custom || "",
    transportEquip2: extras.transportEquip2 || "",
    transportEquip2Custom: extras.transportEquip2Custom || "",
    transportEquip3: extras.transportEquip3 || "",
    transportEquip3Custom: extras.transportEquip3Custom || "",
    transportObs: extras.transportObs || "",
    returnReason: extras.returnReason || "",
    returnDetails: extras.returnDetails || "",
    transportInternalDetails: extras.transportInternalDetails || "",
    maintenanceDetails: extras.maintenanceDetails || "",
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

  // OGS lookup
  const ogsMap: Record<string, string> = {};
  ogsData.forEach((o: any) => { ogsMap[o.ogs_number] = o.location_address || ""; });
  const resolveAddr = (raw: string) => {
    if (!raw) return "";
    if (raw === "BASE / PÁTIO CENTRAL") return "PÁTIO CENTRAL / OFICINA";
    const num = raw.split(" ")[0];
    return ogsMap[num] || raw;
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
        let extras: any = {};
        try { if (e.description) extras = JSON.parse(e.description); } catch {}
        const eq1 = extras.transportEquip1Custom || extras.transportEquip1 || "";
        const eq2 = extras.transportEquip2Custom || extras.transportEquip2 || "";
        const eq3 = extras.transportEquip3Custom || extras.transportEquip3 || "";
        const origNum = e.origin === "BASE / PÁTIO CENTRAL" ? "BASE" : (e.origin || "").split(" ")[0];
        const destNum = e.destination === "BASE / PÁTIO CENTRAL" ? "BASE" : (e.destination || "").split(" ")[0];
        const obs = [extras.returnReason, extras.returnDetails, extras.transportObs].filter(Boolean).join(" | ");
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

  const horasTrabalhadas = useMemo(() => calculateWorkedHours(timeEntries), [timeEntries]);
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
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Visualizar Lançamento</span>
          <span className="block text-[11px] text-primary-foreground/80">Somente leitura</span>
        </div>
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
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportarPdf}>
                <Printer className="w-3.5 h-3.5" /> Exportar PDF
              </Button>
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
                <Button variant="outline" size="sm" className="gap-2 text-xs h-9"
                  disabled={exportandoPeriodo}
                  onClick={async () => {
                    setExportandoPeriodo(true);
                    await exportarExcelPeriodo(iniPeriodo, fimPeriodo, ogsData as any[]);
                    setExportandoPeriodo(false);
                  }}>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {exportandoPeriodo ? "Gerando..." : "Exportar Excel do Período"}
                </Button>
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
            <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm font-medium">
              {`👁️ Visualização — Lançamento de ${diary?.operator_name || "Operador"}`}
            </div>

            <div className="rdo-card space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Info label="Data" value={fmtDate(diary.date)} />
                <Info label="Turno" value={diary.period || "-"} />
                <Info label="Frota" value={diary.equipment_fleet || "-"} />
                <Info label="Tipo" value={diary.equipment_type || "-"} />
                <Info label="Status" value={diary.work_status || diary.status || "-"} />
                <Info label="Operador" value={diary.operator_name || "-"} />
                <Info label="OGS" value={diary.ogs_number || "-"} />
                <Info label="Cliente" value={diary.client_name || "-"} />
                <Info label="Local" value={diary.location_address || "-"} />
              </div>
            </div>

            <div className="rdo-card space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {diary.equipment_type && ["Caminhões", "Comboio", "Carreta", "Veículo"].includes(diary.equipment_type) ? (
                  <>
                    <Info label="Odômetro inicial" value={String(diary.odometer_initial ?? "-")} />
                    <Info label="Odômetro final" value={String(diary.odometer_final ?? "-")} />
                  </>
                ) : (
                  <>
                    <Info label="Horímetro inicial" value={String(diary.meter_initial ?? "-")} />
                    <Info label="Horímetro final" value={String(diary.meter_final ?? "-")} />
                  </>
                )}
                <Info label="Litros diesel" value={String(diary.fuel_liters ?? "-")} />
                <Info label="Horas trabalhadas" value={horasTrabalhadas === null ? "-" : `${fmtNumber(horasTrabalhadas)}h`} />
              </div>
            </div>

            {areas.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">Áreas de produção (fresagem)</p>
                {areas.map((a: any) => (
                  <div key={a.id} className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                    {`${a.length_m ?? "-"}m × ${a.width_m ?? "-"}m × ${a.thickness_cm ?? "-"}cm = ${fmtNumber(a.m2)} m² / ${fmtNumber(a.m3, 2)} m³`}
                  </div>
                ))}
              </div>
            )}

            {bits.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">Bits lançados</p>
                {bits.map((b: any) => (
                  <div key={b.id} className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                    {`${b.quantity || "-"}x ${b.brand || "-"} — ${b.status || "-"}${b.horimeter ? ` — Horímetro ${b.horimeter}` : ""}`}
                  </div>
                ))}
              </div>
            )}

            <div className="rdo-card">
              <Info label="Observações" value={diary.observations || "-"} />
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

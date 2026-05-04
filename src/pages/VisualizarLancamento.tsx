import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoCi from "@/assets/logo-workflux.png";

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

export default function VisualizarLancamento() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diary, setDiary] = useState<any | null>(null);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [bits, setBits] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError("Lançamento não informado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          { data: diaryRow, error: diaryError },
          { data: timeRows, error: timeError },
          { data: areaRows, error: areasError },
          { data: bitRows, error: bitsError },
        ] = await Promise.all([
          (supabase as any).from("equipment_diaries").select("*").eq("id", id).maybeSingle(),
          supabase.from("equipment_time_entries").select("start_time,end_time,activity").eq("diary_id", id),
          supabase
            .from("equipment_production_areas")
            .select("id,length_m,width_m,thickness_cm,m2,m3")
            .eq("diary_id", id),
          supabase.from("bit_entries").select("id,quantity,brand,status,horimeter").eq("diary_id", id),
        ]);

        if (diaryError) throw diaryError;
        if (timeError) throw timeError;
        if (areasError) throw areasError;
        if (bitsError) throw bitsError;
        if (!diaryRow) {
          setError("Lançamento não encontrado.");
          setDiary(null);
          return;
        }

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

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            Visualizar Lançamento
          </span>
          <span className="block text-[11px] text-primary-foreground/80">Somente leitura</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm font-medium">
          {`👁️ Visualização — Lançamento de ${diary?.operator_name || "Operador"}`}
        </div>

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rdo-card py-8 text-sm text-destructive">{error}</div>
        ) : !diary ? (
          <div className="rdo-card py-8 text-sm text-muted-foreground">Lançamento não encontrado.</div>
        ) : (
          <>
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
                <Info
                  label="Horas trabalhadas"
                  value={horasTrabalhadas === null ? "-" : `${fmtNumber(horasTrabalhadas)}h`}
                />
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

            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
              ← Voltar
            </Button>
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

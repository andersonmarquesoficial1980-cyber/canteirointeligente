import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoCi from "@/assets/logo-workflux.png";

interface Lancamento {
  id: string;
  created_at: string | null;
  date: string | null;
  equipment_fleet: string | null;
  equipment_type: string | null;
  work_status: string | null;
  period: string | null;
  operator_name: string | null;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  observations: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  fuel_liters: number | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function MeusLancamentos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [tipoEquipamento, setTipoEquipamento] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [detalheExtra, setDetalheExtra] = useState<{ areas: any[]; bits: any[]; horas: number | null }>({ areas: [], bits: [], horas: null });

  const abrirDetalhe = async (item: Lancamento) => {
    setSelecionado(item);
    setDetalheExtra({ areas: [], bits: [], horas: null });
    const [{ data: areas }, { data: bits }, { data: times }] = await Promise.all([
      supabase.from('equipment_production_areas').select('*').eq('diary_id', item.id),
      (supabase as any).from('bit_entries').select('*').eq('diary_id', item.id),
      supabase.from('equipment_time_entries').select('start_time, end_time, activity').eq('diary_id', item.id),
    ]);
    // Calcula horas trabalhadas
    let horasTotal = 0;
    (times || []).forEach((t: any) => {
      if (t.start_time && t.end_time && !['Refeições', 'À Disposição', 'Manutenção'].includes(t.activity)) {
        const [sh, sm] = t.start_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        horasTotal += (eh * 60 + em - sh * 60 - sm) / 60;
      }
    });
    setDetalheExtra({ areas: areas || [], bits: bits || [], horas: horasTotal > 0 ? horasTotal : null });
  };

  const carregar = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setLancamentos([]);
      setTipos([]);
      setLoading(false);
      return;
    }

    let query = (supabase as any)
      .from("equipment_diaries")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (tipoEquipamento !== "todos") {
      query = query.eq("equipment_type", tipoEquipamento);
    }
    if (dataInicio) {
      query = query.gte("date", dataInicio);
    }
    if (dataFim) {
      query = query.lte("date", dataFim);
    }

    const [{ data: rows }, { data: tiposRows }] = await Promise.all([
      query,
      (supabase as any)
        .from("equipment_diaries")
        .select("equipment_type")
        .eq("user_id", user.id)
        .not("equipment_type", "is", null),
    ]);

    setLancamentos((rows || []) as Lancamento[]);

    const tiposUnicos = Array.from(
      new Set(((tiposRows || []) as any[]).map((r) => r.equipment_type).filter(Boolean)),
    ) as string[];
    setTipos(tiposUnicos.sort((a, b) => a.localeCompare(b)));
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [tipoEquipamento, dataInicio, dataFim]);

  const resumo = useMemo(() => {
    return `${lancamentos.length} lançamento${lancamentos.length === 1 ? "" : "s"}`;
  }, [lancamentos]);

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
            Meus Lançamentos
          </span>
          <span className="block text-[11px] text-primary-foreground/80">{resumo}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="rdo-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Equipamento</span>
              <Select value={tipoEquipamento} onValueChange={setTipoEquipamento}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Início</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Fim</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum lançamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-3">
            {lancamentos.map((item) => (
              <button
                key={item.id}
                onClick={() => abrirDetalhe(item)}
                className="w-full text-left rdo-card hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-display font-bold text-primary">
                      {item.equipment_fleet || "-"} • {item.equipment_type || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {fmtDate(item.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-muted-foreground">Status</p>
                    <p className="text-xs">{item.work_status || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Frota</p>
                    <p className="font-semibold">{item.equipment_fleet || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-semibold">{item.equipment_type || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-semibold">{item.work_status || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Turno</p>
                    <p className="font-semibold">{item.period || "-"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do Lançamento</DialogTitle>
          </DialogHeader>

          {selecionado && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Data" value={fmtDate(selecionado.date)} />
                  <Info label="Turno" value={selecionado.period || "-"} />
                  <Info label="Frota" value={selecionado.equipment_fleet || "-"} />
                  <Info label="Tipo" value={selecionado.equipment_type || "-"} />
                  <Info label="Status" value={selecionado.work_status || "-"} />
                  <Info label="Operador" value={selecionado.operator_name || "-"} />
                  <Info label="OGS" value={selecionado.ogs_number || "-"} />
                  <Info label="Cliente" value={selecionado.client_name || "-"} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Info label="Horímetro Inicial" value={String(selecionado.meter_initial ?? "-")} />
                  <Info label="Horímetro Final" value={String(selecionado.meter_final ?? "-")} />
                  <Info label="Odômetro Inicial" value={String(selecionado.odometer_initial ?? "-")} />
                  <Info label="Odômetro Final" value={String(selecionado.odometer_final ?? "-")} />
                </div>

                <Info label="Litros Diesel" value={String(selecionado.fuel_liters ?? "-")} />
                {detalheExtra.horas !== null && (
                  <Info label="Horas Trabalhadas" value={`${detalheExtra.horas.toFixed(1)}h`} />
                )}
                <Info label="Local" value={selecionado.location_address || "-"} />
                <Info label="Observações" value={selecionado.observations || "-"} />
              </div>

              {detalheExtra.areas.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Produção (Fresagem)</p>
                  {detalheExtra.areas.map((a: any, i: number) => (
                    <p key={i} className="text-xs">
                      {a.length_m}m × {a.width_m}m × {a.thickness_cm}cm = <b>{a.m2?.toFixed(1)} m²</b> / {a.m3?.toFixed(2)} m³
                    </p>
                  ))}
                  <p className="text-xs font-bold text-primary">
                    Total: {detalheExtra.areas.reduce((s: number, a: any) => s + (a.m2 || 0), 0).toFixed(1)} m²
                  </p>
                </div>
              )}

              {detalheExtra.bits.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Bits Lançados</p>
                  {detalheExtra.bits.map((b: any, i: number) => (
                    <p key={i} className="text-xs">{b.quantity}x {b.brand} — {b.status}</p>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() =>
                  navigate(
                    `/equipamentos/diario?edit=${selecionado.id}&tipo=${encodeURIComponent(
                      selecionado.equipment_type || "",
                    )}&frota=${encodeURIComponent(selecionado.equipment_fleet || "")}`,
                  )
                }
              >
                Editar Lançamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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

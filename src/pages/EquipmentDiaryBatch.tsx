import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_COMPANY_ID } from "@/config/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE_LABEL = "BASE / PÁTIO CENTRAL";
const BATCH_STATUSES = ["Disposição", "Folga", "Manutenção"] as const;
const TRUCK_TYPES = ["CAMINH", "VEICUL", "COMBOIO", "CARRETA"];

function* eachDay(from: string, to: string) {
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
}
const fmt = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Lançamento em lote de diários de equipamento SEM produção
 * (Disposição / Folga / Manutenção) para um período.
 * - Pula dias que já têm diário (frota + data + turno + empresa).
 * - Horímetro inicial = final (máquina parada).
 */
export default function EquipmentDiaryBatch() {
  const goBack = useSmartBack("/equipamentos");
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const { data: ogsData = [] } = useOgsReference();
  const companyId = profile?.company_id || DEFAULT_COMPANY_ID;

  const { data: equipamentos = [] } = useQuery({
    queryKey: ["equipamentos_batch"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("equipamentos").select("*").order("frota");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const [fleet, setFleet] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [workStatus, setWorkStatus] = useState<(typeof BATCH_STATUSES)[number]>("Disposição");
  const [ogs, setOgs] = useState("000");
  const [meter, setMeter] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ toCreate: string[]; existing: string[] } | null>(null);

  const equip = useMemo(() => equipamentos.find((e: any) => e.frota === fleet), [equipamentos, fleet]);
  const equipmentType: string = equip?.tipo || "";
  const usesOdometer = TRUCK_TYPES.some((t) => equipmentType.toUpperCase().startsWith(t));
  const ogsRow = useMemo(() => ogsData.find((o: any) => o.ogs_number === ogs), [ogsData, ogs]);
  const isBase = ogs === "000";

  const days = useMemo(() => (dateFrom && dateTo && dateFrom <= dateTo ? [...eachDay(dateFrom, dateTo)] : []), [dateFrom, dateTo]);
  const tooMany = days.length > 62;

  const loadExisting = async () => {
    const { data, error } = await (supabase as any)
      .from("equipment_diaries")
      .select("date")
      .eq("company_id", companyId)
      .eq("equipment_fleet", fleet)
      .eq("period", turno)
      .gte("date", dateFrom)
      .lte("date", dateTo);
    if (error) throw error;
    return new Set<string>((data || []).map((d: any) => d.date));
  };

  const validate = () => {
    if (!fleet) return "Selecione a frota.";
    if (!days.length) return "Informe um período válido (início ≤ fim).";
    if (tooMany) return "Período máximo de 62 dias por lote.";
    if (!meter.trim() || Number.isNaN(Number(meter.replace(",", ".")))) return "Informe o horímetro/odômetro.";
    return null;
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) return toast({ title: "Verifique os dados", description: err, variant: "destructive" });
    try {
      const existing = await loadExisting();
      setPreview({ toCreate: days.filter((d) => !existing.has(d)), existing: days.filter((d) => existing.has(d)) });
    } catch (e: any) {
      toast({ title: "Erro ao conferir dias existentes", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!preview || !preview.toCreate.length || !session?.user?.id) return;
    setSaving(true);
    try {
      // reconfere duplicados no momento do envio (evita corrida)
      const existing = await loadExisting();
      const dates = preview.toCreate.filter((d) => !existing.has(d));
      const m = Number(meter.replace(",", "."));
      const observations =
        workStatus === "Manutenção"
          ? `[MANUTENÇÃO] ${obs || "Lançamento em lote"}`.trim()
          : [obs, "[Lançamento em lote]"].filter(Boolean).join(" ");
      const rows = dates.map((date) => ({
        equipment_fleet: fleet,
        equipment_type: equipmentType || null,
        date,
        period: turno,
        work_status: workStatus,
        ogs_number: isBase ? null : ogs,
        client_name: isBase ? null : ogsRow?.client_name || null,
        location_address: isBase ? BASE_LABEL : null,
        observations,
        company_id: companyId,
        user_id: session.user.id,
        created_by: session.user.id,
        status: "enviado",
        ...(usesOdometer ? { odometer_initial: m, odometer_final: m } : { meter_initial: m, meter_final: m }),
      }));
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await (supabase as any).from("equipment_diaries").insert(rows.slice(i, i + 50));
        if (error) throw error;
      }
      toast({ title: "Lote lançado ✅", description: `${rows.length} diário(s) criado(s) para ${fleet}.` });
      goBack();
    } catch (e: any) {
      toast({ title: "Erro ao lançar lote", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setPreview(null);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-extrabold text-[hsl(215_80%_22%)]">Lançamento em lote — Disposição / Folga / Manutenção</h1>
        <p className="text-sm text-muted-foreground">
          Cria um diário por dia no período, sem produção. Dias que já têm diário (mesma frota e turno) são pulados.
        </p>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4">
          <div className="col-span-2">
            <label className="text-xs font-semibold">Frota</label>
            <Select value={fleet} onValueChange={(v) => { setFleet(v); reset(); }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {equipamentos.filter((e: any) => e?.frota).map((e: any) => (
                  <SelectItem key={e.frota} value={e.frota}>{e.frota}{e.tipo ? ` — ${e.tipo}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold">Data inicial</label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); reset(); }} />
          </div>
          <div>
            <label className="text-xs font-semibold">Data final</label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); reset(); }} />
          </div>
          <div>
            <label className="text-xs font-semibold">Turno</label>
            <Select value={turno} onValueChange={(v: any) => { setTurno(v); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diurno">Diurno</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold">Status</label>
            <Select value={workStatus} onValueChange={(v: any) => { setWorkStatus(v); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold">OGS (000 = Base / Pátio)</label>
            <Select value={ogs} onValueChange={(v) => { setOgs(v); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...new Map(ogsData.map((o: any) => [o.ogs_number, o])).values()].map((o: any) => (
                  <SelectItem key={o.ogs_number} value={o.ogs_number}>
                    {o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold">{usesOdometer ? "Odômetro (km)" : "Horímetro"} (inicial = final)</label>
            <Input inputMode="decimal" value={meter} onChange={(e) => { setMeter(e.target.value); reset(); }} placeholder="Ex.: 990" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold">Observação (opcional)</label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>

        {preview && (
          <div className="rounded-2xl border bg-white p-4 text-sm space-y-2">
            <p><b>{preview.toCreate.length}</b> dia(s) serão criados para <b>{fleet}</b> ({workStatus}, {turno}, OGS {ogs}).</p>
            {preview.toCreate.length > 0 && (
              <p className="text-muted-foreground">{preview.toCreate.map(fmt).join(", ")}</p>
            )}
            {preview.existing.length > 0 && (
              <p className="text-amber-700">
                {preview.existing.length} dia(s) já possuem diário e serão pulados: {preview.existing.map(fmt).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={goBack} disabled={saving}>Voltar</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={saving}>Conferir</Button>
          <Button onClick={handleSave} disabled={saving || !preview || preview.toCreate.length === 0}>
            {saving ? "Lançando..." : `Lançar ${preview?.toCreate.length ?? 0} dia(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
}

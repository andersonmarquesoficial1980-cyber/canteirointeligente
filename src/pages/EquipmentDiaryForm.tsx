import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Send } from "lucide-react";
import EquipmentHeader from "@/components/equipment/EquipmentHeader";
import TimeEntriesSection, { type TimeEntry, createDefaultTimeEntry } from "@/components/equipment/TimeEntriesSection";
import KmaCalibrationSection, {
  type CalibrationEntry,
  createEmptyCalibration,
  calcFator,
} from "@/components/equipment/KmaCalibrationSection";
import ProductionAreasSection, { type ProductionArea, createEmptyArea } from "@/components/equipment/ProductionAreasSection";
import BitManagementSection, { type BitEntry, createEmptyBit } from "@/components/equipment/BitManagementSection";
import { generateKmaPdf } from "@/lib/generateKmaPdf";

const EQUIPMENT_TYPES = ["Fresadora", "Bobcat", "Rolo", "Vibroacabadora", "Usina KMA"] as const;

export default function EquipmentDiaryForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [equipmentType, setEquipmentType] = useState("");
  const [selectedFleet, setSelectedFleet] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [operator, setOperator] = useState("");
  const [operatorSolo, setOperatorSolo] = useState("");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [meterInitial, setMeterInitial] = useState("");
  const [meterFinal, setMeterFinal] = useState("");
  const [diesel, setDiesel] = useState("");
  const [observations, setObservations] = useState("");

  // Sub-sections
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([createDefaultTimeEntry("diurno")]);
  const [kmaEntries, setKmaEntries] = useState<CalibrationEntry[]>([createEmptyCalibration(1)]);
  const [productionAreas, setProductionAreas] = useState<ProductionArea[]>([createEmptyArea()]);
  const [bits, setBits] = useState<BitEntry[]>([]);

  const isFresadora = equipmentType === "Fresadora";
  const isUsinaKma = equipmentType === "Usina KMA";

  // Set type from URL param
  useEffect(() => {
    const tipo = searchParams.get("tipo");
    if (tipo && EQUIPMENT_TYPES.includes(tipo as any)) {
      setEquipmentType(tipo);
    } else if (tipo) {
      // Map non-standard names
      const map: Record<string, string> = {
        "Caminhão": "Fresadora", "Comboio": "Fresadora", "Veículo": "Fresadora",
        "Retro": "Fresadora", "Vibro": "Vibroacabadora",
      };
      if (map[tipo]) setEquipmentType(map[tipo]);
    }
  }, [searchParams]);

  // Fetch equipment list
  const { data: equipamentos = [] } = useQuery({
    queryKey: ["maquinas_frota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota")
        .select("*")
        .eq("status", "ativo")
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });

  // Horímetro validation
  const horimeterError =
    meterInitial && meterFinal && Number(meterFinal) < Number(meterInitial)
      ? "Horímetro Final não pode ser menor que o Inicial"
      : null;

  const horasTrabalhadas =
    meterInitial && meterFinal && Number(meterFinal) >= Number(meterInitial)
      ? (Number(meterFinal) - Number(meterInitial)).toFixed(1)
      : null;

  const handleTurnoChange = (value: "diurno" | "noturno") => {
    setTurno(value);
    if (timeEntries.length === 1 && !timeEntries[0].activity && !timeEntries[0].endTime) {
      setTimeEntries([createDefaultTimeEntry(value)]);
    }
  };

  const handleSave = async () => {
    if (!selectedFleet || !date || !equipmentType) {
      toast({ title: "Campos obrigatórios", description: "Selecione o equipamento, tipo e data.", variant: "destructive" });
      return;
    }
    if (horimeterError) {
      toast({ title: "Horímetro inválido", description: horimeterError, variant: "destructive" });
      return;
    }
    if (!session?.user?.id) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      navigate("/");
      return;
    }

    setSaving(true);
    try {
      const { data: diary, error } = await supabase
        .from("equipment_diaries")
        .insert({
          equipment_fleet: selectedFleet,
          equipment_type: equipmentType,
          date,
          operator_name: operator || null,
          operator_solo: isFresadora ? (operatorSolo || null) : null,
          period: turno,
          meter_initial: meterInitial ? Number(meterInitial) : null,
          meter_final: meterFinal ? Number(meterFinal) : null,
          fuel_liters: diesel ? Number(diesel) : null,
          observations: observations || null,
          company_id: profile?.company_id || null,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Save time entries
      const validTimeEntries = timeEntries.filter((t) => t.startTime && t.activity);
      if (validTimeEntries.length > 0 && diary) {
        const rows = validTimeEntries.map((t) => ({
          equipment_diary_id: diary.id,
          start_time: t.startTime,
          end_time: t.endTime || null,
          activity_description: t.activity,
          is_parada: t.isParada,
        }));
        await supabase.from("equipment_time_entries").insert(rows);
      }

      // Save KMA calibration
      if (isUsinaKma && diary) {
        const validKma = kmaEntries.filter((e) => e.pesoNominal || e.pesoReal);
        for (const entry of validKma) {
          let ticketUrl: string | null = null;
          if (entry.ticketPhotoFile) {
            const path = `kma-tickets/${diary.id}/tentativa_${entry.tentativa}_${Date.now()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from("notas_fiscais")
              .upload(path, entry.ticketPhotoFile, { contentType: "image/jpeg", upsert: true });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
              ticketUrl = urlData.publicUrl;
            }
          }
          await supabase.from("kma_calibration_entries").insert({
            equipment_diary_id: diary.id,
            attempt_number: entry.tentativa,
            nominal_weight_usina: entry.pesoNominal ? Number(entry.pesoNominal) : null,
            real_weight_reference: entry.pesoReal ? Number(entry.pesoReal) : null,
            truck_tara: entry.tara ? Number(entry.tara) : null,
            adjustment_factor: calcFator(entry),
            ticket_photo_url: ticketUrl,
          });
        }
      }

      // Save production areas (Fresadora)
      if (isFresadora && diary) {
        const validAreas = productionAreas.filter((a) => a.comp || a.larg);
        if (validAreas.length > 0) {
          const rows = validAreas.map((a) => ({
            diary_id: diary.id,
            comp_m: a.comp ? Number(a.comp) : null,
            larg_m: a.larg ? Number(a.larg) : null,
            esp_cm: a.esp ? Number(a.esp) : null,
            m2: a.comp && a.larg ? Number(a.comp) * Number(a.larg) : null,
            m3: a.comp && a.larg && a.esp ? Number(a.comp) * Number(a.larg) * (Number(a.esp) / 100) : null,
          }));
          await supabase.from("equipment_production_areas").insert(rows);
        }
      }

      // Save bits (Fresadora)
      if (isFresadora && diary && bits.length > 0) {
        const validBits = bits.filter((b) => b.brand);
        if (validBits.length > 0) {
          const rows = validBits.map((b) => ({
            diary_id: diary.id,
            brand: b.brand,
            quantity: Number(b.quantity) || 0,
            status: b.status,
            horimeter: b.horimeter || null,
          }));
          await supabase.from("bit_entries").insert(rows);
        }
      }

      toast({ title: "✅ Diário enviado!", description: `Diário para ${selectedFleet} salvo com sucesso.` });
      navigate("/equipamentos");
    } catch (err: any) {
      const msg = err?.message || "Erro desconhecido";
      if (msg.includes("row-level security") || msg.includes("policy")) {
        toast({ title: "Sem permissão", description: "Contate o administrador.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    await generateKmaPdf({ fleet: selectedFleet, date, operator, entries: kmaEntries });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EquipmentHeader title={equipmentType || "Novo Diário"} />

      <div className="flex-1 p-4 space-y-5 pb-24 max-w-lg mx-auto w-full">
        {/* INFORMAÇÕES GERAIS */}
        <Section title="INFORMAÇÕES GERAIS">
          <FieldRow>
            <Field label="Tipo de Equipamento">
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Frota">
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {equipamentos.map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.frota}>
                      {eq.frota} — {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </Field>
            <Field label="Turno">
              <Select value={turno} onValueChange={(v) => handleTurnoChange(v as "diurno" | "noturno")}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurno">☀️ Diurno</SelectItem>
                  <SelectItem value="noturno">🌙 Noturno</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Operador">
            <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nome do operador" className="bg-secondary border-border" />
          </Field>

          {isFresadora && (
            <Field label="Operador Solo">
              <Input value={operatorSolo} onChange={(e) => setOperatorSolo(e.target.value)} placeholder="Nome do operador solo" className="bg-secondary border-border" />
            </Field>
          )}
        </Section>

        {/* HORÍMETRO & DIESEL */}
        <Section title="HORÍMETRO & DIESEL">
          <FieldRow>
            <Field label="Horímetro Inicial">
              <Input type="number" value={meterInitial} onChange={(e) => setMeterInitial(e.target.value)} placeholder="0" className="bg-secondary border-border" />
            </Field>
            <Field label="Horímetro Final">
              <Input
                type="number"
                value={meterFinal}
                onChange={(e) => setMeterFinal(e.target.value)}
                placeholder="0"
                className={`bg-secondary border-border ${horimeterError ? "border-destructive" : ""}`}
              />
            </Field>
            <Field label="Diesel (L)">
              <Input type="number" value={diesel} onChange={(e) => setDiesel(e.target.value)} placeholder="0" className="bg-secondary border-border" />
            </Field>
          </FieldRow>

          {horimeterError && (
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {horimeterError}
            </div>
          )}
          {horasTrabalhadas && (
            <p className="text-xs text-muted-foreground">
              Horas trabalhadas: <span className="font-semibold text-foreground">{horasTrabalhadas}h</span>
            </p>
          )}
        </Section>

        {/* APONTAMENTO DE HORAS */}
        <TimeEntriesSection entries={timeEntries} onChange={setTimeEntries} turno={turno} />

        {/* FRESADORA: Produção + Bits */}
        {isFresadora && (
          <>
            <Section title="">
              <ProductionAreasSection areas={productionAreas} onChange={setProductionAreas} />
            </Section>
            <Section title="">
              <BitManagementSection bits={bits} onChange={setBits} />
            </Section>
          </>
        )}

        {/* KMA CALIBRATION */}
        {isUsinaKma && (
          <KmaCalibrationSection
            entries={kmaEntries}
            onChange={setKmaEntries}
            onGeneratePdf={handleGeneratePdf}
          />
        )}

        {/* OBSERVAÇÕES */}
        <Section title="OBSERVAÇÕES">
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observações gerais..."
            className="bg-secondary border-border min-h-[80px]"
          />
        </Section>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSave}
            disabled={saving || !!horimeterError}
            className="w-full font-bold text-base py-6 bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5 mr-2" />
            {saving ? "Enviando..." : "Enviar Diário"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Styled sub-components with yellow labels / white titles ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-bold text-white uppercase tracking-wide border-b border-border pb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 flex-1 min-w-0">
      <label className="text-xs font-semibold text-accent uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}

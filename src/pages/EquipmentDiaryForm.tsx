import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Truck, Scale, AlertCircle } from "lucide-react";
import KmaCalibrationSection, {
  type CalibrationEntry,
  createEmptyCalibration,
  calcFator,
} from "@/components/equipment/KmaCalibrationSection";
import TimeEntriesSection, {
  type TimeEntry,
  createDefaultTimeEntry,
} from "@/components/equipment/TimeEntriesSection";
import { generateKmaPdf } from "@/lib/generateKmaPdf";

const EQUIPMENT_TYPES = ["Fresadora", "Bobcat", "Rolo", "Vibroacabadora", "Usina KMA"] as const;

export default function EquipmentDiaryForm() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedFleet, setSelectedFleet] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [operator, setOperator] = useState("");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [meterInitial, setMeterInitial] = useState("");
  const [meterFinal, setMeterFinal] = useState("");
  const [diesel, setDiesel] = useState("");

  // Time entries
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([createDefaultTimeEntry("diurno")]);

  // KMA calibration
  const [kmaEntries, setKmaEntries] = useState<CalibrationEntry[]>([createEmptyCalibration(1)]);

  const isUsinaKma = equipmentType === "Usina KMA";

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

  // Horimeter validation
  const horimeterError =
    meterInitial && meterFinal && Number(meterFinal) < Number(meterInitial)
      ? "Horímetro Final não pode ser menor que o Inicial"
      : null;

  const horasTrabalhadas =
    meterInitial && meterFinal && Number(meterFinal) >= Number(meterInitial)
      ? (Number(meterFinal) - Number(meterInitial)).toFixed(1)
      : null;

  // When turno changes, reset time entries default
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
      // 1. Create diary
      const { data: diary, error } = await supabase
        .from("equipment_diaries")
        .insert({
          equipment_fleet: selectedFleet,
          equipment_type: equipmentType,
          date,
          operator_name: operator || null,
          meter_initial: meterInitial ? Number(meterInitial) : null,
          meter_final: meterFinal ? Number(meterFinal) : null,
          fuel_liters: diesel ? Number(diesel) : null,
          company_id: profile?.company_id || null,
          created_by: session.user.id,
          status: "rascunho",
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Save time entries
      const validTimeEntries = timeEntries.filter((t) => t.startTime && t.activity);
      if (validTimeEntries.length > 0 && diary) {
        const rows = validTimeEntries.map((t) => ({
          equipment_diary_id: diary.id,
          start_time: t.startTime,
          end_time: t.endTime || null,
          activity_description: t.activity,
          is_parada: t.isParada,
        }));
        const { error: teError } = await supabase.from("equipment_time_entries").insert(rows);
        if (teError) console.error("Time entries error:", teError);
      }

      // 3. Save KMA calibration entries + upload photos
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

      toast({ title: "✅ Diário criado!", description: `Diário para ${selectedFleet} salvo com sucesso.` });
      navigate("/equipamentos");
    } catch (err: any) {
      const msg = err?.message || "Erro desconhecido";
      if (msg.includes("row-level security") || msg.includes("policy")) {
        toast({
          title: "Sem permissão",
          description: "Você não tem permissão para criar diários. Contate o administrador.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    await generateKmaPdf({
      fleet: selectedFleet,
      date,
      operator,
      entries: kmaEntries,
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/equipamentos")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Novo Diário de Equipamento
          </h1>
          <p className="text-sm text-muted-foreground">Registro diário de operação</p>
        </div>
      </div>

      {/* Equipment + Type */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Equipamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Frota *</Label>
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione a frota..." />
                </SelectTrigger>
                <SelectContent>
                  {equipamentos.map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.frota}>
                      {eq.frota} — {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo de Equipamento *</Label>
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isUsinaKma && (
            <div className="bg-accent/10 border border-accent/30 rounded-md p-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent" />
              <span className="text-xs text-accent font-semibold">Modo Usina KMA ativado — Calibração de pesagem habilitada</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Data */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Dados Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Operador</Label>
              <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nome do operador" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Turno</Label>
              <Select value={turno} onValueChange={(v) => handleTurnoChange(v as "diurno" | "noturno")}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurno">☀️ Diurno (07:00)</SelectItem>
                  <SelectItem value="noturno">🌙 Noturno (20:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horímetro & Diesel */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Horímetro & Diesel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Horímetro Inicial</Label>
              <Input
                type="number"
                value={meterInitial}
                onChange={(e) => setMeterInitial(e.target.value)}
                placeholder="0"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Horímetro Final</Label>
              <Input
                type="number"
                value={meterFinal}
                onChange={(e) => setMeterFinal(e.target.value)}
                placeholder="0"
                className={`bg-secondary border-border ${horimeterError ? "border-destructive" : ""}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Diesel (L)</Label>
              <Input
                type="number"
                value={diesel}
                onChange={(e) => setDiesel(e.target.value)}
                placeholder="0"
                className="bg-secondary border-border"
              />
            </div>
          </div>

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
        </CardContent>
      </Card>

      {/* Time Entries */}
      <TimeEntriesSection entries={timeEntries} onChange={setTimeEntries} turno={turno} />

      {/* KMA Calibration — only for Usina KMA */}
      {isUsinaKma && (
        <KmaCalibrationSection
          entries={kmaEntries}
          onChange={setKmaEntries}
          onGeneratePdf={handleGeneratePdf}
        />
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !!horimeterError}
        className="w-full font-bold text-base py-6"
      >
        <Save className="w-5 h-5 mr-2" />
        {saving ? "Salvando..." : "Salvar Diário"}
      </Button>
    </div>
  );
}

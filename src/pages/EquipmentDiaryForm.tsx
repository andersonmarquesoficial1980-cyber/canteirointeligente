import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Send, Save } from "lucide-react";
import EquipmentHeader from "@/components/equipment/EquipmentHeader";
import TimeEntriesSection, { type TimeEntry, createDefaultTimeEntry } from "@/components/equipment/TimeEntriesSection";
import KmaCalibrationSection, {
  type CalibrationEntry,
  createEmptyCalibration,
  calcFator,
} from "@/components/equipment/KmaCalibrationSection";
import ProductionAreasSection, { type ProductionArea, createEmptyArea } from "@/components/equipment/ProductionAreasSection";
import BitManagementSection, { type BitEntry, createEmptyBit } from "@/components/equipment/BitManagementSection";
import FuelingSection, { type FuelingData, createEmptyFueling } from "@/components/equipment/FuelingSection";
import ChecklistSection, { type ChecklistResult } from "@/components/equipment/ChecklistSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { compressImage } from "@/lib/imageCompression";
import { generateKmaPdf } from "@/lib/generateKmaPdf";

const WORK_STATUSES = ["Disposição", "Trabalhando", "Folga", "Cancelou", "Manutenção"] as const;

export default function EquipmentDiaryForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Equipment type from URL (no more selector)
  const equipmentType = searchParams.get("tipo") || "Fresadora";
  const isFresadora = equipmentType === "Fresadora";
  const isUsinaKma = equipmentType === "Usina KMA";

  // OGS reference data
  const { data: ogsData = [] } = useOgsReference();

  // Form state
  const [selectedFleet, setSelectedFleet] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [operator, setOperator] = useState("");
  const [operatorSolo, setOperatorSolo] = useState("");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [meterInitial, setMeterInitial] = useState("");
  const [meterFinal, setMeterFinal] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [ogsNumber, setOgsNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [observations, setObservations] = useState("");

  // Sub-sections
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([createDefaultTimeEntry("diurno")]);
  const [kmaEntries, setKmaEntries] = useState<CalibrationEntry[]>([createEmptyCalibration(1)]);
  const [productionAreas, setProductionAreas] = useState<ProductionArea[]>([createEmptyArea()]);
  const [bits, setBits] = useState<BitEntry[]>([]);
  const [fueling, setFueling] = useState<FuelingData>(createEmptyFueling());
  const [checklistResults, setChecklistResults] = useState<ChecklistResult[]>([]);

  // Auto-fill client/location from OGS — handle semicolon-separated addresses
  const selectedOgs = useMemo(() => {
    if (!ogsNumber) return null;
    return ogsData.find((o: any) => o.ogs_number === ogsNumber) || null;
  }, [ogsNumber, ogsData]);

  const ogsAddressList = useMemo(() => {
    if (!selectedOgs?.location_address) return [];
    const raw = selectedOgs.location_address as string;
    if (raw.includes(";")) {
      return raw.split(";").map((a: string) => a.trim()).filter(Boolean);
    }
    return [raw.trim()];
  }, [selectedOgs]);

  const hasMultipleAddresses = ogsAddressList.length > 1;

  useEffect(() => {
    if (selectedOgs) {
      setClientName(selectedOgs.client_name || "");
      if (!hasMultipleAddresses && ogsAddressList.length === 1) {
        setLocationAddress(ogsAddressList[0]);
      } else {
        setLocationAddress("");
      }
    } else {
      setClientName("");
      setLocationAddress("");
    }
  }, [selectedOgs, ogsAddressList, hasMultipleAddresses]);

  // Unique OGS numbers for the selector
  const uniqueOgs = useMemo(() => {
    const seen = new Set<string>();
    return ogsData.filter((o: any) => {
      if (!o.ogs_number || seen.has(o.ogs_number)) return false;
      seen.add(o.ogs_number);
      return true;
    });
  }, [ogsData]);

  // Fetch equipment list
  const { data: equipamentos = [] } = useQuery({
    queryKey: ["maquinas_frota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota")
        .select("*")
        .in("status", ["ativo", "Operando"])
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch operators (funcionários)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, funcao")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  // Filtered operators by role
  const operadoresFresa = useMemo(
    () => funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn === "OPERADOR DE FRESADORA" || fn === "OPERADOR DE FRESA";
    }),
    [funcionarios]
  );

  const operadoresSolo = useMemo(
    () => funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn === "OPERADOR SOLO" || fn === "AJUDANTE GERAL";
    }),
    [funcionarios]
  );

  // Filtered fleet for Fresadora
  const filteredFleet = useMemo(() => {
    if (!isFresadora) return equipamentos;
    return equipamentos.filter((eq: any) =>
      eq.tipo?.toLowerCase().includes("fresadora") ||
      eq.categoria?.toLowerCase().includes("fresadora") ||
      eq.frota?.startsWith("FA")
    );
  }, [equipamentos, isFresadora]);

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

  const handleSave = async (isDraft = false) => {
    if (!selectedFleet || !date) {
      toast({ title: "Campos obrigatórios", description: "Selecione o equipamento e data.", variant: "destructive" });
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
          fuel_liters: fueling.liters ? Number(fueling.liters) : null,
          fuel_type: fueling.fuelType || null,
          fuel_meter: fueling.fuelMeter ? Number(fueling.fuelMeter) : null,
          work_status: workStatus || null,
          ogs_number: ogsNumber || null,
          client_name: clientName || null,
          location_address: locationAddress || null,
          observations: observations || null,
          company_id: profile?.company_id || null,
          status: isDraft ? "rascunho" : "enviado",
        })
        .select()
        .single();

      if (error) throw error;

      // Save time entries
      const validTimeEntries = timeEntries.filter((t) => t.startTime && t.activity);
      if (validTimeEntries.length > 0 && diary) {
        const rows = validTimeEntries.map((t) => ({
          diary_id: diary.id,
          start_time: t.startTime,
          end_time: t.endTime || null,
          activity: t.activity,
          description: t.activity === "Manutenção" ? (t.maintenanceDetails || null) : null,
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
            length_m: a.comp ? Number(a.comp) : null,
            width_m: a.larg ? Number(a.larg) : null,
            thickness_cm: a.esp ? Number(a.esp) : null,
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

      // Save checklist results
      if (isFresadora && diary && checklistResults.length > 0) {
        for (const cr of checklistResults) {
          let photoUrl: string | null = null;
          if (cr.photoFile) {
            const path = `checklist/${diary.id}/${cr.itemId}_${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("notas_fiscais")
              .upload(path, cr.photoFile, { contentType: "image/jpeg", upsert: true });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
              photoUrl = urlData.publicUrl;
            }
          }
          await supabase.from("checklist_entries").insert({
            diary_id: diary.id,
            item_id: cr.itemId,
            status: cr.status as any,
            observation: cr.observation || null,
            photo_url: photoUrl,
          });
        }
      }

      // Save visual inspection markers
      if (isFresadora && diary && damageMarkers.length > 0) {
        for (const dm of damageMarkers) {
          let photoUrl: string | null = null;
          if (dm.photoFile) {
            const path = `visual-inspection/${diary.id}/${dm.id}_${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("notas_fiscais")
              .upload(path, dm.photoFile, { contentType: "image/jpeg", upsert: true });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
              photoUrl = urlData.publicUrl;
            }
          }
          await supabase.from("equipment_visual_inspection").insert({
            diary_id: diary.id,
            x_position: dm.xPercent,
            y_position: dm.yPercent,
            damage_type: dm.damageType,
            photo_avaria_url: photoUrl,
          });
        }
      }

      toast({
        title: isDraft ? "📝 Rascunho salvo!" : "✅ Diário enviado!",
        description: `Diário para ${selectedFleet} salvo com sucesso.`,
      });
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

      <div className="flex-1 p-4 space-y-5 pb-36 max-w-lg mx-auto w-full">
        {/* INFORMAÇÕES GERAIS */}
        <Section title="INFORMAÇÕES GERAIS">
          <FieldRow>
            <Field label="Frota">
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(isFresadora ? filteredFleet : equipamentos).map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.frota}>
                      {eq.frota} — {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Status da Obra">
              <Select value={workStatus} onValueChange={setWorkStatus}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Operador">
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o operador..." />
              </SelectTrigger>
              <SelectContent>
                {(isFresadora ? operadoresFresa : funcionarios).map((f: any) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isFresadora && (
            <Field label="Operador Solo">
              <Select value={operatorSolo} onValueChange={setOperatorSolo}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o operador solo..." />
                </SelectTrigger>
                <SelectContent>
                  {operadoresSolo.map((f: any) => (
                    <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <FieldRow>
            <Field label="OGS">
              <Select value={ogsNumber} onValueChange={setOgsNumber}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione OGS..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueOgs.map((o: any) => (
                    <SelectItem key={o.id} value={o.ogs_number || ""}>
                      {o.ogs_number} — {o.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          {(clientName || locationAddress || hasMultipleAddresses) && (
            <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
              {clientName && (
                <p className="text-xs text-muted-foreground">
                  Cliente: <span className="text-foreground font-medium">{clientName}</span>
                </p>
              )}
              {hasMultipleAddresses ? (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wide">Local da Obra</span>
                  <Select value={locationAddress} onValueChange={setLocationAddress}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Selecione o local..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ogsAddressList.map((addr: string, idx: number) => (
                        <SelectItem key={idx} value={addr}>
                          {addr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : locationAddress ? (
                <p className="text-xs text-muted-foreground">
                  Local: <span className="text-foreground font-medium">{locationAddress}</span>
                </p>
              ) : null}
            </div>
          )}
        </Section>

        {/* PERÍODO */}
        <Section title="PERÍODO">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={turno === "diurno" ? "default" : "outline"}
              className={`flex-1 ${turno === "diurno" ? "bg-primary" : ""}`}
              onClick={() => handleTurnoChange("diurno")}
            >
              ☀️ Diurno
            </Button>
            <Button
              type="button"
              variant={turno === "noturno" ? "default" : "outline"}
              className={`flex-1 ${turno === "noturno" ? "bg-primary" : ""}`}
              onClick={() => handleTurnoChange("noturno")}
            >
              🌙 Noturno
            </Button>
          </div>
        </Section>

        {/* HORÍMETRO */}
        <Section title="HORÍMETRO">
          <FieldRow>
            <Field label="Horímetro Inicial">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={meterInitial}
                onChange={(e) => setMeterInitial(e.target.value)}
                placeholder="0,0"
                className="bg-secondary border-border"
              />
            </Field>
            <Field label="Horímetro Final">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={meterFinal}
                onChange={(e) => setMeterFinal(e.target.value)}
                placeholder="0,0"
                className={`bg-secondary border-border ${horimeterError ? "border-destructive" : ""}`}
              />
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

        {/* FRESADORA: Produção + Bits + Checklist + Inspeção Visual */}
        {isFresadora && (
          <>
            <ProductionAreasSection areas={productionAreas} onChange={setProductionAreas} />
            <BitManagementSection bits={bits} onChange={setBits} />
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="checklist" className="border border-border rounded-lg overflow-hidden bg-secondary/30">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <span className="text-sm font-bold text-white uppercase tracking-wide">
                    ✔️ CHECKLIST PRÉ-OPERAÇÃO
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ChecklistSection
                    equipmentType="Fresadora"
                    results={checklistResults}
                    onChange={setChecklistResults}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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

        {/* ABASTECIMENTO */}
        <FuelingSection data={fueling} onChange={setFueling} />

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

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border space-y-2">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !!horimeterError}
            className="w-full font-bold text-base py-6 bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5 mr-2" />
            {saving ? "Enviando..." : "Enviar Diário"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            variant="outline"
            className="w-full text-sm py-3"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Styled sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">
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

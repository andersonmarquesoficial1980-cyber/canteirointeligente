import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Truck, Scale } from "lucide-react";
import KmaCalibrationSection from "@/components/equipment/KmaCalibrationSection";

export default function EquipmentDiaryForm() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedFleet, setSelectedFleet] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [operator, setOperator] = useState("");
  const [ogs, setOgs] = useState("");
  const [location, setLocation] = useState("");
  const [client, setClient] = useState("");
  const [meterInitial, setMeterInitial] = useState("");
  const [meterFinal, setMeterFinal] = useState("");
  const [fuelQuantity, setFuelQuantity] = useState("");

  // Fetch equipment list from maquinas_frota
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

  // Fetch OGS references for autocomplete
  const { data: ogsRefs = [] } = useQuery({
    queryKey: ["ogs_reference"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ogs_reference").select("*").order("numero_ogs");
      if (error) throw error;
      return data;
    },
  });

  // Derive equipment type from selection
  const selectedEquipment = equipamentos.find((eq: any) => eq.frota === selectedFleet);
  const isUsinaKma = selectedEquipment?.tipo?.toLowerCase().includes("usina") || 
                     selectedEquipment?.nome?.toLowerCase().includes("kma") ||
                     selectedEquipment?.nome?.toLowerCase().includes("usina");

  // Auto-fill location/client when OGS is selected
  const handleOgsChange = (value: string) => {
    setOgs(value);
    const ref = ogsRefs.find((r) => r.numero_ogs === value);
    if (ref) {
      setLocation(ref.endereco);
      setClient(ref.cliente);
    }
  };

  const handleSave = async () => {
    if (!selectedFleet || !date) {
      toast({ title: "Campos obrigatórios", description: "Selecione o equipamento e a data.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const userId = session?.user?.id;
      const { data: diary, error } = await supabase
        .from("equipment_diaries")
        .insert({
          fleet: selectedFleet,
          equipment_type: selectedEquipment?.tipo || null,
          date,
          operator: operator || null,
          ogs: ogs || null,
          location: location || null,
          client: client || null,
          meter_initial: meterInitial ? Number(meterInitial) : null,
          meter_final: meterFinal ? Number(meterFinal) : null,
          fuel_quantity: fuelQuantity ? Number(fuelQuantity) : null,
          company_id: null, // TODO: auto-fill when companies table exists
          user_id: userId,
          status: "rascunho",
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({ title: "✅ Diário criado!", description: `Diário para ${selectedFleet} salvo com sucesso.` });
      navigate("/equipamentos");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
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

      {/* Equipment Selector */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Equipamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Selecione o Equipamento *</Label>
            <Select value={selectedFleet} onValueChange={setSelectedFleet}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Escolha pela frota..." />
              </SelectTrigger>
              <SelectContent>
                {equipamentos.map((eq: any) => (
                  <SelectItem key={eq.id} value={eq.frota}>
                    {eq.frota} — {eq.nome} {eq.tipo ? `(${eq.tipo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEquipment && (
            <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium text-foreground">{selectedEquipment.nome}</span></p>
              <p><span className="text-muted-foreground">Tipo:</span> <span className="font-medium text-foreground">{selectedEquipment.tipo || "—"}</span></p>
              <p><span className="text-muted-foreground">Empresa:</span> <span className="font-medium text-foreground">{selectedEquipment.empresa || "—"}</span></p>
              {isUsinaKma && (
                <p className="text-accent font-semibold flex items-center gap-1 pt-1">
                  <Scale className="w-4 h-4" /> Modo Usina KMA ativado
                </p>
              )}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Operador</Label>
              <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nome do operador" className="bg-secondary border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">OGS</Label>
              <Select value={ogs} onValueChange={handleOgsChange}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione OGS" />
                </SelectTrigger>
                <SelectContent>
                  {ogsRefs.map((ref) => (
                    <SelectItem key={ref.id} value={ref.numero_ogs}>
                      {ref.numero_ogs} — {ref.cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Cliente</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Auto-preenchido pela OGS" className="bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Local / Endereço</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Auto-preenchido pela OGS" className="bg-secondary border-border" />
          </div>
        </CardContent>
      </Card>

      {/* Horímetro & Combustível */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Horímetro & Combustível</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Horímetro Inicial</Label>
              <Input type="number" value={meterInitial} onChange={(e) => setMeterInitial(e.target.value)} placeholder="0" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Horímetro Final</Label>
              <Input type="number" value={meterFinal} onChange={(e) => setMeterFinal(e.target.value)} placeholder="0" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Combustível (L)</Label>
              <Input type="number" value={fuelQuantity} onChange={(e) => setFuelQuantity(e.target.value)} placeholder="0" className="bg-secondary border-border" />
            </div>
          </div>
          {meterInitial && meterFinal && Number(meterFinal) > Number(meterInitial) && (
            <p className="text-xs text-muted-foreground mt-2">
              Horas trabalhadas: <span className="font-semibold text-foreground">{(Number(meterFinal) - Number(meterInitial)).toFixed(1)}h</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* KMA Calibration Section — only for Usina */}
      {isUsinaKma && <KmaCalibrationSection />}

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full font-bold text-base py-6">
        <Save className="w-5 h-5 mr-2" />
        {saving ? "Salvando..." : "Salvar Diário"}
      </Button>
    </div>
  );
}

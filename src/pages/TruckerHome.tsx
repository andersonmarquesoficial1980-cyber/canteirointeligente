import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, MapPin, Package, Send, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";
import { toast } from "sonner";
import logoCi from "@/assets/logo-ci.png";

const MATERIALS = ["FRESA", "BGS", "RAP ESPUMADO"];
const DESTINATIONS = ["Canteiro", "Bota-fora"];

function DepartureForm() {
  const queryClient = useQueryClient();
  const { data: ogsData } = useOgsReference();
  const [placa, setPlaca] = useState("");
  const [placaCustom, setPlacaCustom] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [originOgs, setOriginOgs] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: trailerFleets } = useQuery({
    queryKey: ["trailer_fleets_trucker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trailer_fleets").select("*").order("fleet_number");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    const finalPlaca = placa === "__custom__" ? placaCustom.trim().toUpperCase() : placa;
    if (!finalPlaca || !material || !quantity || !destination) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    let geoStr: string | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      geoStr = `${pos.coords.latitude},${pos.coords.longitude}`;
    } catch {
      // GPS not available
    }

    const { error } = await supabase.from("trucker_trips").insert({
      truck_plate: finalPlaca,
      material_type: material,
      quantity: parseFloat(quantity),
      origin_ogs_id: originOgs || null,
      destination_id: destination,
      departure_time: new Date().toISOString(),
      departure_geo: geoStr,
      status: "EM TRÂNSITO",
      date: new Date().toISOString().split("T")[0],
    });

    setSubmitting(false);
    if (error) {
      toast.error("Erro ao lançar saída: " + error.message);
    } else {
      toast.success("Saída registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["trucker_in_transit"] });
      setPlaca("");
      setPlacaCustom("");
      setMaterial("");
      setQuantity("");
      setOriginOgs("");
      setDestination("");
    }
  };

  return (
    <div className="space-y-5 p-1">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Lançar Saída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Placa */}
          <div className="space-y-1.5">
            <Label>Placa do Caminhão *</Label>
            <Select value={placa} onValueChange={setPlaca}>
              <SelectTrigger><SelectValue placeholder="Selecione ou digite" /></SelectTrigger>
              <SelectContent>
                {trailerFleets?.map((f) => (
                  <SelectItem key={f.id} value={f.fleet_number || f.id}>{f.fleet_number}</SelectItem>
                ))}
                <SelectItem value="__custom__">Outro (digitar)</SelectItem>
              </SelectContent>
            </Select>
            {placa === "__custom__" && (
              <Input placeholder="Digite a placa" value={placaCustom} onChange={(e) => setPlacaCustom(e.target.value)} className="mt-1" />
            )}
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label>Material *</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
              <SelectContent>
                {MATERIALS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label>Quantidade (m³) *</Label>
            <Input type="number" inputMode="decimal" placeholder="0.00" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          {/* OGS Origem */}
          <div className="space-y-1.5">
            <Label>OGS de Origem</Label>
            <Select value={originOgs} onValueChange={setOriginOgs}>
              <SelectTrigger><SelectValue placeholder="Selecione a OGS" /></SelectTrigger>
              <SelectContent>
                {ogsData?.map((o) => (
                  <SelectItem key={o.id} value={o.ogs_number || o.id}>{o.ogs_number} — {o.client_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destino */}
          <div className="space-y-1.5">
            <Label>Destino *</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 text-base font-bold mt-2">
            {submitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <MapPin className="mr-2 h-5 w-5" />}
            Lançar Saída
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ArrivalList() {
  const queryClient = useQueryClient();

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trucker_in_transit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trucker_trips")
        .select("*")
        .eq("status", "EM TRÂNSITO")
        .order("departure_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const confirmArrival = async (id: string) => {
    let geoStr: string | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      geoStr = `${pos.coords.latitude},${pos.coords.longitude}`;
    } catch {
      // GPS not available
    }

    const { error } = await supabase
      .from("trucker_trips")
      .update({
        arrival_time: new Date().toISOString(),
        arrival_geo: geoStr,
        status: "CONCLUÍDO",
      })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao confirmar: " + error.message);
    } else {
      toast.success("Recebimento confirmado!");
      queryClient.invalidateQueries({ queryKey: ["trucker_in_transit"] });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;

  if (!trips?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <CheckCircle2 className="h-12 w-12" />
        <p className="text-sm font-medium">Nenhum caminhão em trânsito</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-1">
      {trips.map((trip) => (
        <Card key={trip.id} className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">{trip.truck_plate}</span>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> EM TRÂNSITO
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Material:</span> <span className="font-medium">{trip.material_type}</span></div>
              <div><span className="text-muted-foreground">Qtd:</span> <span className="font-medium">{trip.quantity} m³</span></div>
              <div><span className="text-muted-foreground">Destino:</span> <span className="font-medium">{trip.destination_id}</span></div>
              <div><span className="text-muted-foreground">Saída:</span> <span className="font-medium">{trip.departure_time ? new Date(trip.departure_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
            </div>
            <Button onClick={() => confirmArrival(trip.id)} className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="mr-2 h-6 w-6" /> Confirmar Recebimento
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TruckerHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div>
          <h1 className="font-display font-bold text-base leading-tight">CI Carreteiros</h1>
          <p className="text-[10px] text-primary-foreground/70">Logística de Materiais</p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5">
        <Tabs defaultValue="saida" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="saida" className="text-sm font-semibold">🚚 Saída (Obra)</TabsTrigger>
            <TabsTrigger value="chegada" className="text-sm font-semibold">📦 Chegada (Canteiro)</TabsTrigger>
          </TabsList>
          <TabsContent value="saida">
            <DepartureForm />
          </TabsContent>
          <TabsContent value="chegada">
            <ArrivalList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

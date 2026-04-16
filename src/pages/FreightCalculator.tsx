import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Calculator, MapPin, Route, DollarSign, Clock,
  Save, Loader2, Trash2, History, Truck
} from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

declare global {
  interface Window {
    google: any;
  }
}

// ─── Autocomplete Input ───
function PlacesAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "br" },
      fields: ["formatted_address", "geometry"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
      }
    });
  }, []);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
      />
    </div>
  );
}

// ─── Calculator Form ───
function CalculatorForm() {
  const queryClient = useQueryClient();
  const { data: ogsData } = useOgsReference();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [valorKm, setValorKm] = useState("3.50");
  const [eixos, setEixos] = useState("5");
  const [pedagio, setPedagio] = useState("0");
  const [adicionais, setAdicionais] = useState("0");
  const [adicionaisDesc, setAdicionaisDesc] = useState("");
  const [ogsId, setOgsId] = useState("");
  const [contrato, setContrato] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeCalculated, setRouteCalculated] = useState(false);

  const parseNum = (v: string) => parseFloat(v.replace(",", ".")) || 0;

  const totalFrete = distanceKm
    ? distanceKm * parseNum(valorKm) + parseNum(pedagio) + parseNum(adicionais)
    : 0;

  const calculateRoute = useCallback(async () => {
    if (!origin.trim() || !destination.trim()) {
      toast.error("Preencha Origem e Destino.");
      return;
    }

    if (!window.google?.maps) {
      toast.error("Google Maps ainda está carregando. Tente novamente.");
      return;
    }

    setCalculating(true);
    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        avoidHighways: false,
      },
      (result: any, status: string) => {
        setCalculating(false);
        if (status === "OK" && result.routes?.[0]?.legs?.[0]) {
          const leg = result.routes[0].legs[0];
          const km = Math.round((leg.distance.value / 1000) * 10) / 10;
          const min = Math.round(leg.duration.value / 60);
          setDistanceKm(km);
          setDurationMin(min);
          setRouteCalculated(true);
          toast.success(`Rota calculada: ${km} km, ~${min} min`);
        } else {
          toast.error("Não foi possível calcular a rota. Verifique os endereços.");
        }
      }
    );
  }, [origin, destination]);

  const handleSave = async () => {
    if (!distanceKm) {
      toast.error("Calcule a rota primeiro.");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("trucker_freight_calculations").insert({
      origin_address: origin,
      destination_address: destination,
      distance_km: distanceKm,
      duration_minutes: durationMin,
      valor_por_km: parseNum(valorKm),
      quantidade_eixos: parseInt(eixos) || 5,
      pedagio_estimado: parseNum(pedagio),
      adicionais: parseNum(adicionais),
      adicionais_descricao: adicionaisDesc || null,
      total_frete: totalFrete,
      ogs_id: ogsId || null,
      contrato: contrato || null,
      user_id: user?.id || null,
    } as any);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Cálculo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["freight_history"] });
    }
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  return (
    <div className="space-y-4 p-1">
      {/* Addresses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Endereços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlacesAutocomplete
            label="Origem (Usina / Base)"
            value={origin}
            onChange={setOrigin}
            placeholder="Digite o endereço de origem..."
          />
          <PlacesAutocomplete
            label="Destino (Frente de Obra)"
            value={destination}
            onChange={setDestination}
            placeholder="Digite o endereço de destino..."
          />
          <Button
            onClick={calculateRoute}
            disabled={calculating}
            className="w-full h-11 font-bold"
          >
            {calculating ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <Route className="mr-2 h-4 w-4" />
            )}
            Calcular Rota
          </Button>
        </CardContent>
      </Card>

      {/* Route result */}
      {routeCalculated && distanceKm !== null && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <Route className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{distanceKm} km</p>
              <p className="text-xs text-muted-foreground">Distância</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">
                {durationMin ? formatDuration(durationMin) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Tempo Estimado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Valores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor por KM (R$/km)</Label>
              <Input
                value={valorKm}
                onChange={(e) => setValorKm(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade de Eixos</Label>
              <Select value={eixos} onValueChange={setEixos}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 9].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} eixos</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pedágios (R$)</Label>
              <Input
                value={pedagio}
                onChange={(e) => setPedagio(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Adicionais (R$)</Label>
              <Input
                value={adicionais}
                onChange={(e) => setAdicionais(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição Adicionais</Label>
            <Input
              placeholder="Ex: Carga/Descarga, Estadia..."
              value={adicionaisDesc}
              onChange={(e) => setAdicionaisDesc(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* OGS / Contract */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Vincular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>OGS (opcional)</Label>
            <Select value={ogsId} onValueChange={setOgsId}>
              <SelectTrigger><SelectValue placeholder="Selecione a OGS" /></SelectTrigger>
              <SelectContent>
                {(ogsData || []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.ogs_number} — {o.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contrato (opcional)</Label>
            <Input
              placeholder="Número do contrato"
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Result Card */}
      {routeCalculated && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Resumo do Frete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Distância × Valor/KM</span>
              <span>{distanceKm} km × {formatCurrency(parseNum(valorKm))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>= Subtotal KM</span>
              <span className="font-medium">{formatCurrency((distanceKm || 0) * parseNum(valorKm))}</span>
            </div>
            {parseNum(pedagio) > 0 && (
              <div className="flex justify-between text-sm">
                <span>+ Pedágios</span>
                <span>{formatCurrency(parseNum(pedagio))}</span>
              </div>
            )}
            {parseNum(adicionais) > 0 && (
              <div className="flex justify-between text-sm">
                <span>+ Adicionais {adicionaisDesc ? `(${adicionaisDesc})` : ""}</span>
                <span>{formatCurrency(parseNum(adicionais))}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total Frete</span>
              <span className="text-primary">{formatCurrency(totalFrete)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      {routeCalculated && (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 text-base font-bold"
        >
          {saving ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
          Salvar Cálculo
        </Button>
      )}
    </div>
  );
}

// ─── History Tab ───
function HistoryTab() {
  const queryClient = useQueryClient();
  const { data: ogsData } = useOgsReference();

  const { data: history, isLoading } = useQuery({
    queryKey: ["freight_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trucker_freight_calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const handleDelete = async (id: string) => {
    await supabase.from("trucker_freight_calculations").delete().eq("id", id);
    toast.success("Registro removido");
    queryClient.invalidateQueries({ queryKey: ["freight_history"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <History className="h-12 w-12" />
        <p className="text-sm font-medium">Nenhum cálculo salvo</p>
      </div>
    );
  }

  const formatCurrency = (v: number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-3 p-1">
      {history.map((h: any) => {
        const ogs = ogsData?.find((o: any) => o.id === h.ogs_id);
        return (
          <Card key={h.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-sm font-medium truncate">📍 {h.origin_address}</p>
                  <p className="text-sm font-medium truncate">📌 {h.destination_address}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleDelete(h.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{Number(h.distance_km).toFixed(1)} km</Badge>
                <Badge variant="outline">{formatCurrency(h.valor_por_km)}/km</Badge>
                {ogs && <Badge className="bg-primary/10 text-primary border-primary/20">{ogs.ogs_number}</Badge>}
                {h.contrato && <Badge variant="outline">{h.contrato}</Badge>}
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(h.total_frete)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Page ───
export default function FreightCalculator() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/carreteiros")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <h1 className="font-display font-bold text-base leading-tight">Calculadora de Fretes</h1>
          <p className="text-[10px] text-primary-foreground/70">Google Maps + Custo Automático</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <Tabs defaultValue="calculadora" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="calculadora" className="text-sm font-semibold">
              <Calculator className="h-4 w-4 mr-1.5" /> Calcular
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-sm font-semibold">
              <History className="h-4 w-4 mr-1.5" /> Histórico
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calculadora">
            <CalculatorForm />
          </TabsContent>
          <TabsContent value="historico">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

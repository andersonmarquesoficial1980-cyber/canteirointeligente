import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Bus, MapPin, Clock, Route, Search, Loader2, DollarSign,
} from "lucide-react";
import logoCi from "@/assets/logo-ci.png";

declare global {
  interface Window {
    google: any;
  }
}

interface Tarifa {
  id: string;
  tipo_transporte: string;
  valor_unitario: number;
  ativo: boolean;
}

interface TransitStep {
  mode: string;
  line: string;
  vehicle: string;
  departureStop: string;
  arrivalStop: string;
  numStops: number;
  duration: string;
  distance: string;
}

interface TransitResult {
  duration: string;
  distance: string;
  departureTime: string;
  arrivalTime: string;
  steps: TransitStep[];
  fareEstimate: number;
}

function PlacesAutocomplete({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    if (autocompleteRef.current) return;

    const tryInit = () => {
      if (!inputRef.current || !window.google?.maps?.places) return false;
      try {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "br" },
          fields: ["formatted_address"],
        });
        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (place?.formatted_address) {
            onChange(place.formatted_address);
          }
        });
        setMapsReady(true);
        return true;
      } catch {
        return false;
      }
    };

    if (!tryInit()) {
      const interval = setInterval(() => {
        if (tryInit()) clearInterval(interval);
      }, 1000);
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
  }, []);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {!mapsReady && (
          <span className="text-[10px] text-muted-foreground font-normal">(digitação manual)</span>
        )}
      </Label>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      />
    </div>
  );
}

function getModeLabel(mode: string): string {
  const map: Record<string, string> = {
    BUS: "🚌 Ônibus",
    SUBWAY: "🚇 Metrô",
    RAIL: "🚆 Trem",
    TRAM: "🚊 VLT",
    WALKING: "🚶 A pé",
  };
  return map[mode] || mode;
}

function estimateFareFromSteps(steps: TransitStep[], tarifas: Tarifa[]): number {
  const tarifaMap: Record<string, number> = {};
  for (const t of tarifas) {
    const key = t.tipo_transporte.toLowerCase();
    tarifaMap[key] = t.valor_unitario;
  }

  let total = 0;
  for (const step of steps) {
    if (step.mode === "WALKING") continue;
    const modeKey = step.mode.toLowerCase();
    // Try to match tarifa
    if (modeKey === "bus" && (tarifaMap["ônibus municipal"] || tarifaMap["ônibus intermunicipal"] || tarifaMap["ônibus"])) {
      total += tarifaMap["ônibus municipal"] || tarifaMap["ônibus intermunicipal"] || tarifaMap["ônibus"] || 0;
    } else if (modeKey === "subway" && (tarifaMap["metrô"] || tarifaMap["metro"])) {
      total += tarifaMap["metrô"] || tarifaMap["metro"] || 0;
    } else if (modeKey === "rail" && (tarifaMap["trem"] || tarifaMap["train"])) {
      total += tarifaMap["trem"] || tarifaMap["train"] || 0;
    } else if (modeKey === "tram" && (tarifaMap["vlt"] || tarifaMap["brt"])) {
      total += tarifaMap["vlt"] || tarifaMap["brt"] || 0;
    } else {
      // fallback: try any partial match
      const match = Object.entries(tarifaMap).find(([k]) => k.includes(modeKey) || modeKey.includes(k));
      if (match) total += match[1];
    }
  }
  return total;
}

export default function TrajetoVT() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransitResult | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);

  useEffect(() => {
    supabase
      .from("vt_tarifas")
      .select("*")
      .eq("ativo", true)
      .order("tipo_transporte")
      .then(({ data }) => {
        if (data) setTarifas(data as any as Tarifa[]);
      });
  }, []);

  const handleCalculate = () => {
    if (!origin.trim() || !destination.trim()) return;
    if (!window.google?.maps) {
      alert("Google Maps não carregou. Recarregue a página.");
      return;
    }

    setLoading(true);
    setResult(null);

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.TRANSIT,
        transitOptions: {
          modes: [
            window.google.maps.TransitMode.BUS,
            window.google.maps.TransitMode.RAIL,
            window.google.maps.TransitMode.SUBWAY,
            window.google.maps.TransitMode.TRAM,
          ],
        },
      },
      (response: any, status: string) => {
        setLoading(false);
        if (status !== "OK" || !response?.routes?.[0]?.legs?.[0]) {
          alert("Não foi possível calcular a rota de transporte público para esses endereços.");
          return;
        }

        const leg = response.routes[0].legs[0];
        const steps: TransitStep[] = [];

        for (const step of leg.steps) {
          if (step.travel_mode === "TRANSIT") {
            const transit = step.transit;
            steps.push({
              mode: transit.line.vehicle.type,
              line: transit.line.short_name || transit.line.name || "",
              vehicle: transit.line.vehicle.name || "",
              departureStop: transit.departure_stop.name,
              arrivalStop: transit.arrival_stop.name,
              numStops: transit.num_stops || 0,
              duration: step.duration.text,
              distance: step.distance.text,
            });
          } else {
            steps.push({
              mode: "WALKING",
              line: "",
              vehicle: "A pé",
              departureStop: "",
              arrivalStop: "",
              numStops: 0,
              duration: step.duration.text,
              distance: step.distance.text,
            });
          }
        }

        const fareEstimate = estimateFareFromSteps(steps, tarifas);

        setResult({
          duration: leg.duration.text,
          distance: leg.distance.text,
          departureTime: leg.departure_time?.text || "",
          arrivalTime: leg.arrival_time?.text || "",
          steps,
          fareEstimate,
        });
      }
    );
  };

  const custoMensal = result ? result.fareEstimate * 2 * 22 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <h1 className="font-display font-bold text-base leading-tight">Trajeto e VT</h1>
          <p className="text-[10px] text-primary-foreground/70">Transporte Público de Funcionários</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Address inputs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" /> Calcular Trajeto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PlacesAutocomplete
              label="Residência do Funcionário (Origem)"
              placeholder="Digite o endereço de casa..."
              value={origin}
              onChange={setOrigin}
            />
            <PlacesAutocomplete
              label="Frente de Obra / Aeroporto (Destino)"
              placeholder="Digite o local de trabalho..."
              value={destination}
              onChange={setDestination}
            />
            <Button
              onClick={handleCalculate}
              disabled={loading || !origin.trim() || !destination.trim()}
              className="w-full h-12 text-base font-bold"
            >
              {loading ? (
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
              ) : (
                <Bus className="mr-2 h-5 w-5" />
              )}
              Calcular Trajeto
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <>
            {/* Summary */}
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo estimado</p>
                      <p className="font-bold text-sm">{result.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Distância</p>
                      <p className="font-bold text-sm">{result.distance}</p>
                    </div>
                  </div>
                </div>

                {(result.departureTime || result.arrivalTime) && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {result.departureTime && <span>Saída: {result.departureTime}</span>}
                    {result.departureTime && result.arrivalTime && <span> → </span>}
                    {result.arrivalTime && <span>Chegada: {result.arrivalTime}</span>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Itinerary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Itinerário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      step.mode === "WALKING" ? "bg-muted/30" : "bg-primary/5 border border-primary/10"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <Badge
                        variant={step.mode === "WALKING" ? "outline" : "default"}
                        className={step.mode !== "WALKING" ? "bg-primary text-primary-foreground" : ""}
                      >
                        {step.line || getModeLabel(step.mode)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{getModeLabel(step.mode)}</p>
                      {step.mode !== "WALKING" && (
                        <p className="text-xs text-muted-foreground">
                          {step.departureStop} → {step.arrivalStop}
                          {step.numStops > 0 && ` (${step.numStops} paradas)`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{step.duration} · {step.distance}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Fare */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <p className="font-bold text-sm">Estimativa de Custo</p>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Passagem (1 trecho):</span>
                  <span className="font-medium">R$ {result.fareEstimate.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Custo diário (ida + volta):</span>
                  <span className="font-medium">R$ {(result.fareEstimate * 2).toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Custo mensal (22 dias):</span>
                  <span className="text-primary">R$ {custoMensal.toFixed(2).replace(".", ",")}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  * Valores calculados com base na tabela de tarifas fixas cadastrada no sistema.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

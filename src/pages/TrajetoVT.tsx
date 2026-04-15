import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
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
  fareSource: "google" | "tabela";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Array<{ place_id: string; description: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const serviceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);

  useEffect(() => {
    const tryInit = () => {
      if (!window.google?.maps?.places) return false;
      try {
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        const dummyDiv = document.createElement("div");
        placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        return true;
      } catch {
        return false;
      }
    };

    loadGoogleMaps()
      .then(() => {
        if (!tryInit()) {
          const interval = setInterval(() => {
            if (tryInit()) clearInterval(interval);
          }, 500);
          setTimeout(() => clearInterval(interval), 5000);
        }
      })
      .catch(() => {
        // Google Maps unavailable — manual input still works
      });
  }, []);

  const handleInputChange = (text: string) => {
    onChange(text);
    if (!serviceRef.current || text.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    serviceRef.current.getPlacePredictions(
      {
        input: text,
        componentRestrictions: { country: "br" },
        sessionToken: sessionTokenRef.current,
      },
      (predictions: any[] | null, status: string) => {
        if (status === "OK" && predictions) {
          setSuggestions(predictions.map((p) => ({ place_id: p.place_id, description: p.description })));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    );
  };

  const handleSelect = (placeId: string, description: string) => {
    onChange(description);
    setSuggestions([]);
    setShowSuggestions(false);
    // Refresh session token after selection
    if (window.google?.maps?.places) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <Label>{label}</Label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        autoComplete="off"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              className="px-3 py-2.5 text-sm cursor-pointer hover:bg-accent transition-colors"
              onMouseDown={() => handleSelect(s.place_id, s.description)}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
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

// Linhas que fazem parte do sistema metroferroviário integrado de SP
// Metrô (1-5,15) + CPTM (7-13) + ViaMobilidade (8,9) — integração gratuita entre si
const METRO_FERROVIARIO_PREFIXES = [
  "linha 1", "linha 2", "linha 3", "linha 4", "linha 5", "linha 15",
  "linha 7", "linha 8", "linha 9", "linha 10", "linha 11", "linha 12", "linha 13",
  "l1-", "l2-", "l3-", "l4-", "l5-",
];

function isMetroFerroviario(step: TransitStep): boolean {
  if (step.mode === "SUBWAY") return true;
  if (step.mode !== "RAIL" && step.mode !== "HEAVY_RAIL") return false;
  const lineName = (step.line || "").toLowerCase();
  return METRO_FERROVIARIO_PREFIXES.some(p => lineName.startsWith(p)) || lineName.includes("linha");
}

function isBusConectadoMetro(step: TransitStep, steps: TransitStep[], idx: number): boolean {
  // Ônibus que parte de terminal de metrô/trem pode ter integração
  // Detectar pelo nome da parada de origem
  const origem = (step.departureStop || "").toLowerCase();
  const integracaoKeywords = ["terminal metrô", "terminal metro", "estação", "metro ", "metrô ", "cptm", "terminal"];
  return integracaoKeywords.some(k => origem.includes(k));
}

function estimateFareFromSteps(steps: TransitStep[], tarifas: Tarifa[]): number {
  const tarifaMap: Record<string, number> = {};
  for (const t of tarifas) {
    const key = t.tipo_transporte.toLowerCase();
    tarifaMap[key] = t.valor_unitario;
  }

  // Tarifas base (da tabela ou valores reais SP 2026)
  const tarifaMetro      = tarifaMap["metrô"] || tarifaMap["metro"] || tarifaMap["trem"] || 5.40;
  const tarifaEmtu       = tarifaMap["emtu"] || tarifaMap["aeroporto"] || tarifaMap["airport"] || 8.00;
  const tarifaMetropoMet = tarifaMap["ônibus metropolitano"] || tarifaMap["metropolitano"] || 6.70;
  const tarifaIntermunic = tarifaMap["ônibus intermunicipal"] || tarifaMap["intermunicipal"] || 7.15;
  const tarifaMunicipal  = tarifaMap["ônibus municipal"] || tarifaMap["ônibus"] || tarifaMap["municipal"] || 6.10;

  let total = 0;
  let jaCobrouMetroFerroviario = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.mode === "WALKING") continue;

    // Sistema metroferroviário SP — cobrar só uma vez (integração gratuita entre Metrô/CPTM/ViaMobilidade)
    if (isMetroFerroviario(step)) {
      if (!jaCobrouMetroFerroviario) {
        total += tarifaMetro;
        jaCobrouMetroFerroviario = true;
      }
      continue;
    }

    // Ônibus — cada um cobrado separadamente (sem integração entre ônibus)
    if (step.mode === "BUS") {
      const line    = (step.line || "").toLowerCase();
      const vehicle = (step.vehicle || "").toLowerCase();
      const depart  = (step.departureStop || "").toLowerCase();
      const arrive  = (step.arrivalStop || "").toLowerCase();

      // EMTU / Airport Bus Service (linha 257, aeroporto, etc.)
      const isEmtu = line === "257" || line.includes("airport") || line.includes("aeroporto") ||
                     vehicle.includes("airport") || arrive.includes("aeroporto") || arrive.includes("airport");
      if (isEmtu) { total += tarifaEmtu; continue; }

      // Ônibus intermunicipais (linhas 1xx, 2xx, 3xx da região)
      const lineNum = parseInt(line.replace(/\D/g, ""));
      if (!isNaN(lineNum) && lineNum >= 100 && lineNum <= 399) {
        total += tarifaIntermunic;
        continue;
      }

      // Ônibus metropolitanos EMTU (linhas 4xx, 5xx)
      if (!isNaN(lineNum) && lineNum >= 400 && lineNum <= 599) {
        total += tarifaMetropoMet;
        continue;
      }

      // Municipal (linhas com letra como A165C1, A112 = Barueri)
      total += tarifaMunicipal;
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const calculatingRef = useRef(false);

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
    // Prevent double-fire
    if (calculatingRef.current) return;
    calculatingRef.current = true;

    if (!window.google?.maps?.DirectionsService) {
      setErrorMsg("Google Maps não carregou. Recarregue a página ou insira os valores manualmente.");
      calculatingRef.current = false;
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMsg(null);

    try {
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
          calculatingRef.current = false;

          if (status !== "OK" || !response?.routes?.[0]?.legs?.[0]) {
            setErrorMsg("Rota de transporte público não encontrada. Insira os valores manualmente.");
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

          let fareValue = 0;
          let fareSource: "google" | "tabela" = "tabela";

          // Try to read fare from Google response
          const googleFare = response.routes[0].fare;
          if (googleFare && googleFare.value > 0) {
            fareValue = googleFare.value;
            fareSource = "google";
          } else {
            fareValue = estimateFareFromSteps(steps, tarifas);
            fareSource = "tabela";
          }

          setResult({
            duration: leg.duration.text,
            distance: leg.distance.text,
            departureTime: leg.departure_time?.text || "",
            arrivalTime: leg.arrival_time?.text || "",
            steps,
            fareEstimate: fareValue,
            fareSource,
          });
        }
      );
    } catch (err) {
      setLoading(false);
      calculatingRef.current = false;
      setErrorMsg("Erro ao acessar o Google Maps. Verifique se a API está ativada.");
    }
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
            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
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
                  <span className="flex items-center gap-1">
                    Passagem (1 trecho)
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-auto font-normal">
                      {result.fareSource === "google" ? "Valor real via Google" : "Estimado via Tabela"}
                    </Badge>
                  </span>
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
                  {result.fareSource === "google"
                    ? "* Valor real obtido via Google Maps."
                    : "* Valor estimado com base na tabela de tarifas fixas cadastrada no sistema."}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

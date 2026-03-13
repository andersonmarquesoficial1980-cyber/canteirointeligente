import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale, Camera, AlertTriangle, CheckCircle } from "lucide-react";

interface CalibrationEntry {
  tentativa: number;
  pesoNominalUsina: string;
  pesoRealReferencia: string;
  taraCaminhao: string;
}

export default function KmaCalibrationSection() {
  const [entries, setEntries] = useState<CalibrationEntry[]>([
    { tentativa: 1, pesoNominalUsina: "", pesoRealReferencia: "", taraCaminhao: "" },
  ]);

  const updateEntry = (index: number, field: keyof CalibrationEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const addEntry = () => {
    if (entries.length < 5) {
      setEntries((prev) => [
        ...prev,
        { tentativa: prev.length + 1, pesoNominalUsina: "", pesoRealReferencia: "", taraCaminhao: "" },
      ]);
    }
  };

  const calcDiff = (entry: CalibrationEntry) => {
    const nominal = Number(entry.pesoNominalUsina);
    const real = Number(entry.pesoRealReferencia);
    if (!nominal || !real) return null;
    const diff = ((real - nominal) / nominal) * 100;
    return diff;
  };

  const calcFator = (entry: CalibrationEntry) => {
    const nominal = Number(entry.pesoNominalUsina);
    const real = Number(entry.pesoRealReferencia);
    if (!nominal || !real) return null;
    return real / nominal;
  };

  return (
    <Card className="border-accent/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Scale className="w-5 h-5 text-accent" />
          Demonstrativo KMA — Calibração de Pesagem
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Foto do ticket obrigatória quando diferença {"<"} 1%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry, idx) => {
          const diff = calcDiff(entry);
          const fator = calcFator(entry);
          const needsPhoto = diff !== null && Math.abs(diff) < 1;
          const isOk = diff !== null && Math.abs(diff) < 1;

          return (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Tentativa {entry.tentativa}
                </span>
                {diff !== null && (
                  <Badge variant={isOk ? "default" : "destructive"} className="text-xs gap-1">
                    {isOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    Δ {diff.toFixed(2)}%
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso Nominal Usina (kg)</Label>
                  <Input
                    type="number"
                    value={entry.pesoNominalUsina}
                    onChange={(e) => updateEntry(idx, "pesoNominalUsina", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso Real Referência (kg)</Label>
                  <Input
                    type="number"
                    value={entry.pesoRealReferencia}
                    onChange={(e) => updateEntry(idx, "pesoRealReferencia", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tara Caminhão (kg)</Label>
                  <Input
                    type="number"
                    value={entry.taraCaminhao}
                    onChange={(e) => updateEntry(idx, "taraCaminhao", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              {fator !== null && (
                <p className="text-xs text-muted-foreground">
                  Fator de ajuste: <span className="font-semibold text-foreground">{fator.toFixed(4)}</span>
                </p>
              )}

              {needsPhoto && (
                <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md p-2">
                  <Camera className="w-4 h-4 text-accent" />
                  <span className="text-xs text-accent font-medium">
                    Diferença {"<"} 1% — Foto do ticket obrigatória
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {entries.length < 5 && (
          <button
            type="button"
            onClick={addEntry}
            className="w-full border border-dashed border-border rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            + Adicionar tentativa
          </button>
        )}
      </CardContent>
    </Card>
  );
}

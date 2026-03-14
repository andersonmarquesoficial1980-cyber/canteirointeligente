import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Camera, AlertTriangle, CheckCircle, FileText, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { useToast } from "@/hooks/use-toast";

export interface CalibrationEntry {
  tentativa: number;
  tara: string;
  pesoNominal: string;
  pesoReal: string;
  ticketPhotoFile: File | null;
  ticketPhotoPreview: string | null;
}

interface Props {
  entries: CalibrationEntry[];
  onChange: (entries: CalibrationEntry[]) => void;
  onGeneratePdf?: () => void;
}

export function createEmptyCalibration(tentativa: number): CalibrationEntry {
  return {
    tentativa,
    tara: "",
    pesoNominal: "",
    pesoReal: "",
    ticketPhotoFile: null,
    ticketPhotoPreview: null,
  };
}

export function calcDiffPercent(entry: CalibrationEntry): number | null {
  const nominal = Number(entry.pesoNominal);
  const real = Number(entry.pesoReal);
  if (!nominal || !real) return null;
  return ((real - nominal) / nominal) * 100;
}

export function calcFator(entry: CalibrationEntry): number | null {
  const nominal = Number(entry.pesoNominal);
  const real = Number(entry.pesoReal);
  if (!nominal || !real) return null;
  return real / nominal;
}

export default function KmaCalibrationSection({ entries, onChange, onGeneratePdf }: Props) {
  const { toast } = useToast();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [compressing, setCompressing] = useState<number | null>(null);

  const updateEntry = (index: number, field: keyof CalibrationEntry, value: any) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e));
    onChange(updated);
  };

  const addEntry = () => {
    if (entries.length < 5) {
      onChange([...entries, createEmptyCalibration(entries.length + 1)]);
    }
  };

  const handlePhotoCapture = async (index: number, file: File) => {
    setCompressing(index);
    try {
      const compressed = await compressImage(file, 1);
      const preview = URL.createObjectURL(compressed);
      const updated = entries.map((e, i) =>
        i === index ? { ...e, ticketPhotoFile: compressed, ticketPhotoPreview: preview } : e
      );
      onChange(updated);
      toast({ title: "📸 Foto comprimida!", description: `${(compressed.size / 1024).toFixed(0)} KB — pronta para envio.` });
    } catch (err: any) {
      toast({ title: "Erro ao comprimir foto", description: err.message, variant: "destructive" });
    } finally {
      setCompressing(null);
    }
  };

  const clearPhoto = (index: number) => {
    const updated = entries.map((e, i) =>
      i === index ? { ...e, ticketPhotoFile: null, ticketPhotoPreview: null } : e
    );
    onChange(updated);
  };

  return (
    <Card className="border-accent/30 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-accent" />
            Calibração KMA — Pesagem
          </CardTitle>
          {onGeneratePdf && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onGeneratePdf}>
              <FileText className="w-3.5 h-3.5" /> Gerar Demonstrativo
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Foto do ticket obrigatória quando diferença {"<"} 1%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry, idx) => {
          const diff = calcDiffPercent(entry);
          const fator = calcFator(entry);
          const showPhotoBtn = diff !== null && Math.abs(diff) < 1;
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
                  <Label className="text-xs">Tara (kg)</Label>
                  <Input
                    type="number"
                    value={entry.tara}
                    onChange={(e) => updateEntry(idx, "tara", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso Nominal Usina (kg)</Label>
                  <Input
                    type="number"
                    value={entry.pesoNominal}
                    onChange={(e) => updateEntry(idx, "pesoNominal", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Peso Real Referência (kg)</Label>
                  <Input
                    type="number"
                    value={entry.pesoReal}
                    onChange={(e) => updateEntry(idx, "pesoReal", e.target.value)}
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

              {/* Photo button ONLY when diff < 1% */}
              {showPhotoBtn && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md p-2">
                    <Camera className="w-4 h-4 text-accent" />
                    <span className="text-xs text-accent font-medium">
                      Diferença {"<"} 1% — Foto do ticket obrigatória
                    </span>
                  </div>

                  {entry.ticketPhotoPreview ? (
                    <div className="relative inline-block">
                      <img src={entry.ticketPhotoPreview} alt="Ticket" className="rounded-md max-h-32 border border-border" />
                      <button
                        type="button"
                        onClick={() => clearPhoto(idx)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={(el) => { fileInputRefs.current[idx] = el; }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoCapture(idx, f);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={compressing === idx}
                        onClick={() => fileInputRefs.current[idx]?.click()}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {compressing === idx ? "Comprimindo..." : "Capturar Foto do Ticket"}
                      </Button>
                    </>
                  )}
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

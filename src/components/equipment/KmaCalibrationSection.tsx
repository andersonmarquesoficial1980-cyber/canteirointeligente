import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Camera, AlertTriangle, CheckCircle, FileText, X, ShieldCheck, ShieldAlert } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { useToast } from "@/hooks/use-toast";

export interface CalibrationEntry {
  tentativa: number;
  tara: string;
  pesoNominal: string;
  pesoReal: string;
  fator: string;
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
    fator: "",
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
    <div className="space-y-3 bg-card border border-border rounded-2xl p-4 shadow-card">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-display font-extrabold text-primary uppercase tracking-wide">
              CALIBRAGEM DA USINA
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Controle de pesagem — Foto obrigatória quando diferença {"<"} 1%
            </p>
          </div>
        </div>
        {onGeneratePdf && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
            onClick={onGeneratePdf}
          >
            <FileText className="w-3.5 h-3.5" /> Gerar PDF
          </Button>
        )}
      </div>

      {/* Calibration Entries */}
      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const diff = calcDiffPercent(entry);
          const fator = calcFator(entry);
          const isApproved = diff !== null && Math.abs(diff) < 1;
          const isFailed = diff !== null && Math.abs(diff) >= 1;
          const showPhotoBtn = isApproved;

          return (
            <div
              key={idx}
              className={`border-2 rounded-xl p-4 space-y-3 transition-colors ${
                isApproved
                  ? "border-green-400/60 bg-green-50/30"
                  : isFailed
                  ? "border-red-400/60 bg-red-50/30"
                  : "border-border bg-secondary/30"
              }`}
            >
              {/* Attempt Header with Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-display font-extrabold text-primary">
                  {entry.tentativa}ª Tentativa
                </span>
                {diff !== null && (
                  isApproved ? (
                    <div className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      DENTRO DO PADRÃO
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      FORA DO PADRÃO
                    </div>
                  )
                )}
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase tracking-wide">Tara do Caminhão (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.tara}
                    onChange={(e) => updateEntry(idx, "tara", e.target.value)}
                    placeholder="0"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase tracking-wide">Peso Nominal Usina (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.pesoNominal}
                    onChange={(e) => updateEntry(idx, "pesoNominal", e.target.value)}
                    placeholder="0"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase tracking-wide">Peso Real Referência (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.pesoReal}
                    onChange={(e) => updateEntry(idx, "pesoReal", e.target.value)}
                    placeholder="0"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-primary uppercase tracking-wide">Fator de Ajuste</Label>
                  <div className="flex items-center h-10 px-3 bg-muted/50 border border-border rounded-md text-sm font-semibold text-foreground">
                    {fator !== null ? fator.toFixed(4) : "—"}
                  </div>
                </div>
              </div>

              {/* Real-time Difference Display */}
              {diff !== null && (
                <div
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    isApproved
                      ? "bg-green-100/60 border border-green-300/60"
                      : "bg-red-100/60 border border-red-300/60"
                  }`}
                >
                  <span className="text-xs font-bold text-foreground">Diferença Calculada:</span>
                  <span
                    className={`text-lg font-display font-extrabold ${
                      isApproved ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {diff.toFixed(2)}%
                  </span>
                </div>
              )}

              {/* Photo button ONLY when approved (diff < 1%) */}
              {showPhotoBtn && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-green-100/50 border border-green-300/50 rounded-lg p-2.5">
                    <Camera className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700 font-bold">
                      ✅ Aprovado! Capture a foto do ticket de pesagem
                    </span>
                  </div>

                  {entry.ticketPhotoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={entry.ticketPhotoPreview}
                        alt="Ticket"
                        className="rounded-xl max-h-36 border-2 border-green-300/60 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => clearPhoto(idx)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform"
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
                        size="sm"
                        className="gap-2 text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-md"
                        disabled={compressing === idx}
                        onClick={() => fileInputRefs.current[idx]?.click()}
                      >
                        <Camera className="w-4 h-4" />
                        {compressing === idx ? "Comprimindo..." : "📷 Tirar Foto do Ticket de Pesagem"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Attempt Button */}
      {entries.length < 5 && (
        <button
          type="button"
          onClick={addEntry}
          className="w-full border-2 border-dashed border-primary/30 rounded-xl py-3 text-sm font-bold text-primary hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all"
        >
          + Adicionar Tentativa
        </button>
      )}
    </div>
  );
}

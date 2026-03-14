import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Camera, AlertTriangle, CheckCircle, FileText, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CalibrationEntry {
  tentativa: number;
  pesoNominalUsina: string;
  pesoRealReferencia: string;
  taraCaminhao: string;
  ticketPhotoUrl: string | null;
  ticketPhotoFile: File | null;
}

interface Props {
  entries: CalibrationEntry[];
  onChange: (entries: CalibrationEntry[]) => void;
  diaryId?: string | null;
  onGeneratePdf?: () => void;
}

export function createEmptyCalibration(tentativa: number): CalibrationEntry {
  return { tentativa, pesoNominalUsina: "", pesoRealReferencia: "", taraCaminhao: "", ticketPhotoUrl: null, ticketPhotoFile: null };
}

export function calcDiffPercent(entry: CalibrationEntry): number | null {
  const nominal = Number(entry.pesoNominalUsina);
  const real = Number(entry.pesoRealReferencia);
  if (!nominal || !real) return null;
  return ((real - nominal) / nominal) * 100;
}

export function calcFator(entry: CalibrationEntry): number | null {
  const nominal = Number(entry.pesoNominalUsina);
  const real = Number(entry.pesoRealReferencia);
  if (!nominal || !real) return null;
  return real / nominal;
}

export default function KmaCalibrationSection({ entries, onChange, diaryId, onGeneratePdf }: Props) {
  const { toast } = useToast();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);

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
    setUploading(index);
    try {
      const compressed = await compressImage(file, 1000);
      const compressedFile = new File([compressed], `ticket_${index + 1}.jpg`, { type: "image/jpeg" });

      if (diaryId) {
        const path = `kma-tickets/${diaryId}/tentativa_${index + 1}_${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("notas_fiscais").upload(path, compressed, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
        updateEntry(index, "ticketPhotoUrl", urlData.publicUrl);
        updateEntry(index, "ticketPhotoFile", null);
        toast({ title: "📸 Foto salva!", description: `Ticket da tentativa ${index + 1} enviado.` });
      } else {
        updateEntry(index, "ticketPhotoFile", compressedFile);
        updateEntry(index, "ticketPhotoUrl", URL.createObjectURL(compressed));
        toast({ title: "📸 Foto capturada!", description: "Será enviada ao salvar o diário." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao processar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  return (
    <Card className="border-accent/30 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-accent" />
            Demonstrativo KMA — Calibração de Pesagem
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md p-2">
                    <Camera className="w-4 h-4 text-accent" />
                    <span className="text-xs text-accent font-medium">
                      Diferença {"<"} 1% — Foto do ticket obrigatória
                    </span>
                  </div>

                  {entry.ticketPhotoUrl ? (
                    <div className="relative inline-block">
                      <img src={entry.ticketPhotoUrl} alt="Ticket" className="rounded-md max-h-32 border border-border" />
                      <button
                        type="button"
                        onClick={() => { updateEntry(idx, "ticketPhotoUrl", null); updateEntry(idx, "ticketPhotoFile", null); }}
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
                        disabled={uploading === idx}
                        onClick={() => fileInputRefs.current[idx]?.click()}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {uploading === idx ? "Comprimindo..." : "Capturar Foto do Ticket"}
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

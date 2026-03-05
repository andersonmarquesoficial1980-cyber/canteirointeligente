import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface ProducaoEntry {
  id: string;
  tipo_servico: string;
  rodovia: string;
  sentido: string;
  faixa: string;
  km_inicial: string;
  km_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_cm: string;
}

const emptyEntry = (): ProducaoEntry => ({
  id: crypto.randomUUID(),
  tipo_servico: "",
  rodovia: "",
  sentido: "",
  faixa: "",
  km_inicial: "",
  km_final: "",
  comprimento_m: "",
  largura_m: "",
  espessura_cm: "",
});

interface StepProducaoProps {
  entries: ProducaoEntry[];
  onChange: (entries: ProducaoEntry[]) => void;
}

function calcArea(c: string, l: string) {
  const comp = parseFloat(c);
  const larg = parseFloat(l);
  if (isNaN(comp) || isNaN(larg)) return null;
  return comp * larg;
}

function calcVolume(c: string, l: string, e: string) {
  const area = calcArea(c, l);
  const esp = parseFloat(e);
  if (area === null || isNaN(esp)) return null;
  return area * (esp / 100); // espessura em cm -> metros
}

export default function StepProducao({ entries, onChange }: StepProducaoProps) {
  const updateEntry = (id: string, field: string, value: string) => {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => onChange([...entries, emptyEntry()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-foreground">Produção</h2>
        <Button onClick={addEntry} size="sm" className="h-12 px-4 text-base gap-2">
          <Plus className="w-5 h-5" /> Adicionar
        </Button>
      </div>

      {entries.map((entry, idx) => {
        const area = calcArea(entry.comprimento_m, entry.largura_m);
        const volume = calcVolume(entry.comprimento_m, entry.largura_m, entry.espessura_cm);

        return (
          <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary">Trecho {idx + 1}</span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo Serviço</Label>
                <Input
                  placeholder="CBUQ, TSD..."
                  value={entry.tipo_servico}
                  onChange={e => updateEntry(entry.id, "tipo_servico", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rodovia</Label>
                <Input
                  placeholder="BR-101..."
                  value={entry.rodovia}
                  onChange={e => updateEntry(entry.id, "rodovia", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sentido</Label>
                <Input
                  placeholder="Norte/Sul"
                  value={entry.sentido}
                  onChange={e => updateEntry(entry.id, "sentido", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Faixa</Label>
                <Input
                  placeholder="1, 2, Acost."
                  value={entry.faixa}
                  onChange={e => updateEntry(entry.id, "faixa", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">KM Inicial</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.km_inicial}
                  onChange={e => updateEntry(entry.id, "km_inicial", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">KM Final</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.km_final}
                  onChange={e => updateEntry(entry.id, "km_final", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">Dimensões</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Comp. (m)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.comprimento_m}
                    onChange={e => updateEntry(entry.id, "comprimento_m", e.target.value)}
                    className="h-12 text-base bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Larg. (m)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.largura_m}
                    onChange={e => updateEntry(entry.id, "largura_m", e.target.value)}
                    className="h-12 text-base bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Esp. (cm)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.espessura_cm}
                    onChange={e => updateEntry(entry.id, "espessura_cm", e.target.value)}
                    className="h-12 text-base bg-secondary border-border"
                  />
                </div>
              </div>
            </div>

            {/* Auto-calculated results */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="text-2xl font-bold text-primary">
                  {area !== null ? area.toFixed(2) : "—"}
                </p>
                <p className="text-xs text-primary/70">m²</p>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="text-2xl font-bold text-primary">
                  {volume !== null ? volume.toFixed(3) : "—"}
                </p>
                <p className="text-xs text-primary/70">m³</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

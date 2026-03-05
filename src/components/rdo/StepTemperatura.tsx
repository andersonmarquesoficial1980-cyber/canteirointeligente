import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface TemperaturaEntry {
  id: string;
  placa_veiculo: string;
  hora_descarga: string;
  faixa_aplicada: string;
  km_inicial: string;
  km_final: string;
  temp_usina_c: string;
  temp_chegada_c: string;
  temp_rolagem_c: string;
}

const emptyTemp = (): TemperaturaEntry => ({
  id: crypto.randomUUID(),
  placa_veiculo: "",
  hora_descarga: "",
  faixa_aplicada: "",
  km_inicial: "",
  km_final: "",
  temp_usina_c: "",
  temp_chegada_c: "",
  temp_rolagem_c: "",
});

interface StepTemperaturaProps {
  entries: TemperaturaEntry[];
  onChange: (entries: TemperaturaEntry[]) => void;
}

export default function StepTemperatura({ entries, onChange }: StepTemperaturaProps) {
  const updateEntry = (id: string, field: string, value: string) => {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => onChange([...entries, emptyTemp()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-foreground">Temperatura de Espalhamento</h2>
        <Button onClick={addEntry} size="sm" className="h-12 px-4 text-base gap-2">
          <Plus className="w-5 h-5" /> Adicionar
        </Button>
      </div>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Carga {idx + 1}</span>
            {entries.length > 1 && (
              <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Placa</Label>
              <Input
                placeholder="ABC-1234"
                value={entry.placa_veiculo}
                onChange={e => updateEntry(entry.id, "placa_veiculo", e.target.value)}
                className="h-12 text-base bg-secondary border-border uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hora Descarga</Label>
              <Input
                type="time"
                value={entry.hora_descarga}
                onChange={e => updateEntry(entry.id, "hora_descarga", e.target.value)}
                className="h-12 text-base bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Faixa Aplicada</Label>
              <Input
                placeholder="1, 2..."
                value={entry.faixa_aplicada}
                onChange={e => updateEntry(entry.id, "faixa_aplicada", e.target.value)}
                className="h-12 text-base bg-secondary border-border"
              />
            </div>
            <div className="space-y-1 col-span-1" />
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
            <p className="text-xs text-muted-foreground mb-2 font-semibold">🌡️ Temperaturas (°C)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Usina</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.temp_usina_c}
                  onChange={e => updateEntry(entry.id, "temp_usina_c", e.target.value)}
                  className="h-12 text-base bg-secondary border-border text-center"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Chegada</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.temp_chegada_c}
                  onChange={e => updateEntry(entry.id, "temp_chegada_c", e.target.value)}
                  className="h-12 text-base bg-secondary border-border text-center"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rolagem</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.temp_rolagem_c}
                  onChange={e => updateEntry(entry.id, "temp_rolagem_c", e.target.value)}
                  className="h-12 text-base bg-secondary border-border text-center"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

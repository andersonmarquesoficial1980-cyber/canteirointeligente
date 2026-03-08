import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface BasculanteEntry {
  id: string;
  placa: string;
  material: string;
  viagens: string;
  empresa_dona: string;
}

interface Props {
  entries: BasculanteEntry[];
  onChange: (entries: BasculanteEntry[]) => void;
}

const MATERIAIS_BASCULANTE = ["Fresado", "RAP", "BGS", "Rachão", "Limpeza"];

const emptyBasc = (): BasculanteEntry => ({
  id: crypto.randomUUID(), placa: "", material: "", viagens: "", empresa_dona: "",
});

export default function SectionBasculante({ entries, onChange }: Props) {
  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🚛 Caminhão Basculante</h2>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Basculante {idx + 1}</span>
            {entries.length > 1 && (
              <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Placa</Label>
              <Input value={entry.placa} onChange={e => update(entry.id, "placa", e.target.value)} className="h-11 bg-secondary border-border uppercase" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Material</Label>
              <Select value={entry.material} onValueChange={v => update(entry.id, "material", v)}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MATERIAIS_BASCULANTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Viagens</Label>
              <Input type="number" inputMode="numeric" value={entry.viagens} onChange={e => update(entry.id, "viagens", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Input value={entry.empresa_dona} onChange={e => update(entry.id, "empresa_dona", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
        </div>
      ))}

      <Button size="sm" onClick={() => onChange([...entries, emptyBasc()])} className="w-full h-12 gap-2 text-base">
        <Plus className="w-5 h-5" /> Adicionar Viagem
      </Button>
    </div>
  );
}

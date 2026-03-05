import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface NotaFiscalMassaEntry {
  id: string;
  placa: string;
  usina: string;
  nf: string;
  tonelagem: string;
  tipo_material: string;
}

interface Props {
  entries: NotaFiscalMassaEntry[];
  onChange: (entries: NotaFiscalMassaEntry[]) => void;
}

const MATERIAIS = ["Binder", "SMA", "FX-1", "FX-2", "FX-3", "CBUQ", "PMF", "Outro"];

const emptyNF = (): NotaFiscalMassaEntry => ({
  id: crypto.randomUUID(), placa: "", usina: "", nf: "", tonelagem: "", tipo_material: "",
});

export default function SectionCauq({ entries, onChange }: Props) {
  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const totalTon = entries.reduce((sum, e) => sum + (parseFloat(e.tonelagem) || 0), 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">🛣️ Notas Fiscais de Massa</h2>
        <Button size="sm" onClick={() => onChange([...entries, emptyNF()])} className="h-10 gap-1">
          <Plus className="w-4 h-4" /> NF
        </Button>
      </div>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">NF {idx + 1}</span>
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
              <Label className="text-xs text-muted-foreground">Usina</Label>
              <Input value={entry.usina} onChange={e => update(entry.id, "usina", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº NF</Label>
              <Input value={entry.nf} onChange={e => update(entry.id, "nf", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tonelagem</Label>
              <Input type="number" inputMode="decimal" value={entry.tonelagem} onChange={e => update(entry.id, "tonelagem", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo Material</Label>
            <Select value={entry.tipo_material} onValueChange={v => update(entry.id, "tipo_material", v)}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}

      {totalTon > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-primary">{totalTon.toFixed(2)} t</p>
        </div>
      )}
    </div>
  );
}

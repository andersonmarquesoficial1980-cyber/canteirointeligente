import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface ManchaAreiaEntry {
  id: string;
  faixa: string;
  d1_mm: string;
  d2_mm: string;
  d3_mm: string;
  volume_cm3: string;
}

const emptyMancha = (): ManchaAreiaEntry => ({
  id: crypto.randomUUID(),
  faixa: "",
  d1_mm: "",
  d2_mm: "",
  d3_mm: "",
  volume_cm3: "25",
});

interface StepManchaAreiaProps {
  entries: ManchaAreiaEntry[];
  onChange: (entries: ManchaAreiaEntry[]) => void;
}

function calcDm(d1: string, d2: string, d3: string) {
  const vals = [d1, d2, d3].map(Number).filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function calcHs(dm: number | null, vol: string) {
  if (dm === null || dm === 0) return null;
  const v = parseFloat(vol);
  if (isNaN(v)) return null;
  // Hs = 4V / (π × Dm²) in mm
  return (4 * v * 1000) / (Math.PI * dm * dm);
}

export default function StepManchaAreia({ entries, onChange }: StepManchaAreiaProps) {
  const updateEntry = (id: string, field: string, value: string) => {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => onChange([...entries, emptyMancha()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-foreground">Mancha de Areia</h2>
        <Button onClick={addEntry} size="sm" className="h-12 px-4 text-base gap-2">
          <Plus className="w-5 h-5" /> Adicionar
        </Button>
      </div>

      {entries.map((entry, idx) => {
        const dm = calcDm(entry.d1_mm, entry.d2_mm, entry.d3_mm);
        const hs = calcHs(dm, entry.volume_cm3);

        return (
          <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary">Amostra {idx + 1}</span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Faixa</Label>
                <Input
                  placeholder="1, 2..."
                  value={entry.faixa}
                  onChange={e => updateEntry(entry.id, "faixa", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Volume (cm³)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.volume_cm3}
                  onChange={e => updateEntry(entry.id, "volume_cm3", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">D1 (mm)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.d1_mm}
                  onChange={e => updateEntry(entry.id, "d1_mm", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">D2 (mm)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.d2_mm}
                  onChange={e => updateEntry(entry.id, "d2_mm", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">D3 (mm)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.d3_mm}
                  onChange={e => updateEntry(entry.id, "d3_mm", e.target.value)}
                  className="h-12 text-base bg-secondary border-border"
                />
              </div>
            </div>

            {/* Auto-calculated */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Dm</p>
                <p className="text-xl font-bold text-primary">
                  {dm !== null ? dm.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-primary/70">mm</p>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Hs</p>
                <p className="text-xl font-bold text-primary">
                  {hs !== null ? hs.toFixed(2) : "—"}
                </p>
                <p className="text-xs text-primary/70">mm</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

interface Props {
  teveEnsaio: boolean;
  onToggleEnsaio: (v: boolean) => void;
  entries: ManchaAreiaEntry[];
  onChange: (entries: ManchaAreiaEntry[]) => void;
}

const emptyMancha = (): ManchaAreiaEntry => ({
  id: crypto.randomUUID(), faixa: "", d1_mm: "", d2_mm: "", d3_mm: "", volume_cm3: "25",
});

function calcDm(d1: string, d2: string, d3: string) {
  const vals = [d1, d2, d3].map(Number).filter(v => !isNaN(v) && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function calcHs(dm: number | null, vol: string) {
  if (!dm) return null;
  const v = parseFloat(vol);
  if (isNaN(v)) return null;
  return (4 * v * 1000) / (Math.PI * dm * dm);
}

export default function SectionManchaAreia({ teveEnsaio, onToggleEnsaio, entries, onChange }: Props) {
  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🔬 Mancha de Areia</h2>

      <div className="flex gap-3">
        {[true, false].map(val => (
          <button
            key={String(val)}
            type="button"
            onClick={() => onToggleEnsaio(val)}
            className={`flex-1 h-12 rounded-lg font-semibold border-2 transition-all ${
              teveEnsaio === val
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border"
            }`}
          >
            {val ? "✅ Sim, teve ensaio" : "❌ Não"}
          </button>
        ))}
      </div>

      {teveEnsaio && (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onChange([...entries, emptyMancha()])} className="h-10 gap-1">
              <Plus className="w-4 h-4" /> Amostra
            </Button>
          </div>

          {entries.map((entry, idx) => {
            const dm = calcDm(entry.d1_mm, entry.d2_mm, entry.d3_mm);
            const hs = calcHs(dm, entry.volume_cm3);
            return (
              <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">Amostra {idx + 1}</span>
                  {entries.length > 1 && (
                    <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Faixa</Label>
                    <Input value={entry.faixa} onChange={e => update(entry.id, "faixa", e.target.value)} className="h-11 bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vol (cm³)</Label>
                    <Input type="number" value={entry.volume_cm3} onChange={e => update(entry.id, "volume_cm3", e.target.value)} className="h-11 bg-secondary border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">D1 (mm)</Label>
                    <Input type="number" inputMode="decimal" value={entry.d1_mm} onChange={e => update(entry.id, "d1_mm", e.target.value)} className="h-11 bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">D2 (mm)</Label>
                    <Input type="number" inputMode="decimal" value={entry.d2_mm} onChange={e => update(entry.id, "d2_mm", e.target.value)} className="h-11 bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">D3 (mm)</Label>
                    <Input type="number" inputMode="decimal" value={entry.d3_mm} onChange={e => update(entry.id, "d3_mm", e.target.value)} className="h-11 bg-secondary border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Dm</p>
                    <p className="text-lg font-bold text-primary">{dm ? dm.toFixed(1) : "—"} mm</p>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Hs</p>
                    <p className="text-lg font-bold text-primary">{hs ? hs.toFixed(2) : "—"} mm</p>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

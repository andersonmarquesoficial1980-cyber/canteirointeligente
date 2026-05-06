import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export interface ProductionArea {
  id: string;
  comp: string;
  larg: string;
  esp: string;
}

interface Props {
  areas: ProductionArea[];
  onChange: (areas: ProductionArea[]) => void;
}

export function createEmptyArea(): ProductionArea {
  return { id: crypto.randomUUID(), comp: "", larg: "", esp: "" };
}

// Normaliza para cálculo: substitui vírgula por ponto
function toNum(val: string): number {
  if (!val) return 0;
  // Apenas garante que vírgula vira ponto para o JavaScript conseguir calcular
  return Number(val.replace(",", "."));
}

function calcM2(a: ProductionArea): number | null {
  const c = toNum(a.comp);
  const l = toNum(a.larg);
  if (!c || !l) return null;
  return c * l;
}

function calcM3(a: ProductionArea): number | null {
  const m2 = calcM2(a);
  const e = toNum(a.esp);
  if (m2 === null || !e) return null;
  return m2 * (e / 100); // esp em cm → m
}

export default function ProductionAreasSection({ areas, onChange }: Props) {
  const update = (idx: number, field: keyof ProductionArea, value: string) => {
    onChange(areas.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const remove = (idx: number) => onChange(areas.filter((_, i) => i !== idx));
  const add = () => onChange([...areas, createEmptyArea()]);

  const totalM2 = areas.reduce((s, a) => s + (calcM2(a) ?? 0), 0);
  const totalM3 = areas.reduce((s, a) => s + (calcM3(a) ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
          Produção — Áreas Fresadas
        </h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Σ M² = <strong className="text-foreground">{totalM2.toFixed(1)}</strong></span>
          <span>Σ M³ = <strong className="text-foreground">{totalM3.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_70px_70px_40px] gap-1 text-[10px] font-bold text-accent uppercase px-1">
        <span>COMP (m)</span>
        <span>LARG (m)</span>
        <span>ESP (cm)</span>
        <span>M²</span>
        <span>M³</span>
        <span></span>
      </div>

      {areas.map((area, idx) => {
        const m2 = calcM2(area);
        const m3 = calcM3(area);
        return (
          <div key={area.id} className="grid grid-cols-[1fr_1fr_1fr_70px_70px_40px] gap-1 items-center">
            <Input
              type="text"
              inputMode="decimal"
              value={area.comp}
              onChange={(e) => update(idx, "comp", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <Input
              type="text"
              inputMode="decimal"
              value={area.larg}
              onChange={(e) => update(idx, "larg", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <Input
              type="text"
              inputMode="decimal"
              value={area.esp}
              onChange={(e) => update(idx, "esp", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <span className="text-xs text-foreground text-center font-medium">
              {m2 !== null ? m2.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-foreground text-center font-medium">
              {m3 !== null ? m3.toFixed(2) : "—"}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={add}>
        <Plus className="w-3.5 h-3.5" /> Adicionar área
      </Button>
    </div>
  );
}

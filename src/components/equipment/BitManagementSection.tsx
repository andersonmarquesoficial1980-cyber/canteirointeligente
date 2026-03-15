import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wrench } from "lucide-react";

export interface BitEntry {
  id: string;
  brand: string;
  quantity: string;
  status: string;
  horimeter: string;
}

interface Props {
  bits: BitEntry[];
  onChange: (bits: BitEntry[]) => void;
  meterInitial?: string;
}

const BIT_STATUS = ["Novo", "Meia Vida"];
const BIT_BRANDS = ["Wirtgen", "Kennametal", "Betek", "Bomag"];

export function createEmptyBit(): BitEntry {
  return { id: crypto.randomUUID(), brand: "", quantity: "1", status: "Novo", horimeter: "" };
}

function getHorimeterError(value: string, meterInitial?: string): string | null {
  if (!value || !meterInitial) return null;
  const v = Number(value);
  const mi = Number(meterInitial);
  if (isNaN(v) || isNaN(mi)) return null;
  if (v < mi || v > mi + 12) {
    return "Horímetro incoerente para o turno atual";
  }
  return null;
}

export default function BitManagementSection({ bits, onChange, meterInitial }: Props) {
  const update = (idx: number, field: keyof BitEntry, value: string) => {
    onChange(bits.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const remove = (idx: number) => onChange(bits.filter((_, i) => i !== idx));
  const add = () => onChange([...bits, createEmptyBit()]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-primary" />
        Gestão de Bits
      </h3>

      {bits.map((bit, idx) => {
        const hError = getHorimeterError(bit.horimeter, meterInitial);
        return (
          <div key={bit.id} className="space-y-2 border border-border rounded-md p-2 bg-secondary/20">
            {/* Linha 1: Quantidade (40%) + Marca (60%) */}
            <div className="grid grid-cols-[2fr_3fr_36px] gap-2 items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-accent uppercase">Quantidade</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={bit.quantity}
                  onChange={(e) => update(idx, "quantity", e.target.value)}
                  className="bg-secondary border-border h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-accent uppercase">Marca</span>
                <Select value={bit.brand} onValueChange={(v) => update(idx, "brand", v)}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BIT_BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Linha 2: Status + Horímetro */}
            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-accent uppercase">Status do Bits</span>
                <Select value={bit.status} onValueChange={(v) => update(idx, "status", v)}>
                  <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BIT_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-accent uppercase">Horímetro na Aplicação</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={bit.horimeter}
                  onChange={(e) => update(idx, "horimeter", e.target.value)}
                  placeholder="0"
                  className={`bg-secondary h-9 text-xs ${hError ? "border-destructive ring-1 ring-destructive" : "border-border"}`}
                />
                {hError && (
                  <p className="text-[10px] text-destructive font-medium">{hError}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={add}>
        <Plus className="w-3.5 h-3.5" /> Inserir troca de bits
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

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
}

const BIT_STATUS = ["Novo", "Usado", "Troca"];

export function createEmptyBit(): BitEntry {
  return { id: crypto.randomUUID(), brand: "", quantity: "1", status: "Novo", horimeter: "" };
}

export default function BitManagementSection({ bits, onChange }: Props) {
  const update = (idx: number, field: keyof BitEntry, value: string) => {
    onChange(bits.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const remove = (idx: number) => onChange(bits.filter((_, i) => i !== idx));
  const add = () => onChange([...bits, createEmptyBit()]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
        Gestão de Bits
      </h3>

      {bits.map((bit, idx) => (
        <div key={bit.id} className="grid grid-cols-[1fr_60px_90px_80px_40px] gap-2 items-end">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-accent uppercase">Marca/Tipo</span>
            <Input
              value={bit.brand}
              onChange={(e) => update(idx, "brand", e.target.value)}
              placeholder="Ex: Wirtgen HT22"
              className="bg-secondary border-border h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-accent uppercase">Qtd</span>
            <Input
              type="number"
              value={bit.quantity}
              onChange={(e) => update(idx, "quantity", e.target.value)}
              className="bg-secondary border-border h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-accent uppercase">Status</span>
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
            <span className="text-[10px] font-semibold text-accent uppercase">Horímetro</span>
            <Input
              value={bit.horimeter}
              onChange={(e) => update(idx, "horimeter", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={add}>
        <Plus className="w-3.5 h-3.5" /> Inserir troca de bits
      </Button>
    </div>
  );
}

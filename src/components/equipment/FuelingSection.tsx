import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel } from "lucide-react";

export interface FuelingData {
  fuelType: string;
  liters: string;
  fuelMeter: string;
}

interface Props {
  data: FuelingData;
  onChange: (data: FuelingData) => void;
}

export function createEmptyFueling(): FuelingData {
  return { fuelType: "", liters: "", fuelMeter: "" };
}

export default function FuelingSection({ data, onChange }: Props) {
  const update = (field: keyof FuelingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2">
        <Fuel className="w-4 h-4 text-primary" />
        Abastecimento
      </h3>

      <div className="flex gap-3">
        <div className="space-y-1.5 flex-1">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Tipo</span>
          <Select value={data.fuelType} onValueChange={(v) => update("fuelType", v)}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Diesel S10">Diesel S10</SelectItem>
              <SelectItem value="Diesel S500">Diesel S500</SelectItem>
              <SelectItem value="Gasolina Comum">Gasolina Comum</SelectItem>
              <SelectItem value="Gasolina Aditivada">Gasolina Aditivada</SelectItem>
              <SelectItem value="Etanol">Etanol</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Litros</span>
          <Input
            type="number"
            inputMode="decimal"
            value={data.liters}
            onChange={(e) => update("liters", e.target.value)}
            placeholder="0"
            className="bg-secondary border-border"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Horímetro</span>
          <Input
            type="number"
            inputMode="decimal"
            value={data.fuelMeter}
            onChange={(e) => update("fuelMeter", e.target.value)}
            placeholder="0"
            className="bg-secondary border-border"
          />
        </div>
      </div>
    </div>
  );
}

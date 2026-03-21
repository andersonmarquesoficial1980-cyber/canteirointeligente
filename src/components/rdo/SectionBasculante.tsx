import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Truck } from "lucide-react";
import { useMateriais } from "@/hooks/useFilteredData";

export interface BasculanteEntry {
  id: string;
  placa: string;
  material: string;
  viagens: string;
  empresa_dona: string; // kept for compat but not shown
}

interface Props {
  entries: BasculanteEntry[];
  onChange: (entries: BasculanteEntry[]) => void;
  tipoRdo: string;
}

const emptyBasc = (): BasculanteEntry => ({
  id: crypto.randomUUID(), placa: "", material: "", viagens: "", empresa_dona: "",
});

export default function SectionBasculante({ entries, onChange, tipoRdo }: Props) {
  const { data: materiaisData } = useMateriais(tipoRdo, "Transporte");
  const materiais = materiaisData?.map(m => m.nome) ?? [];

  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Truck className="w-5 h-5 text-sky-500" />
        Caminhão Basculante
      </h2>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display font-bold text-primary">Basculante {idx + 1}</span>
            {entries.length > 1 && (
              <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Placa</span>
              <Input value={entry.placa} onChange={e => update(entry.id, "placa", e.target.value)} className="h-11 bg-white border-border rounded-xl uppercase" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Material</span>
              <Select value={entry.material} onValueChange={v => update(entry.id, "material", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {materiais.length > 0
                    ? materiais.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum material de transporte cadastrado</p>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Viagens</span>
              <Input type="number" inputMode="numeric" value={entry.viagens} onChange={e => update(entry.id, "viagens", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Empresa</span>
              <Input value={entry.empresa_dona} onChange={e => update(entry.id, "empresa_dona", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
          </div>
        </div>
      ))}

      <Button size="sm" onClick={() => onChange([...entries, emptyBasc()])} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Viagem
      </Button>
    </div>
  );
}

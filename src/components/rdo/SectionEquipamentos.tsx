import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMaquinasFrota } from "@/hooks/useMaquinasFrota";
import { Plus, Trash2 } from "lucide-react";

export interface EquipamentoEntry {
  id: string;
  frota: string;
  patrimonio: string;
  empresa_dona: string;
  is_menor: boolean;
}

interface Props {
  entries: EquipamentoEntry[];
  onChange: (entries: EquipamentoEntry[]) => void;
}

const emptyEquip = (): EquipamentoEntry => ({
  id: crypto.randomUUID(), frota: "", patrimonio: "", empresa_dona: "", is_menor: false,
});

export default function SectionEquipamentos({ entries, onChange }: Props) {
  const { data: maquinas } = useMaquinasFrota();

  const update = (id: string, field: string, value: any) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">🚜 Equipamentos</h2>
        <Button size="sm" onClick={() => onChange([...entries, emptyEquip()])} className="h-10 gap-1">
          <Plus className="w-4 h-4" /> Equip.
        </Button>
      </div>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Equip. {idx + 1}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => update(entry.id, "is_menor", !entry.is_menor)}
                className={`text-[10px] px-2 py-1 rounded-full border ${entry.is_menor ? "bg-accent text-accent-foreground border-accent" : "bg-secondary text-muted-foreground border-border"}`}
              >
                {entry.is_menor ? "Menor ✓" : "Menor?"}
              </button>
              {entries.length > 1 && (
                <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {entry.is_menor ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Patrimônio</Label>
                <Input value={entry.patrimonio} onChange={e => update(entry.id, "patrimonio", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Empresa Dona</Label>
                <Input value={entry.empresa_dona} onChange={e => update(entry.id, "empresa_dona", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frota</Label>
              {maquinas && maquinas.length > 0 ? (
                <Select value={entry.frota} onValueChange={v => update(entry.id, "frota", v)}>
                  <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {maquinas.map((m: any) => (
                      <SelectItem key={m.id} value={m.frota}>{m.frota} - {m.tipo ? `${m.tipo} ` : ""}({m.nome})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={entry.frota} onChange={e => update(entry.id, "frota", e.target.value)} className="h-11 bg-secondary border-border" placeholder="FR-01" />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

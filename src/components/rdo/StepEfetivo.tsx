import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface EfetivoEntry {
  id: string;
  funcao: string;
  quantidade: string;
  entrada: string;
  saida: string;
}

const emptyEfetivo = (): EfetivoEntry => ({
  id: crypto.randomUUID(),
  funcao: "",
  quantidade: "1",
  entrada: "",
  saida: "",
});

interface StepEfetivoProps {
  entries: EfetivoEntry[];
  onChange: (entries: EfetivoEntry[]) => void;
}

const FUNCOES_COMUNS = [
  "Operador", "Motorista", "Encarregado", "Auxiliar", "Laboratorista",
  "Mecânico", "Topógrafo", "Sinaleiro"
];

export default function StepEfetivo({ entries, onChange }: StepEfetivoProps) {
  const updateEntry = (id: string, field: string, value: string) => {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addEntry = () => onChange([...entries, emptyEfetivo()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-foreground">Efetivo</h2>
        <Button onClick={addEntry} size="sm" className="h-12 px-4 text-base gap-2">
          <Plus className="w-5 h-5" /> Adicionar
        </Button>
      </div>

      {/* Quick-add buttons */}
      <div className="flex flex-wrap gap-2">
        {FUNCOES_COMUNS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => {
              const existing = entries.find(e => e.funcao === f);
              if (!existing) {
                onChange([...entries, { ...emptyEfetivo(), funcao: f }]);
              }
            }}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium border border-border hover:border-primary/50 transition-colors"
          >
            + {f}
          </button>
        ))}
      </div>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Pessoa {idx + 1}</span>
            {entries.length > 1 && (
              <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Função</Label>
            <Input
              placeholder="Operador, Motorista..."
              value={entry.funcao}
              onChange={e => updateEntry(entry.id, "funcao", e.target.value)}
              className="h-12 text-base bg-secondary border-border"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Qtd</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={entry.quantidade}
                onChange={e => updateEntry(entry.id, "quantidade", e.target.value)}
                className="h-12 text-base bg-secondary border-border text-center"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Entrada</Label>
              <Input
                type="time"
                value={entry.entrada}
                onChange={e => updateEntry(entry.id, "entrada", e.target.value)}
                className="h-12 text-base bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Saída</Label>
              <Input
                type="time"
                value={entry.saida}
                onChange={e => updateEntry(entry.id, "saida", e.target.value)}
                className="h-12 text-base bg-secondary border-border"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

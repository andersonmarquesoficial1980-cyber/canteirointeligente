import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FUNCIONARIOS } from "@/data/funcionarios";

export interface EfetivoEntry {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  entrada: string;
  saida: string;
}

const emptyEfetivo = (): EfetivoEntry => ({
  id: crypto.randomUUID(),
  matricula: "",
  nome: "",
  funcao: "",
  entrada: "",
  saida: "",
});

interface StepEfetivoProps {
  entries: EfetivoEntry[];
  onChange: (entries: EfetivoEntry[]) => void;
  globalEntrada: string;
  globalSaida: string;
  onChangeGlobalEntrada: (v: string) => void;
  onChangeGlobalSaida: (v: string) => void;
}

export default function StepEfetivo({ entries, onChange, globalEntrada, globalSaida, onChangeGlobalEntrada, onChangeGlobalSaida }: StepEfetivoProps) {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const selectFuncionario = (entryId: string, matricula: string) => {
    const func = FUNCIONARIOS.find(f => f.matricula === matricula);
    if (func) {
      onChange(entries.map(e => e.id === entryId ? { ...e, matricula: func.matricula, nome: func.nome, funcao: func.funcao } : e));
    }
    setOpenPopoverId(null);
  };

  const addEntry = () => onChange([...entries, emptyEfetivo()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const resumo = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      if (e.funcao) {
        map[e.funcao] = (map[e.funcao] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filledEntries = entries.filter(e => e.nome);

  return (
    <div className="space-y-5 p-4">
      <h2 className="text-xl font-display font-bold text-foreground">👷 Efetivo</h2>

      {/* Global hours */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-primary">⏰ Horário Geral</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Entrada</Label>
            <Input
              type="time"
              value={globalEntrada}
              onChange={e => onChangeGlobalEntrada(e.target.value)}
              className="h-12 text-base bg-secondary border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Saída</Label>
            <Input
              type="time"
              value={globalSaida}
              onChange={e => onChangeGlobalSaida(e.target.value)}
              className="h-12 text-base bg-secondary border-border"
            />
          </div>
        </div>
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
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Popover open={openPopoverId === entry.id} onOpenChange={(open) => setOpenPopoverId(open ? entry.id : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full h-12 justify-between text-left font-normal bg-secondary border-border text-base">
                  {entry.nome ? (
                    <span className="truncate">{entry.nome}</span>
                  ) : (
                    <span className="text-muted-foreground">Buscar funcionário...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite o nome..." />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                    <CommandGroup>
                      {FUNCIONARIOS.map(f => (
                        <CommandItem
                          key={f.matricula}
                          value={`${f.nome} ${f.matricula}`}
                          onSelect={() => selectFuncionario(entry.id, f.matricula)}
                          className="text-sm"
                        >
                          <span className="font-medium">{f.nome}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{f.matricula}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Função</Label>
            <Input
              value={entry.funcao}
              readOnly
              className="h-12 text-base bg-muted border-border text-muted-foreground"
              placeholder="Preenchido automaticamente"
            />
          </div>
        </div>
      ))}

      <Button onClick={addEntry} className="w-full h-12 gap-2 text-base">
        <Plus className="w-5 h-5" /> Adicionar Pessoa
      </Button>

      {/* Summary with global hours */}
      {filledEntries.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-primary">📊 Resumo do Efetivo</h3>
          
          <div className="space-y-1">
            {filledEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-primary/10 last:border-0">
                <span className="text-foreground truncate flex-1">{e.nome}</span>
                <span className="text-xs text-muted-foreground mx-2">{e.funcao}</span>
                <span className="text-xs font-mono text-primary whitespace-nowrap">
                  {globalEntrada || "--:--"} → {globalSaida || "--:--"}
                </span>
              </div>
            ))}
          </div>

          {resumo.length > 0 && (
            <div className="border-t border-primary/20 pt-2 space-y-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {resumo.map(([funcao, qty]) => (
                  <div key={funcao} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{funcao}</span>
                    <span className="font-bold text-primary ml-2">{String(qty).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-primary/20 pt-2 mt-1 flex justify-between text-sm font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{filledEntries.length}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

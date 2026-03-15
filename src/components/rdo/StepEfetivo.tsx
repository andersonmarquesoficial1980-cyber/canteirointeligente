import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, HardHat, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFuncionarios } from "@/hooks/useFuncionarios";

export interface EfetivoEntry {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  entrada: string;
  saida: string;
}

const emptyEfetivo = (): EfetivoEntry => ({
  id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "",
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
  const { funcionarios, funcoes, loading } = useFuncionarios();
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const prevCountRef = useRef(entries.length);

  useEffect(() => {
    if (entries.length > prevCountRef.current && addBtnRef.current) {
      addBtnRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    prevCountRef.current = entries.length;
  }, [entries.length]);

  const handleFuncaoChange = (entryId: string, funcao: string) => {
    onChange(entries.map(e => e.id === entryId ? { ...e, funcao, nome: "", matricula: "" } : e));
  };

  const selectFuncionario = (entryId: string, matricula: string) => {
    const func = funcionarios.find(f => f.matricula === matricula);
    if (func) {
      onChange(entries.map(e => e.id === entryId ? { ...e, matricula: func.matricula, nome: func.nome } : e));
    }
    setOpenPopoverId(null);
  };

  const addEntry = () => onChange([...entries, emptyEfetivo()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const resumo = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { if (e.funcao) map[e.funcao] = (map[e.funcao] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filledEntries = entries.filter(e => e.nome);
  const getFilteredFuncionarios = (funcao: string) =>
    funcionarios.filter(f => f.funcao === funcao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Carregando funcionários...</div>;
  }

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <HardHat className="w-5 h-5 text-amber-500" />
        Efetivo
      </h2>

      <div className="rdo-card space-y-3">
        <h3 className="text-sm font-display font-bold flex items-center gap-1.5" style={{ color: "hsl(220 70% 30%)" }}>
          <Clock className="w-4 h-4 text-primary" /> Horário Geral
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Entrada</span>
            <Input type="time" value={globalEntrada} onChange={e => onChangeGlobalEntrada(e.target.value)} className="h-12 text-base bg-white border-border rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Saída</span>
            <Input type="time" value={globalSaida} onChange={e => onChangeGlobalSaida(e.target.value)} className="h-12 text-base bg-white border-border rounded-xl" />
          </div>
        </div>
      </div>

      {entries.map((entry, idx) => {
        const funcionariosFiltrados = entry.funcao ? getFilteredFuncionarios(entry.funcao) : [];
        return (
          <div key={entry.id} className="rdo-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold text-primary">Pessoa {idx + 1}</span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Função</span>
              <Select value={entry.funcao} onValueChange={v => handleFuncaoChange(entry.id, v)}>
                <SelectTrigger className="w-full h-12 bg-white border-border text-base rounded-xl">
                  <SelectValue placeholder="Selecione a função..." />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {funcoes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Nome</span>
              {entry.funcao ? (
                <Popover open={openPopoverId === entry.id} onOpenChange={(open) => setOpenPopoverId(open ? entry.id : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full h-12 justify-between text-left font-normal bg-white border-border text-base rounded-xl">
                      {entry.nome ? <span className="truncate">{entry.nome}</span> : <span className="text-muted-foreground">Buscar funcionário...</span>}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome..." />
                      <CommandList className="max-h-[250px]">
                        <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                        <CommandGroup>
                          {funcionariosFiltrados.map(f => (
                            <CommandItem key={f.matricula} value={`${f.nome} ${f.matricula}`} onSelect={() => selectFuncionario(entry.id, f.matricula)} className="text-sm">
                              <span className="font-medium">{f.nome}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{f.matricula}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="h-12 flex items-center px-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
                  Selecione a função primeiro
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Button ref={addBtnRef} onClick={addEntry} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Pessoa
      </Button>

      {filledEntries.length > 0 && (
        <div className="rdo-card border-l-4 border-l-primary space-y-3">
          <h3 className="text-sm font-display font-bold text-primary flex items-center gap-1.5">📊 Resumo do Efetivo</h3>
          <div className="space-y-1">
            {filledEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="text-foreground truncate flex-1">{e.nome}</span>
                <span className="text-xs text-muted-foreground mx-2">{e.funcao}</span>
              </div>
            ))}
          </div>
          {resumo.length > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {resumo.map(([funcao, qty]) => (
                  <div key={funcao} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{funcao}</span>
                    <span className="font-bold text-primary ml-2">{String(qty).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 mt-1 flex justify-between text-sm font-bold">
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

import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, Users, Clock, CheckCheck } from "lucide-react";
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
  status?: "P" | "F" | "A" | "";
  horasExtras?: string;
}

const emptyEfetivo = (): EfetivoEntry => ({
  id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "", status: "", horasExtras: "",
});

interface StepEfetivoProps {
  entries: EfetivoEntry[];
  onChange: (entries: EfetivoEntry[]) => void;
  globalEntrada: string;
  globalSaida: string;
  onChangeGlobalEntrada: (v: string) => void;
  onChangeGlobalSaida: (v: string) => void;
}

const STATUS_CONFIG = {
  P: { label: "P", color: "bg-[hsl(145_72%_40%)]", activeRing: "ring-[hsl(145_72%_40%)]", text: "text-white", desc: "Presente" },
  F: { label: "F", color: "bg-[hsl(0_80%_50%)]", activeRing: "ring-[hsl(0_80%_50%)]", text: "text-white", desc: "Falta" },
  A: { label: "A", color: "bg-[hsl(35_95%_55%)]", activeRing: "ring-[hsl(35_95%_55%)]", text: "text-white", desc: "Atestado" },
} as const;

export default function StepEfetivo({ entries, onChange, globalEntrada, globalSaida, onChangeGlobalEntrada, onChangeGlobalSaida }: StepEfetivoProps) {
  const { funcionarios, funcoes, loading } = useFuncionarios();
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const toggleStatus = (entryId: string, status: "P" | "F" | "A") => {
    onChange(entries.map(e => e.id === entryId ? { ...e, status: e.status === status ? "" : status } : e));
  };

  const setHorasExtras = (entryId: string, value: string) => {
    onChange(entries.map(e => e.id === entryId ? { ...e, horasExtras: value } : e));
  };

  const selectAllPresente = () => {
    onChange(entries.map(e => e.nome ? { ...e, status: "P" } : e));
  };

  const addEntry = () => onChange([...entries, emptyEfetivo()]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const filledEntries = entries.filter(e => e.nome);
  const getFilteredFuncionarios = (funcao: string) =>
    funcionarios.filter(f => f.funcao === funcao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Search filter
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.nome.toLowerCase().includes(q) || e.funcao.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  // Summary
  const resumo = useMemo(() => {
    const counts = { P: 0, F: 0, A: 0 };
    filledEntries.forEach(e => {
      if (e.status === "P") counts.P++;
      else if (e.status === "F") counts.F++;
      else if (e.status === "A") counts.A++;
    });
    const totalHE = filledEntries.reduce((sum, e) => sum + (parseFloat(e.horasExtras || "0") || 0), 0);
    return { ...counts, total: filledEntries.length, totalHE };
  }, [filledEntries]);

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Carregando funcionários...</div>;
  }

  return (
    <div className="space-y-4 px-4">
      {/* Section Title */}
      <h2 className="font-display font-extrabold text-[2rem] leading-tight tracking-tight flex items-center gap-3" style={{ color: "hsl(220 70% 20%)" }}>
        <Users className="w-8 h-8" style={{ color: "hsl(215 100% 50%)" }} />
        EQUIPE EM CAMPO
      </h2>

      {/* Global Hours */}
      <div className="rdo-card space-y-3">
        <h3 className="text-sm font-display font-bold flex items-center gap-1.5" style={{ color: "hsl(220 70% 20%)" }}>
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

      {/* Search + Select All */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou função..."
            className="h-12 pl-10 text-base bg-white border-border rounded-xl"
          />
        </div>
        <Button
          type="button"
          onClick={selectAllPresente}
          className="h-12 px-4 gap-2 rounded-xl font-display font-bold text-sm bg-primary hover:bg-primary/90"
        >
          <CheckCheck className="w-5 h-5" /> Todos P
        </Button>
      </div>

      {/* Employee Cards */}
      {filteredEntries.map((entry, idx) => {
        const funcionariosFiltrados = entry.funcao ? getFilteredFuncionarios(entry.funcao) : [];
        const realIdx = entries.findIndex(e => e.id === entry.id);

        return (
          <div
            key={entry.id}
            className="rdo-card space-y-3 transition-all duration-200"
            style={{
              borderLeft: entry.status === "P"
                ? "4px solid hsl(145 72% 40%)"
                : entry.status === "F"
                ? "4px solid hsl(0 80% 50%)"
                : entry.status === "A"
                ? "4px solid hsl(35 95% 55%)"
                : "4px solid transparent",
            }}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-extrabold" style={{ color: "hsl(220 70% 20%)" }}>
                Pessoa {realIdx + 1}
              </span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Função Select */}
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

            {/* Nome Combobox */}
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

            {/* Status Toggles + Horas Extras - only show when employee is selected */}
            {entry.nome && (
              <div className="flex items-center gap-3 pt-1">
                {/* Toggle Buttons */}
                {(["P", "F", "A"] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const isActive = entry.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(entry.id, s)}
                      className={`
                        w-12 h-12 rounded-xl font-display font-extrabold text-lg transition-all duration-200
                        ${isActive
                          ? `${cfg.color} ${cfg.text} ring-2 ${cfg.activeRing} ring-offset-2 shadow-lg scale-105`
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }
                      `}
                      title={cfg.desc}
                    >
                      {cfg.label}
                    </button>
                  );
                })}

                {/* Horas Extras */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap">HE</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={entry.horasExtras || ""}
                    onChange={e => setHorasExtras(entry.id, e.target.value)}
                    placeholder="0"
                    className="w-16 h-10 text-center text-sm bg-white border-border rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Button */}
      <Button ref={addBtnRef} onClick={addEntry} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Pessoa
      </Button>

      {/* Summary Card */}
      {filledEntries.length > 0 && (
        <div className="rdo-card space-y-4" style={{ borderLeft: "4px solid hsl(215 100% 50%)" }}>
          <h3 className="text-sm font-display font-extrabold flex items-center gap-1.5" style={{ color: "hsl(220 70% 20%)" }}>
            📊 Resumo da Equipe
          </h3>

          {/* Status counters */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center rounded-xl py-2" style={{ background: "hsl(215 100% 50% / 0.08)" }}>
              <p className="text-xl font-display font-extrabold text-primary">{resumo.total}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total</p>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: "hsl(145 72% 40% / 0.08)" }}>
              <p className="text-xl font-display font-extrabold" style={{ color: "hsl(145 72% 40%)" }}>{resumo.P}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Presentes</p>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: "hsl(0 80% 50% / 0.08)" }}>
              <p className="text-xl font-display font-extrabold" style={{ color: "hsl(0 80% 50%)" }}>{resumo.F}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Faltas</p>
            </div>
            <div className="text-center rounded-xl py-2" style={{ background: "hsl(35 95% 55% / 0.08)" }}>
              <p className="text-xl font-display font-extrabold" style={{ color: "hsl(35 95% 55%)" }}>{resumo.A}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Atestado</p>
            </div>
          </div>

          {/* Employees list */}
          <div className="space-y-1">
            {filledEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="text-foreground truncate flex-1">{e.nome}</span>
                <span className="text-xs text-muted-foreground mx-2">{e.funcao}</span>
                {e.status && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{
                      background: e.status === "P" ? "hsl(145 72% 40%)" : e.status === "F" ? "hsl(0 80% 50%)" : "hsl(35 95% 55%)",
                    }}
                  >
                    {STATUS_CONFIG[e.status].desc}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Total HE */}
          {resumo.totalHE > 0 && (
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
              <span style={{ color: "hsl(220 70% 20%)" }}>Total Horas Extras</span>
              <span className="text-primary">{resumo.totalHE.toFixed(1)}h</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

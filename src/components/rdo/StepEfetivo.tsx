import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Users, Clock, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

  const handleToggleFuncionario = (entryId: string, func: { matricula: string; nome: string }, checked: boolean) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (checked) {
      // Add: keep the current entry if empty, otherwise add new
      const currentNames = entry.nome ? entry.nome.split("|||") : [];
      const currentMatrs = entry.matricula ? entry.matricula.split("|||") : [];
      if (!currentNames.includes(func.nome)) {
        currentNames.push(func.nome);
        currentMatrs.push(func.matricula);
      }
      onChange(entries.map(e => e.id === entryId ? {
        ...e,
        nome: currentNames.join("|||"),
        matricula: currentMatrs.join("|||"),
      } : e));
    } else {
      // Remove
      const currentNames = entry.nome ? entry.nome.split("|||") : [];
      const currentMatrs = entry.matricula ? entry.matricula.split("|||") : [];
      const idx = currentNames.indexOf(func.nome);
      if (idx > -1) {
        currentNames.splice(idx, 1);
        currentMatrs.splice(idx, 1);
      }
      onChange(entries.map(e => e.id === entryId ? {
        ...e,
        nome: currentNames.join("|||"),
        matricula: currentMatrs.join("|||"),
      } : e));
    }
  };

  const selectAllInFuncao = (entryId: string, funcao: string) => {
    const funcsForRole = funcionarios.filter(f => f.funcao === funcao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    onChange(entries.map(e => e.id === entryId ? {
      ...e,
      nome: funcsForRole.map(f => f.nome).join("|||"),
      matricula: funcsForRole.map(f => f.matricula).join("|||"),
    } : e));
  };

  const addEntry = () => onChange([...entries, {
    id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "", status: "", horasExtras: "",
  }]);
  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const getFilteredFuncionarios = (funcao: string) =>
    funcionarios.filter(f => f.funcao === funcao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Summary
  const totalPessoas = useMemo(() => {
    return entries.reduce((sum, e) => {
      if (!e.nome) return sum;
      return sum + e.nome.split("|||").filter(Boolean).length;
    }, 0);
  }, [entries]);

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
            <input type="time" value={globalEntrada} onChange={e => onChangeGlobalEntrada(e.target.value)} className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Saída</span>
            <input type="time" value={globalSaida} onChange={e => onChangeGlobalSaida(e.target.value)} className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
      </div>

      {/* Employee Cards */}
      {entries.map((entry, idx) => {
        const funcionariosFiltrados = entry.funcao ? getFilteredFuncionarios(entry.funcao) : [];
        const selectedNames = entry.nome ? entry.nome.split("|||").filter(Boolean) : [];
        const selectedCount = selectedNames.length;

        return (
          <div key={entry.id} className="rdo-card space-y-3 transition-all duration-200">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-extrabold" style={{ color: "hsl(220 70% 20%)" }}>
                Função {idx + 1}
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

            {/* Multi-select Names */}
            {entry.funcao ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="rdo-label">
                    Nomes {selectedCount > 0 && <span className="text-primary font-bold">({selectedCount})</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectAllInFuncao(entry.id, entry.funcao)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Selecionar Todos
                  </button>
                </div>
                <div className="bg-white border border-border rounded-xl max-h-[200px] overflow-y-auto divide-y divide-border/50">
                  {funcionariosFiltrados.length > 0 ? funcionariosFiltrados.map(f => {
                    const isChecked = selectedNames.includes(f.nome);
                    return (
                      <label key={f.matricula} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => handleToggleFuncionario(entry.id, f, !!checked)}
                        />
                        <span className="text-sm font-medium flex-1">{f.nome}</span>
                        <span className="text-[10px] text-muted-foreground">{f.matricula}</span>
                      </label>
                    );
                  }) : (
                    <p className="text-xs text-muted-foreground p-3 text-center">Nenhum funcionário nesta função</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-12 flex items-center px-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
                Selecione a função primeiro
              </div>
            )}
          </div>
        );
      })}

      {/* Add Button */}
      <Button ref={addBtnRef} onClick={addEntry} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Função
      </Button>

      {/* Summary */}
      {totalPessoas > 0 && (
        <div className="rdo-card" style={{ borderLeft: "4px solid hsl(215 100% 50%)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-extrabold flex items-center gap-1.5" style={{ color: "hsl(220 70% 20%)" }}>
              📊 Resumo da Equipe
            </h3>
            <span className="text-xl font-display font-extrabold text-primary">{totalPessoas} pessoas</span>
          </div>
        </div>
      )}
    </div>
  );
}

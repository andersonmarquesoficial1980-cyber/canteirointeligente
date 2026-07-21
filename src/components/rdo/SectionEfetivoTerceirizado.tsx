import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, HardHat, Check } from "lucide-react";
import type { EmpresaTerceira, FuncionarioTerceiro } from "@/hooks/useEmpresasTerceiras";

export interface TerceirizadoEntry {
  id: string;
  empresa_id: string;
  funcionario_ids: string[];
}

interface Props {
  entries: TerceirizadoEntry[];
  onChange: (entries: TerceirizadoEntry[]) => void;
  empresas: EmpresaTerceira[];
  funcionarios: FuncionarioTerceiro[];
  loadingData: boolean;
}

export default function SectionEfetivoTerceirizado({
  entries,
  onChange,
  empresas,
  funcionarios,
  loadingData,
}: Props) {
  const addEntry = () => {
    onChange([...entries, { id: crypto.randomUUID(), empresa_id: "", funcionario_ids: [] }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) {
      onChange([{ id: crypto.randomUUID(), empresa_id: "", funcionario_ids: [] }]);
      return;
    }
    onChange(entries.filter((e) => e.id !== id));
  };

  const updateEmpresa = (id: string, empresa_id: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, empresa_id, funcionario_ids: [] } : e)));
  };

  const toggleFuncionario = (entryId: string, funcId: string, checked: boolean) => {
    onChange(
      entries.map((e) => {
        if (e.id !== entryId) return e;
        const ids = checked
          ? [...e.funcionario_ids, funcId]
          : e.funcionario_ids.filter((i) => i !== funcId);
        return { ...e, funcionario_ids: ids };
      })
    );
  };

  const selectAll = (entryId: string, empresa_id: string) => {
    const ids = funcionarios.filter((f) => f.empresa_id === empresa_id).map((f) => f.id);
    onChange(entries.map((e) => (e.id === entryId ? { ...e, funcionario_ids: ids } : e)));
  };

  const totalPessoas = entries.reduce((sum, e) => sum + e.funcionario_ids.length, 0);

  if (loadingData) {
    return (
      <div className="px-4">
        <div className="rdo-card">
          <p className="text-sm text-muted-foreground text-center py-4">Carregando empresas terceirizadas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      <div className="rdo-card space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="rdo-section-title">
            <HardHat className="w-5 h-5 text-amber-600" />
            Efetivo Terceirizado
          </h2>
          {totalPessoas > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {totalPessoas} pessoa{totalPessoas !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {empresas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhuma empresa terceirizada cadastrada. Acesse o Painel de Controle para cadastrar.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const funcsEmpresa = funcionarios
                .filter((f) => f.empresa_id === entry.empresa_id)
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl border border-border bg-amber-50/30 space-y-2"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeEntry(entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Empresa */}
                  <div className="space-y-1.5">
                    <span className="rdo-label">Empresa</span>
                    <Select
                      value={entry.empresa_id}
                      onValueChange={(v) => updateEmpresa(entry.id, v)}
                    >
                      <SelectTrigger className="h-11 bg-white border-border rounded-xl text-base">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas
                          .filter((emp) => String(emp?.id || "").trim() !== "")
                          .map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Funcionários */}
                  {entry.empresa_id && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="rdo-label">
                          Funcionários{" "}
                          {entry.funcionario_ids.length > 0 && (
                            <span className="text-amber-700 font-bold">
                              ({entry.funcionario_ids.length})
                            </span>
                          )}
                        </span>
                        {funcsEmpresa.length > 0 && (
                          <button
                            type="button"
                            onClick={() => selectAll(entry.id, entry.empresa_id)}
                            className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Selecionar Todos
                          </button>
                        )}
                      </div>
                      <div className="bg-white border border-border rounded-xl max-h-[200px] overflow-y-auto divide-y divide-border/50">
                        {funcsEmpresa.length > 0 ? (
                          funcsEmpresa.map((f) => (
                            <label
                              key={f.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <Checkbox
                                checked={entry.funcionario_ids.includes(f.id)}
                                onCheckedChange={(checked) =>
                                  toggleFuncionario(entry.id, f.id, !!checked)
                                }
                              />
                              <span className="text-sm font-medium flex-1">{f.nome}</span>
                            </label>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground p-3 text-center">
                            Nenhum funcionário cadastrado nesta empresa
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {empresas.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={addEntry}
            className="w-full h-11 gap-2 rounded-xl border-dashed border-2 border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold"
          >
            <UserPlus className="w-4 h-4" /> Adicionar Empresa Terceirizada
          </Button>
        )}
      </div>
    </div>
  );
}

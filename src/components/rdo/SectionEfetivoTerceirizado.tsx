import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, HardHat } from "lucide-react";

export interface TerceirizadoEntry {
  id: string;
  nome: string;
  empresa: string;
  empresa_outra: string;
}

const EMPRESAS_TERCEIRIZADAS = ["Geoservice", "Sondosolo", "Engemix", "Outros"];

interface Props {
  entries: TerceirizadoEntry[];
  onChange: (entries: TerceirizadoEntry[]) => void;
}

export default function SectionEfetivoTerceirizado({ entries, onChange }: Props) {
  const addEntry = () => {
    onChange([
      ...entries,
      { id: crypto.randomUUID(), nome: "", empresa: "", empresa_outra: "" },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof TerceirizadoEntry, value: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const filledCount = entries.filter((e) => e.nome.trim()).length;

  return (
    <div className="px-4 space-y-4">
      <div className="rdo-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="rdo-section-title">
            <HardHat className="w-5 h-5 text-amber-600" />
            Efetivo Terceirizado
          </h2>
          {filledCount > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {filledCount} pessoa{filledCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="p-3 rounded-xl border border-border bg-amber-50/30 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  #{idx + 1}
                </span>
                {entries.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="rdo-label">Nome do Funcionário</span>
                <Input
                  value={entry.nome}
                  onChange={(e) => updateEntry(entry.id, "nome", e.target.value)}
                  placeholder="Ex: José da Silva"
                  className="h-11 bg-white border-border rounded-xl text-base"
                />
              </div>

              <div className="space-y-1.5">
                <span className="rdo-label">Empresa</span>
                <Select
                  value={entry.empresa}
                  onValueChange={(v) => updateEntry(entry.id, "empresa", v)}
                >
                  <SelectTrigger className="h-11 bg-white border-border rounded-xl text-base">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESAS_TERCEIRIZADAS.map((emp) => (
                      <SelectItem key={emp} value={emp}>
                        {emp === "Outros" ? "Outros (Especificar)" : emp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {entry.empresa === "Outros" && (
                <div className="space-y-1.5">
                  <span className="rdo-label">Especifique a empresa</span>
                  <Input
                    value={entry.empresa_outra}
                    onChange={(e) =>
                      updateEntry(entry.id, "empresa_outra", e.target.value)
                    }
                    placeholder="Nome da empresa"
                    className="h-11 bg-white border-border rounded-xl text-base"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addEntry}
          className="w-full h-11 gap-2 rounded-xl border-dashed border-2 border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold"
        >
          <UserPlus className="w-4 h-4" /> Adicionar Terceirizado
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useMaquinasFrotaFiltered } from "@/hooks/useFilteredData";

// Categorias disponíveis no Painel de Controle
const CATEGORIAS = [
  "FRESAGEM",
  "PAVIMENTAÇÃO",
  "VEÍCULOS",
  "LINHA AMARELA",
  "PEQUENO PORTE",
  "USINAGEM",
];

export interface EquipamentoPatioEntry {
  id: string;
  categoria: string; // filtro de tipo
  frota: string;
  nome: string;
  tipo: string;
  status_patio: string;
  observacao: string;
}

interface Props {
  entries: EquipamentoPatioEntry[];
  onChange: (entries: EquipamentoPatioEntry[]) => void;
}

const STATUS_PATIO = ["Disposição", "Manutenção", "Inoperante"];

function emptyEntry(): EquipamentoPatioEntry {
  return { id: crypto.randomUUID(), categoria: "", frota: "", nome: "", tipo: "", status_patio: "Disposição", observacao: "" };
}

export default function SectionEquipamentosPatio({ entries, onChange }: Props) {
  const { data: maquinas = [] } = useMaquinasFrotaFiltered("PATIO");

  const update = (id: string, field: keyof EquipamentoPatioEntry, value: string) => {
    onChange(entries.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (field === "categoria") {
        // Ao trocar categoria, limpar frota selecionada
        updated.frota = "";
        updated.nome = "";
        updated.tipo = "";
      }
      if (field === "frota") {
        const maq = (maquinas as any[]).find((m: any) => m.frota === value);
        if (maq) { updated.nome = maq.nome || ""; updated.tipo = maq.tipo || ""; }
      }
      return updated;
    }));
  };

  const add = () => onChange([...entries, emptyEntry()]);
  const remove = (id: string) => onChange(entries.filter(e => e.id !== id));

  return (
    <div className="px-4 space-y-4">
      <div className="rdo-card space-y-1">
        <h2 className="font-display font-extrabold text-xl text-foreground flex items-center gap-2">
          🏠 Equipamentos no Pátio
        </h2>
        <p className="text-xs text-muted-foreground">Liste todos os equipamentos presentes na base hoje</p>
      </div>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Equip. {idx + 1}</span>
            {entries.length > 1 && (
              <button type="button" onClick={() => remove(entry.id)} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Linha 1: Tipo de Equipamento (filtro) */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Tipo de Equipamento</span>
            <Select value={entry.categoria} onValueChange={v => update(entry.id, "categoria", v)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: Frota (filtrada pelo tipo) + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Frota</span>
              <Select
                value={entry.frota}
                onValueChange={v => update(entry.id, "frota", v)}
                disabled={!entry.categoria}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={entry.categoria ? "Selecione..." : "Escolha o tipo primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {(maquinas as any[])
                    .filter((m: any) => m.frota && (!entry.categoria || m.categoria === entry.categoria))
                    .map((m: any) => (
                      <SelectItem key={m.id} value={m.frota}>{m.frota} — {m.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Status</span>
              <Select value={entry.status_patio} onValueChange={v => update(entry.id, "status_patio", v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_PATIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(entry.status_patio === "Manutenção" || entry.status_patio === "Inoperante") && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                {entry.status_patio === "Manutenção" ? "Motivo / Previsão de Liberação" : "Observação"}
              </span>
              <Input
                value={entry.observacao}
                onChange={e => update(entry.id, "observacao", e.target.value)}
                placeholder={entry.status_patio === "Manutenção" ? "Ex: Troca de pneu | Previsão: 22/05" : "Detalhe..."}
                className="bg-secondary border-border"
              />
            </div>
          )}

          {entry.frota && (
            <p className="text-xs text-muted-foreground">{entry.tipo || ""} {entry.nome ? `— ${entry.nome}` : ""}</p>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full gap-2">
        <Plus className="w-4 h-4" /> Adicionar Equipamento
      </Button>
    </div>
  );
}

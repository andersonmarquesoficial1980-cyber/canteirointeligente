import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Fuel, Droplets, Truck, FileDown } from "lucide-react";

export interface ComboioRefuelEntry {
  id: string;
  fleetFueled: string;
  equipmentMeter: string;
  litersFueled: string;
  ogsDestination: string;
  isLubricated: boolean;
  isWashed: boolean;
}

export function createEmptyComboioRefuel(): ComboioRefuelEntry {
  return {
    id: crypto.randomUUID(),
    fleetFueled: "",
    equipmentMeter: "",
    litersFueled: "",
    ogsDestination: "",
    isLubricated: false,
    isWashed: false,
  };
}

interface Props {
  saldoInicial: string;
  onSaldoInicialChange: (v: string) => void;
  fornecedor: string;
  onFornecedorChange: (v: string) => void;
  entries: ComboioRefuelEntry[];
  onChange: (entries: ComboioRefuelEntry[]) => void;
  equipamentos: any[];
  ogsData: any[];
  onGeneratePdf?: () => void;
}

const COMBOIO_FORNECEDORES = ["Posto Fremix", "Shell", "Rimacris", "Petrobrás"];

export default function ComboioRefuelingSection({
  saldoInicial,
  onSaldoInicialChange,
  fornecedor,
  onFornecedorChange,
  entries,
  onChange,
  equipamentos,
  ogsData,
  onGeneratePdf,
}: Props) {
  const uniqueOgs = useMemo(() => {
    const seen = new Set<string>();
    return ogsData.filter((o: any) => {
      if (!o.ogs_number || seen.has(o.ogs_number)) return false;
      seen.add(o.ogs_number);
      return true;
    });
  }, [ogsData]);

  const totalAbastecido = useMemo(
    () => entries.reduce((sum, e) => sum + (Number(e.litersFueled) || 0), 0),
    [entries]
  );

  const saldoAtual = useMemo(() => {
    const ini = Number(saldoInicial) || 0;
    return ini - totalAbastecido;
  }, [saldoInicial, totalAbastecido]);

  const updateEntry = (idx: number, field: keyof ComboioRefuelEntry, value: any) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const removeEntry = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      {/* ── CARD 01: CONTROLE DE CARGA ── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <h3 className="text-sm font-display font-extrabold text-[hsl(var(--primary))] uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2">
          <Fuel className="w-4 h-4" />
          CONTROLE DE CARGA
        </h3>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-display font-bold text-primary uppercase tracking-wide">
              Saldo Inicial (Litros)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={saldoInicial}
              onChange={(e) => onSaldoInicialChange(e.target.value)}
              placeholder="0"
              className="bg-secondary border-border font-semibold text-lg"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-display font-bold text-primary uppercase tracking-wide">
              Fornecedor da Carga
            </label>
            <Select value={fornecedor} onValueChange={onFornecedorChange}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {COMBOIO_FORNECEDORES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── CARD 02: ABASTECIMENTO DE FROTA ── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <h3 className="text-sm font-display font-extrabold text-[hsl(var(--primary))] uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2">
          <Truck className="w-4 h-4" />
          ABASTECIMENTO DE FROTA
        </h3>

        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="border border-border rounded-xl p-3 space-y-3 bg-secondary/30 relative"
          >
            {/* Badge do número */}
            <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow">
              Máquina {idx + 1}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <span className="text-[10px] font-display font-bold text-primary uppercase">Frota</span>
                <Select
                  value={entry.fleetFueled}
                  onValueChange={(v) => updateEntry(idx, "fleetFueled", v)}
                >
                  <SelectTrigger className="bg-background border-border h-9 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentos.map((eq: any) => (
                      <SelectItem key={eq.id} value={eq.frota}>
                        {eq.frota} — {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-display font-bold text-primary uppercase">Horímetro / Odômetro</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.equipmentMeter}
                  onChange={(e) => updateEntry(idx, "equipmentMeter", e.target.value)}
                  placeholder="0"
                  className="bg-background border-border text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-display font-bold text-primary uppercase">Litros Abastecidos</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={entry.litersFueled}
                  onChange={(e) => updateEntry(idx, "litersFueled", e.target.value)}
                  placeholder="0"
                  className="bg-background border-border text-xs h-9 font-semibold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-display font-bold text-primary uppercase">OGS</span>
                <Select
                  value={entry.ogsDestination}
                  onValueChange={(v) => updateEntry(idx, "ogsDestination", v)}
                >
                  <SelectTrigger className="bg-background border-border h-9 text-xs">
                    <SelectValue placeholder="OGS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueOgs.map((o: any) => (
                      <SelectItem key={o.id} value={o.ogs_number}>
                        {o.ogs_number} — {o.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Serviços Extras */}
            <div className="flex items-center gap-6 pt-1 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={entry.isLubricated}
                  onCheckedChange={(c) => updateEntry(idx, "isLubricated", !!c)}
                />
                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-amber-500" /> Lubrificação
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={entry.isWashed}
                  onCheckedChange={(c) => updateEntry(idx, "isWashed", !!c)}
                />
                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                  💦 Lavagem
                </span>
              </div>
              {entries.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-muted-foreground hover:text-destructive text-xs"
                  onClick={() => removeEntry(idx)}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Remover
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          size="sm"
          className="w-full gap-2 text-sm font-extrabold py-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
          onClick={() => onChange([...entries, createEmptyComboioRefuel()])}
        >
          <Plus className="w-4 h-4" /> Adicionar Máquina
        </Button>
      </div>

      {/* ── RODAPÉ: SALDO ATUAL DO TANQUE ── */}
      <div className="bg-card border-2 border-primary/30 rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-display font-extrabold text-[hsl(var(--primary))] uppercase tracking-wide pb-2 flex items-center gap-2">
          <Fuel className="w-4 h-4" />
          RESUMO DO TANQUE
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Inicial</p>
            <p className="text-xl font-extrabold text-primary">
              {Number(saldoInicial) ? Number(saldoInicial).toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">litros</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Abastecido</p>
            <p className="text-xl font-extrabold text-destructive">
              {totalAbastecido ? totalAbastecido.toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">litros</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${saldoAtual < 0 ? "bg-destructive/10 border-destructive/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Atual</p>
            <p className={`text-xl font-extrabold ${saldoAtual < 0 ? "text-destructive" : "text-emerald-600"}`}>
              {saldoInicial ? saldoAtual.toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">litros</p>
          </div>
        </div>
      </div>
    </div>
  );
}

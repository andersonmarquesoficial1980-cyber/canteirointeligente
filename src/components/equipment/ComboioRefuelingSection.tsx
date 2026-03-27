import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Fuel, Droplets, Truck, FileDown, Clock } from "lucide-react";

export interface ComboioRefuelEntry {
  id: string;
  hora: string;
  tipoEquipamento: string;
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
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
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
  fornecedoresDb?: any[];
}

const COMBOIO_FORNECEDORES_FALLBACK = ["Posto Fremix", "Shell", "Rimacris", "Petrobrás"];

/* Prefixes that indicate vehicles (KM) vs machines (H) */
const VEHICLE_PREFIXES = ["CM", "CC", "CP", "CE", "VT", "MCO"];

function isVehicleFleet(frota: string): boolean {
  const upper = frota.toUpperCase();
  return VEHICLE_PREFIXES.some((p) => upper.startsWith(p));
}

function buildOgsLocationOptions(ogsData: any[]): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  ogsData.forEach((o: any) => {
    if (!o.ogs_number) return;
    const addresses = o.location_address
      ? o.location_address.split(";").map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (addresses.length === 0) {
      const key = o.ogs_number;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({
          value: o.ogs_number,
          label: `${o.ogs_number} — ${o.client_name || ""}`,
        });
      }
    } else {
      addresses.forEach((addr: string) => {
        const key = `${o.ogs_number}|${addr}`;
        if (!seen.has(key)) {
          seen.add(key);
          options.push({
            value: `${o.ogs_number} | ${addr}`,
            label: `${o.ogs_number} — ${o.client_name || ""} — ${addr}`,
          });
        }
      });
    }
  });

  return options;
}

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
  fornecedoresDb = [],
}: Props) {
  const fornecedoresList = fornecedoresDb.length > 0
    ? fornecedoresDb.map((f: any) => f.nome)
    : COMBOIO_FORNECEDORES_FALLBACK;
  const ogsOptions = useMemo(() => buildOgsLocationOptions(ogsData), [ogsData]);

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
                {fornecedoresList.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── CARD 02: ABASTECIMENTO DE FROTA ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase tracking-wide flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          ABASTECIMENTO DE FROTA
        </h3>

        {entries.map((entry, idx) => {
          const meterLabel = entry.fleetFueled && isVehicleFleet(entry.fleetFueled) ? "KM" : "H";

          return (
            <div
              key={entry.id}
              className="bg-card rounded-2xl shadow-md border border-border/60 p-4 space-y-3 relative"
            >
              {/* Badge */}
              <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow">
                #{idx + 1}
              </div>

              {/* ── LINHA 1: Hora + Frota ── */}
              <div className="grid grid-cols-[100px_1fr] gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Hora
                  </span>
                  <Input
                    type="time"
                    value={entry.hora}
                    onChange={(e) => updateEntry(idx, "hora", e.target.value)}
                    className="bg-secondary border-border h-9 text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase">Frota</span>
                  <Select
                    value={entry.fleetFueled}
                    onValueChange={(v) => updateEntry(idx, "fleetFueled", v)}
                  >
                    <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                      <SelectValue placeholder="Selecione a frota..." />
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
              </div>

              {/* ── LINHA 2: Litros + Medição ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase">
                    Litros Abastecidos
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.litersFueled}
                    onChange={(e) => updateEntry(idx, "litersFueled", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border text-sm h-9 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase">
                    Medição ({meterLabel})
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.equipmentMeter}
                    onChange={(e) => updateEntry(idx, "equipmentMeter", e.target.value)}
                    placeholder={meterLabel === "KM" ? "Odômetro" : "Horímetro"}
                    className="bg-secondary border-border text-sm h-9"
                  />
                </div>
              </div>

              {/* ── LINHA 3: OGS full-width ── */}
              <div className="space-y-1">
                <span className="text-[10px] font-display font-extrabold text-[hsl(var(--navy,220,60%,30%))] uppercase">
                  OGS — Local de Trabalho
                </span>
                <Select
                  value={entry.ogsDestination}
                  onValueChange={(v) => updateEntry(idx, "ogsDestination", v)}
                >
                  <SelectTrigger className="bg-secondary border-border h-10 text-xs w-full">
                    <SelectValue placeholder="Selecione a OGS e local..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ogsOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Serviços Extras + Remover ── */}
              <div className="flex items-center gap-6 pt-1 border-t border-border/40">
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
          );
        })}

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

        {onGeneratePdf && (
          <Button
            type="button"
            onClick={onGeneratePdf}
            className="w-full gap-2 text-sm font-extrabold py-5 rounded-xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground shadow-lg mt-4"
          >
            <FileDown className="w-5 h-5" /> Gerar Relatório de Comboio (PDF)
          </Button>
        )}
      </div>
    </div>
  );
}

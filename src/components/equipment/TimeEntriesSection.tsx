import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Clock, Warehouse } from "lucide-react";

const BASE_PATIO_VALUE = "BASE / PÁTIO CENTRAL";
const RETURN_REASONS = ["Manutenção / Oficina", "Término de Obra / Desmobilização"] as const;

const ACTIVITIES = [
  "Check e Preparação",
  "Trabalhando",
  "Refeições",
  "À Disposição",
  "Manutenção",
  "Transporte",
] as const;

export interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string;
  activity: string;
  isParada: boolean;
  maintenanceDetails?: string;
  origin?: string;
  destination?: string;
  transportObs?: string;
  transportOgs?: string;
  transportPassengers?: string;
  transportEquip1?: string;
  transportEquip1Custom?: string;
  transportEquip2?: string;
  transportEquip2Custom?: string;
  transportEquip3?: string;
  transportEquip3Custom?: string;
  transportInternalDetails?: string;
  returnReason?: string;
  returnDetails?: string;
}

const PRODUCTION_EQUIPMENT_TYPES = ["fresadora", "bobcat", "retroescavadeira", "rolo", "vibroacabadora", "usina"];

interface Props {
  entries: TimeEntry[];
  onChange: (entries: TimeEntry[]) => void;
  turno: "diurno" | "noturno";
  showTransportOgs?: boolean;
  showTransportPassengers?: boolean;
  ogsData?: any[];
  isCarreta?: boolean;
  allFleets?: any[];
  equipmentType?: string;
}

function buildOgsLocationOptions(ogsData: any[]): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  ogsData.forEach((o: any) => {
    if (!o.ogs_number) return;
    const num = (o.ogs_number || "").toUpperCase();
    if (num.includes("BASE") || num.includes("OSASCO")) return;
    const addresses = o.location_address
      ? o.location_address.split(";").map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (addresses.length === 0) {
      const key = o.ogs_number;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ value: key, label: `${o.ogs_number} — ${o.client_name || ""}` });
      }
    } else {
      addresses.forEach((addr: string) => {
        const key = `${o.ogs_number} | ${addr}`;
        if (!seen.has(key)) {
          seen.add(key);
          options.push({ value: key, label: `${o.ogs_number} — ${addr}` });
        }
      });
    }
  });

  return options;
}

export function createDefaultTimeEntry(turno: "diurno" | "noturno"): TimeEntry {
  return {
    id: crypto.randomUUID(),
    startTime: turno === "diurno" ? "07:00" : "20:30",
    endTime: "",
    activity: "",
    isParada: false,
    maintenanceDetails: "",
    origin: "",
    destination: "",
    transportObs: "",
    transportOgs: "",
    transportPassengers: "",
    transportEquip1: "",
    transportEquip1Custom: "",
    transportEquip2: "",
    transportEquip2Custom: "",
    transportEquip3: "",
    transportEquip3Custom: "",
    transportInternalDetails: "",
    returnReason: "",
    returnDetails: "",
  };
}

export default function TimeEntriesSection({ entries, onChange, turno, showTransportOgs, showTransportPassengers, ogsData = [], isCarreta = false, allFleets = [], equipmentType = "" }: Props) {
  const showReturnReason = PRODUCTION_EQUIPMENT_TYPES.some(t => equipmentType.toLowerCase().includes(t));
  const fleetOptions = useMemo(() => {
    const opts = allFleets
      .map((f: any) => f.fleet_number || f.frota)
      .filter(Boolean)
      .sort();
    return [...opts, "Outro"];
  }, [allFleets]);
  const ogsLocationOptions = useMemo(() => buildOgsLocationOptions(ogsData), [ogsData]);
  const addEntry = () => {
    const lastEnd = entries.length > 0 ? entries[entries.length - 1].endTime : "";
    onChange([
      ...entries,
      {
        ...createDefaultTimeEntry(turno),
        id: crypto.randomUUID(),
        startTime: lastEnd || (turno === "diurno" ? "07:00" : "20:30"),
      },
    ]);
  };

  const updateEntry = (index: number, field: keyof TimeEntry, value: any, extraFields?: Partial<TimeEntry>) => {
    const updated = entries.map((e, i) => {
      if (i !== index) return e;
      const newEntry = { ...e, [field]: value, ...extraFields };
      if (field === "activity") {
        const paradaActivities = ["Refeições", "À Disposição", "Manutenção"];
        newEntry.isParada = paradaActivities.includes(value);
        if (value !== "Manutenção") newEntry.maintenanceDetails = "";
        if (value !== "Transporte") {
          newEntry.origin = "";
          newEntry.destination = "";
          newEntry.transportObs = "";
          newEntry.transportOgs = "";
          newEntry.transportPassengers = "";
          newEntry.transportEquip1 = "";
          newEntry.transportEquip1Custom = "";
          newEntry.transportEquip2 = "";
          newEntry.transportEquip2Custom = "";
          newEntry.transportEquip3 = "";
          newEntry.transportEquip3Custom = "";
          newEntry.returnReason = "";
          newEntry.returnDetails = "";
        }
      }
      return newEntry;
    });
    if (field === "endTime" && value && index < updated.length - 1) {
      updated[index + 1] = { ...updated[index + 1], startTime: value };
    }
    onChange(updated);
  };

  const removeEntry = (index: number) => onChange(entries.filter((_, i) => i !== index));

  const totalHoras = entries.reduce((acc, e) => {
    if (!e.startTime || !e.endTime) return acc;
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return acc + diff / 60;
  }, 0);

  const totalParada = entries
    .filter((e) => e.isParada)
    .reduce((acc, e) => {
      if (!e.startTime || !e.endTime) return acc;
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      return acc + diff / 60;
    }, 0);

  // Unique OGS for transport selector
  const uniqueOgs = ogsData.reduce((acc: any[], o: any) => {
    if (o.ogs_number && !acc.find((x: any) => x.ogs_number === o.ogs_number)) acc.push(o);
    return acc;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Apontamento de Horas
        </h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{totalHoras.toFixed(1)}h</strong></span>
          {totalParada > 0 && (
            <span>Parada: <strong className="text-destructive">{totalParada.toFixed(1)}h</strong></span>
          )}
        </div>
      </div>

      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          className={`border rounded-lg p-3 space-y-2 ${entry.isParada ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
        >
          {/* Linha 1: Início + Fim + Remover */}
          <div className="grid grid-cols-[1fr_1fr_36px] gap-2 items-end">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-[hsl(220,60%,30%)] uppercase">Início</span>
              <Input
                type="time"
                value={entry.startTime}
                onChange={(e) => updateEntry(idx, "startTime", e.target.value)}
                className="bg-secondary border-border text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-[hsl(220,60%,30%)] uppercase">Fim</span>
              <Input
                type="time"
                value={entry.endTime}
                onChange={(e) => updateEntry(idx, "endTime", e.target.value)}
                className="bg-secondary border-border text-xs h-9"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeEntry(idx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* Linha 2: Atividade full-width */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-[hsl(220,60%,30%)] uppercase">Atividade</span>
            <Select value={entry.activity} onValueChange={(v) => updateEntry(idx, "activity", v)}>
              <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Maintenance details field */}
          {entry.activity === "Manutenção" && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-accent uppercase">Relato da Manutenção</span>
              <Textarea
                value={entry.maintenanceDetails || ""}
                onChange={(e) => updateEntry(idx, "maintenanceDetails", e.target.value)}
                placeholder="Descreva brevemente o serviço de manutenção..."
                className="bg-secondary border-border text-xs min-h-[60px]"
              />
            </div>
          )}

          {/* Transport fields */}
          {entry.activity === "Transporte" && (
            <div className="space-y-2 border-t border-border pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-accent uppercase">Origem</span>
                  <Select value={entry.origin || ""} onValueChange={(v) => updateEntry(idx, "origin", v)}>
                    <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value={BASE_PATIO_VALUE} className="text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Warehouse className="w-3 h-3 text-primary" />
                          {BASE_PATIO_VALUE}
                        </span>
                      </SelectItem>
                      {ogsLocationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-accent uppercase">Destino</span>
                  <Select value={entry.destination || ""} onValueChange={(v) => {
                    const extra: Partial<TimeEntry> = v !== BASE_PATIO_VALUE
                      ? { returnReason: "", returnDetails: "" }
                      : {};
                    updateEntry(idx, "destination", v, extra);
                  }}>
                    <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value={BASE_PATIO_VALUE} className="text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Warehouse className="w-3 h-3 text-primary" />
                          {BASE_PATIO_VALUE}
                        </span>
                      </SelectItem>
                      {ogsLocationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Return reason when destination is BASE */}
              {entry.destination === BASE_PATIO_VALUE && showReturnReason && (
                <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-extrabold text-foreground uppercase tracking-wide">
                      Finalidade do Retorno *
                    </span>
                  </div>
                  <Select value={entry.returnReason || ""} onValueChange={(v) => {
                    const extra: Partial<TimeEntry> = v !== "Manutenção / Oficina" ? { returnDetails: "" } : {};
                    updateEntry(idx, "returnReason", v, extra);
                  }}>
                    <SelectTrigger className="bg-background border-border h-9 text-xs">
                      <SelectValue placeholder="Selecione o motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {entry.returnReason === "Manutenção / Oficina" && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Detalhes da Manutenção</span>
                      <Textarea
                        value={entry.returnDetails || ""}
                        onChange={(e) => updateEntry(idx, "returnDetails", e.target.value)}
                        placeholder="Ex: Troca de mangueira hidráulica"
                        className="bg-background border-border text-xs min-h-[50px]"
                      />
                    </div>
                  )}
                </div>
              )}
              {showTransportOgs && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-accent uppercase">OGS de Destino</span>
                  <Select value={entry.transportOgs || ""} onValueChange={(v) => updateEntry(idx, "transportOgs", v)}>
                    <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                      <SelectValue placeholder="Selecione OGS..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueOgs.map((o: any) => (
                        <SelectItem key={o.id} value={o.ogs_number}>{o.ogs_number} — {o.client_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showTransportPassengers && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-accent uppercase">Qtd. Passageiros</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={entry.transportPassengers || ""}
                    onChange={(e) => updateEntry(idx, "transportPassengers", e.target.value)}
                    placeholder="0"
                    className="bg-secondary border-border text-xs h-9 w-24"
                  />
                </div>
              )}

              {/* Carreta: 3 equipment fields instead of Observações */}
              {isCarreta ? (
                <>
                  <div className="space-y-2">
                    {([
                      { field: "transportEquip1" as keyof TimeEntry, customField: "transportEquip1Custom" as keyof TimeEntry, label: "Equipamento 01" },
                      { field: "transportEquip2" as keyof TimeEntry, customField: "transportEquip2Custom" as keyof TimeEntry, label: "Equipamento 02" },
                      { field: "transportEquip3" as keyof TimeEntry, customField: "transportEquip3Custom" as keyof TimeEntry, label: "Equipamento 03" },
                    ]).map(({ field, customField, label }) => (
                      <div key={field} className="space-y-1">
                        <span className="text-[10px] font-semibold text-accent uppercase">{label}</span>
                        <Select value={(entry[field] as string) || ""} onValueChange={(v) => updateEntry(idx, field, v)}>
                          <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                            <SelectValue placeholder="Selecione a frota..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {fleetOptions.map((f) => (
                              <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {entry[field] === "Outro" && (
                          <Input
                            value={(entry[customField] as string) || ""}
                            onChange={(e) => updateEntry(idx, customField, e.target.value)}
                            placeholder="Descreva o item transportado..."
                            className="bg-secondary border-border text-xs h-9"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {entry.origin && entry.destination && entry.origin === entry.destination && (
                    <div className="space-y-1 mt-2">
                      <span className="text-[10px] font-extrabold text-foreground uppercase tracking-wide">
                        Detalhes do Trecho (Mudança Interna) *
                      </span>
                      <Textarea
                        value={entry.transportInternalDetails || ""}
                        onChange={(e) => updateEntry(idx, "transportInternalDetails", e.target.value)}
                        placeholder="Ex: Mudança do KM 12 para o KM 45"
                        className="bg-secondary/50 border-border text-xs min-h-[60px] rounded-lg"
                        required
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-accent uppercase">Observações do Transporte</span>
                  <Textarea
                    value={entry.transportObs || ""}
                    onChange={(e) => updateEntry(idx, "transportObs", e.target.value)}
                    placeholder="Detalhes do transporte..."
                    className="bg-secondary border-border text-xs min-h-[50px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={addEntry}>
        <Plus className="w-3.5 h-3.5" /> Adicionar atividade
      </Button>
    </div>
  );
}

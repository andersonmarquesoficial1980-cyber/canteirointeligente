import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Clock } from "lucide-react";

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
}

interface Props {
  entries: TimeEntry[];
  onChange: (entries: TimeEntry[]) => void;
  turno: "diurno" | "noturno";
}

export function createDefaultTimeEntry(turno: "diurno" | "noturno"): TimeEntry {
  return {
    id: crypto.randomUUID(),
    startTime: turno === "diurno" ? "07:00" : "20:30",
    endTime: "",
    activity: "",
    isParada: false,
    maintenanceDetails: "",
  };
}

export default function TimeEntriesSection({ entries, onChange, turno }: Props) {
  const addEntry = () => {
    const lastEnd = entries.length > 0 ? entries[entries.length - 1].endTime : "";
    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        startTime: lastEnd || (turno === "diurno" ? "07:00" : "20:30"),
        endTime: "",
        activity: "",
        isParada: false,
        maintenanceDetails: "",
      },
    ]);
  };

  const updateEntry = (index: number, field: keyof TimeEntry, value: any) => {
    const updated = entries.map((e, i) => {
      if (i !== index) return e;
      const newEntry = { ...e, [field]: value };
      // Mark parada activities
      if (field === "activity") {
        const paradaActivities = ["Refeições", "À Disposição", "Manutenção"];
        newEntry.isParada = paradaActivities.includes(value);
        if (value !== "Manutenção") newEntry.maintenanceDetails = "";
      }
      return newEntry;
    });
    // Auto-chain: if endTime changed, update next entry's startTime
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
          <div className="grid grid-cols-[75px_75px_1fr_36px] gap-2 items-end">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-accent uppercase">Início</span>
              <Input
                type="time"
                value={entry.startTime}
                onChange={(e) => updateEntry(idx, "startTime", e.target.value)}
                className="bg-secondary border-border text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-accent uppercase">Fim</span>
              <Input
                type="time"
                value={entry.endTime}
                onChange={(e) => updateEntry(idx, "endTime", e.target.value)}
                className="bg-secondary border-border text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-accent uppercase">Atividade</span>
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
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeEntry(idx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
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
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={addEntry}>
        <Plus className="w-3.5 h-3.5" /> Adicionar atividade
      </Button>
    </div>
  );
}

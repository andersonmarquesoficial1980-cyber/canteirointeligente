import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Plus, Trash2 } from "lucide-react";

export interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string;
  activity: string;
  isParada: boolean;
}

interface Props {
  entries: TimeEntry[];
  onChange: (entries: TimeEntry[]) => void;
  turno: "diurno" | "noturno";
}

function generateId() {
  return crypto.randomUUID();
}

export function createDefaultTimeEntry(turno: "diurno" | "noturno"): TimeEntry {
  return {
    id: generateId(),
    startTime: turno === "diurno" ? "07:00" : "20:30",
    endTime: "",
    activity: "",
    isParada: false,
  };
}

export default function TimeEntriesSection({ entries, onChange, turno }: Props) {
  const addEntry = () => {
    const lastEnd = entries.length > 0 ? entries[entries.length - 1].endTime : "";
    const newEntry: TimeEntry = {
      id: generateId(),
      startTime: lastEnd || (turno === "diurno" ? "07:00" : "20:30"),
      endTime: "",
      activity: "",
      isParada: false,
    };
    onChange([...entries, newEntry]);
  };

  const updateEntry = (index: number, field: keyof TimeEntry, value: any) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e));
    // Auto-chain: if endTime changed, update next entry's startTime
    if (field === "endTime" && value && index < updated.length - 1) {
      updated[index + 1] = { ...updated[index + 1], startTime: value };
    }
    onChange(updated);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const totalHoras = entries.reduce((acc, e) => {
    if (!e.startTime || !e.endTime) return acc;
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // overnight
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Apontamento de Horas
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Total: <strong className="text-foreground">{totalHoras.toFixed(1)}h</strong></span>
            {totalParada > 0 && (
              <span>Parada: <strong className="text-destructive">{totalParada.toFixed(1)}h</strong></span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className={`border rounded-lg p-3 space-y-2 ${entry.isParada ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
          >
            <div className="grid grid-cols-[80px_80px_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => updateEntry(idx, "startTime", e.target.value)}
                  className="bg-secondary border-border text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => updateEntry(idx, "endTime", e.target.value)}
                  className="bg-secondary border-border text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Atividade / Descrição</Label>
                <Input
                  value={entry.activity}
                  onChange={(e) => updateEntry(idx, "activity", e.target.value)}
                  placeholder={entry.isParada ? "Motivo da parada..." : "Descrição da atividade..."}
                  className="bg-secondary border-border text-xs h-9"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeEntry(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={entry.isParada}
                onCheckedChange={(v) => updateEntry(idx, "isParada", Boolean(v))}
                id={`parada-${entry.id}`}
              />
              <label htmlFor={`parada-${entry.id}`} className="text-xs text-muted-foreground cursor-pointer">
                Marcar como parada
              </label>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={addEntry}>
          <Plus className="w-3.5 h-3.5" /> Adicionar atividade
        </Button>
      </CardContent>
    </Card>
  );
}

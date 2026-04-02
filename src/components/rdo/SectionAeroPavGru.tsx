import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plane, Utensils } from "lucide-react";

export interface AeroPavData {
  marmitas_quantidade: string;
  marmitas_turno: string;
  observacoes_logistica: string;
}

interface SectionAeroPavGruProps {
  data: AeroPavData;
  onChange: (data: AeroPavData) => void;
  turno: string;
}

export default function SectionAeroPavGru({ data, onChange, turno }: SectionAeroPavGruProps) {
  const update = (field: keyof AeroPavData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const turnoLabel = turno === "noturno" ? "Noturno" : "Diurno";

  return (
    <div className="px-4 space-y-4">
      {/* Header AEROPAV */}
      <div className="rdo-card space-y-1" style={{ borderLeft: "4px solid hsl(215 100% 50%)" }}>
        <div className="flex items-center gap-2">
          <Plane className="w-6 h-6 text-primary" />
          <h2 className="font-display font-extrabold text-xl" style={{ color: "hsl(220 70% 20%)" }}>
            AEROPAV GRU
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">Consórcio Fremix • Dang • Paupedra — Terraplanagem & Drenagem</p>
      </div>

      {/* Controle de Logística — Marmitas */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <Utensils className="w-5 h-5 text-primary" />
          Controle de Logística
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Refeições (Marmitas) *</span>
            <Input
              type="number"
              inputMode="numeric"
              value={data.marmitas_quantidade}
              onChange={e => update("marmitas_quantidade", e.target.value)}
              placeholder="Ex: 40"
              className="h-14 text-2xl font-bold text-center bg-white border-border rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Turno</span>
            <div className="h-14 flex items-center justify-center rounded-xl bg-muted/50 border border-border text-base font-display font-bold" style={{ color: "hsl(220 70% 20%)" }}>
              {turnoLabel}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="rdo-label">Observações de Logística</span>
          <Textarea
            value={data.observacoes_logistica}
            onChange={e => update("observacoes_logistica", e.target.value)}
            placeholder="Detalhes sobre transporte, alimentação ou outros itens logísticos..."
            className="min-h-[80px] bg-white border-border rounded-xl text-base resize-y"
          />
        </div>
      </div>
    </div>
  );
}

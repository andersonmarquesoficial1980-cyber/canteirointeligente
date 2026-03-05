import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useMaquinasFrota } from "@/hooks/useMaquinasFrota";

interface StepDadosGeraisProps {
  data: any;
  onChange: (field: string, value: any) => void;
}

const CLIMA_OPTIONS = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado"];
const TURNO_OPTIONS = ["Diurno", "Noturno"];

export default function StepDadosGerais({ data, onChange }: StepDadosGeraisProps) {
  const { data: obras, isLoading: loadingObras } = useOgsReference();
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinasFrota();

  const selectedObra = obras?.find(o => o.numero_ogs === data.obra_nome);

  return (
    <div className="space-y-5 p-4">
      <h2 className="text-xl font-display font-bold text-foreground">Dados Gerais</h2>

      {/* Data */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Data</Label>
        <Input
          type="date"
          value={data.data || ""}
          onChange={e => onChange("data", e.target.value)}
          className="h-14 text-lg bg-card border-border"
        />
      </div>

      {/* Obra (OGS) */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Obra (OGS)</Label>
        <Select value={data.obra_nome || ""} onValueChange={v => onChange("obra_nome", v)}>
          <SelectTrigger className="h-14 text-lg bg-card border-border">
            <SelectValue placeholder={loadingObras ? "Carregando..." : "Selecione a obra"} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {obras?.map(obra => (
              <SelectItem key={obra.id} value={obra.numero_ogs} className="py-3 text-base">
                {obra.numero_ogs} — {obra.cliente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedObra && (
          <p className="text-xs text-muted-foreground px-1">
            📍 {selectedObra.endereco} • 🏢 {selectedObra.cliente}
          </p>
        )}
      </div>

      {/* Equipamento */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Equipamento / Frota</Label>
        {maquinas && maquinas.length > 0 ? (
          <Select value={data.equipamento || ""} onValueChange={v => onChange("equipamento", v)}>
            <SelectTrigger className="h-14 text-lg bg-card border-border">
              <SelectValue placeholder={loadingMaquinas ? "Carregando..." : "Selecione o equipamento"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {maquinas.map((m: any) => (
                <SelectItem key={m.id} value={m.frota} className="py-3 text-base">
                  {m.frota} — {m.nome} {m.tipo ? `(${m.tipo})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="Ex: FR-01, Rolo Tandem..."
            value={data.equipamento || ""}
            onChange={e => onChange("equipamento", e.target.value)}
            className="h-14 text-lg bg-card border-border"
          />
        )}
      </div>

      {/* Turno */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Turno</Label>
        <div className="grid grid-cols-2 gap-3">
          {TURNO_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onChange("turno", t)}
              className={`h-14 rounded-lg text-lg font-semibold transition-all border-2 ${
                data.turno === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              }`}
            >
              {t === "Diurno" ? "☀️" : "🌙"} {t}
            </button>
          ))}
        </div>
      </div>

      {/* Clima */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Clima</Label>
        <div className="grid grid-cols-2 gap-3">
          {CLIMA_OPTIONS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange("clima", c)}
              className={`h-12 rounded-lg text-sm font-medium transition-all border-2 ${
                data.clima === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

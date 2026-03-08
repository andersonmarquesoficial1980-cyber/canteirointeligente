import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface InfraProducaoEntry {
  id: string;
  sentido: string;
  estaca_inicial: string;
  estaca_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_cm: string;
  is_retrabalho: boolean;
}

interface Props {
  empreiteiro: string;
  tipoServico: string;
  producao: InfraProducaoEntry[];
  onChangeEmpreiteiro: (v: string) => void;
  onChangeTipoServico: (v: string) => void;
  onChangeProducao: (entries: InfraProducaoEntry[]) => void;
}

const EMPREITEIROS = ["EJL", "Objetiva"];
const SERVICOS = ["Demolição", "Limpeza", "Concretagem", "Escavação", "Aterro", "Drenagem", "Sinalização", "Outro"];

const emptyEntry = (): InfraProducaoEntry => ({
  id: crypto.randomUUID(), sentido: "", estaca_inicial: "", estaca_final: "",
  comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false,
});

export default function SectionInfraestrutura({ empreiteiro, tipoServico, producao, onChangeEmpreiteiro, onChangeTipoServico, onChangeProducao }: Props) {
  const update = (id: string, field: string, value: any) =>
    onChangeProducao(producao.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🏗️ Infraestrutura</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Empreiteiro</Label>
          <Select value={empreiteiro} onValueChange={onChangeEmpreiteiro}>
            <SelectTrigger className="h-12 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {EMPREITEIROS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de Serviço</Label>
          <Select value={tipoServico} onValueChange={onChangeTipoServico}>
            <SelectTrigger className="h-12 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {SERVICOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <span className="text-sm font-semibold text-foreground pt-2">Produção</span>

      {producao.map((entry, idx) => {
        const area = (parseFloat(entry.comprimento_m) || 0) * (parseFloat(entry.largura_m) || 0);
        return (
          <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary">Trecho {idx + 1}</span>
              {producao.length > 1 && (
                <button onClick={() => onChangeProducao(producao.filter(e => e.id !== entry.id))} className="text-destructive p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sentido</Label>
                <Input value={entry.sentido} onChange={e => update(entry.id, "sentido", e.target.value)} className="h-11 bg-secondary border-border" placeholder="N/S" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estaca Ini.</Label>
                <Input value={entry.estaca_inicial} onChange={e => update(entry.id, "estaca_inicial", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estaca Fin.</Label>
                <Input value={entry.estaca_final} onChange={e => update(entry.id, "estaca_final", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Comp (m)</Label>
                <Input type="number" inputMode="decimal" value={entry.comprimento_m} onChange={e => update(entry.id, "comprimento_m", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Larg (m)</Label>
                <Input type="number" inputMode="decimal" value={entry.largura_m} onChange={e => update(entry.id, "largura_m", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Esp (cm)</Label>
                <Input type="number" inputMode="decimal" value={entry.espessura_cm} onChange={e => update(entry.id, "espessura_cm", e.target.value)} className="h-11 bg-secondary border-border" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={entry.is_retrabalho}
                  onCheckedChange={v => update(entry.id, "is_retrabalho", !!v)}
                />
                <Label className="text-xs text-muted-foreground">É Retrabalho?</Label>
              </div>
              {area > 0 && (
                <span className="text-sm font-bold text-primary">Área: {area.toFixed(2)} m²</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

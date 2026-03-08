import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export interface TrechoCauqEntry {
  id: string;
  tipo_servico: string;
  sentido_faixa: string;
  estaca_inicial: string;
  estaca_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_m: string;
  total_toneladas: string;
  observacoes: string;
}

export interface ProducaoCauqData {
  trechos: TrechoCauqEntry[];
}

interface Props {
  data: ProducaoCauqData;
  onChange: (data: ProducaoCauqData) => void;
}

const TIPOS_SERVICO = [
  "Fresagem Reparo Profundo",
  "Fresagem",
  "Aplicação de BGS",
  "RAP Espumado",
  "Aplicação de Binder",
  "Capa/CBUQ",
  "Pintura de Sinalização",
];

const emptyTrecho = (): TrechoCauqEntry => ({
  id: crypto.randomUUID(),
  tipo_servico: "",
  sentido_faixa: "",
  estaca_inicial: "",
  estaca_final: "",
  comprimento_m: "",
  largura_m: "",
  espessura_m: "",
  total_toneladas: "",
  observacoes: "",
});

export default function SectionProducaoCauq({ data, onChange }: Props) {
  const updateTrecho = (id: string, field: string, value: string) =>
    onChange({
      ...data,
      trechos: data.trechos.map(t => t.id === id ? { ...t, [field]: value } : t),
    });

  const addTrecho = () =>
    onChange({ ...data, trechos: [...data.trechos, emptyTrecho()] });

  const removeTrecho = (id: string) =>
    onChange({ ...data, trechos: data.trechos.filter(t => t.id !== id) });

  const calcArea = (t: TrechoCauqEntry) => {
    const c = parseFloat(t.comprimento_m);
    const l = parseFloat(t.largura_m);
    if (!isNaN(c) && !isNaN(l) && c > 0 && l > 0) return (c * l).toFixed(2);
    return "";
  };


  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">📐 Produção do Dia (CAUQ)</h2>

      {data.trechos.map((trecho, idx) => (
        <div key={trecho.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">Trecho {idx + 1}</span>
            {data.trechos.length > 1 && (
              <button onClick={() => removeTrecho(trecho.id)} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de Serviço</Label>
            <Select value={trecho.tipo_servico} onValueChange={v => updateTrecho(trecho.id, "tipo_servico", v)}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {TIPOS_SERVICO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sentido / Faixa</Label>
            <Input
              value={trecho.sentido_faixa}
              onChange={e => updateTrecho(trecho.id, "sentido_faixa", e.target.value)}
              className="h-11 bg-secondary border-border"
              placeholder="Ex: Faixa 1 e 2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estaca Inicial</Label>
              <Input
                inputMode="numeric"
                value={trecho.estaca_inicial}
                onChange={e => updateTrecho(trecho.id, "estaca_inicial", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estaca Final</Label>
              <Input
                inputMode="numeric"
                value={trecho.estaca_final}
                onChange={e => updateTrecho(trecho.id, "estaca_final", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Comp. (m)</Label>
              <Input
                inputMode="decimal"
                value={trecho.comprimento_m}
                onChange={e => updateTrecho(trecho.id, "comprimento_m", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Larg. (m)</Label>
              <Input
                inputMode="decimal"
                value={trecho.largura_m}
                onChange={e => updateTrecho(trecho.id, "largura_m", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Área (m²)</Label>
              <Input
                value={calcArea(trecho)}
                readOnly
                className="h-11 bg-muted border-border text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Espessura (m)</Label>
              <Input
                inputMode="decimal"
                value={trecho.espessura_m}
                onChange={e => updateTrecho(trecho.id, "espessura_m", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Total / Toneladas</Label>
              <Input
                inputMode="decimal"
                value={trecho.total_toneladas}
                onChange={e => updateTrecho(trecho.id, "total_toneladas", e.target.value)}
                className="h-11 bg-secondary border-border"
              />
            </div>
          </div>

          {/* Tonelagem validation */}
          {needsJustificativa(trecho) && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                <span>Diferença de tonelagem detectada (NF: {totalTonelagemNF.toFixed(2)}t vs Trecho: {trecho.total_toneladas}t)</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-destructive font-semibold">Justificativa de Diferença de Tonelagem *</Label>
                <Textarea
                  value={trecho.justificativa_tonelagem}
                  onChange={e => updateTrecho(trecho.id, "justificativa_tonelagem", e.target.value)}
                  className="min-h-[80px] bg-background border-destructive/30 text-base"
                  placeholder="Justifique a diferença entre a tonelagem do trecho e a das notas fiscais..."
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observações do Trecho</Label>
            <Textarea
              value={trecho.observacoes}
              onChange={e => updateTrecho(trecho.id, "observacoes", e.target.value)}
              className="min-h-[70px] bg-secondary border-border text-base"
              placeholder="Observações deste trecho..."
            />
          </div>
        </div>
      ))}

      <Button size="sm" onClick={addTrecho} className="w-full h-12 gap-2 text-base">
        <Plus className="w-5 h-5" /> Adicionar Trecho
      </Button>
    </div>
  );
}

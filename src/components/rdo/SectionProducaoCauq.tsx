import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Ruler } from "lucide-react";
import { useTiposServico } from "@/hooks/useFilteredData";

export interface TrechoCauqEntry {
  id: string;
  tipo_servico: string;
  sentido: string;
  faixa: string;
  estaca_inicial: string;
  estaca_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_m: string;
  observacoes: string;
}

export interface ProducaoCauqData {
  trechos: TrechoCauqEntry[];
  tonelagem_aplicada: string;
}

interface Props {
  data: ProducaoCauqData;
  onChange: (data: ProducaoCauqData) => void;
  tipoRdo: string;
}

const emptyTrecho = (): TrechoCauqEntry => ({
  id: crypto.randomUUID(),
  tipo_servico: "", sentido: "", faixa: "", estaca_inicial: "", estaca_final: "",
  comprimento_m: "", largura_m: "", espessura_m: "", observacoes: "",
});

export default function SectionProducaoCauq({ data, onChange, tipoRdo, nfEntries }: Props & { nfEntries?: { tonelagem: string }[] }) {
  const { data: servicosData } = useTiposServico(tipoRdo);
  const servicos = servicosData?.map(s => s.nome) ?? [];

  const totalNF = (nfEntries ?? []).reduce((sum, e) => sum + (parseFloat(e.tonelagem) || 0), 0);

  const updateTrecho = (id: string, field: string, value: string) =>
    onChange({ ...data, trechos: data.trechos.map(t => t.id === id ? { ...t, [field]: value } : t) });

  const addTrecho = () => onChange({ ...data, trechos: [...data.trechos, emptyTrecho()] });
  const removeTrecho = (id: string) => onChange({ ...data, trechos: data.trechos.filter(t => t.id !== id) });

  const calcArea = (t: TrechoCauqEntry) => {
    const c = parseFloat(t.comprimento_m);
    const l = parseFloat(t.largura_m);
    if (!isNaN(c) && !isNaN(l) && c > 0 && l > 0) return (c * l).toFixed(2);
    return "";
  };

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Ruler className="w-5 h-5 text-blue-500" />
        Produção do Dia (CAUQ)
      </h2>

      {data.trechos.map((trecho, idx) => (
        <div key={trecho.id} className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display font-bold text-primary">Trecho {idx + 1}</span>
            {data.trechos.length > 1 && (
              <button onClick={() => removeTrecho(trecho.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Tipo de Serviço</span>
            <Select value={trecho.tipo_servico} onValueChange={v => updateTrecho(trecho.id, "tipo_servico", v)}>
              <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {servicos.length > 0
                  ? servicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado para este tipo de RDO</p>}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Sentido</span>
              <Select value={trecho.sentido} onValueChange={v => updateTrecho(trecho.id, "sentido", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRESCENTE">CRESCENTE</SelectItem>
                  <SelectItem value="DECRESCENTE">DECRESCENTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Faixa</span>
              <Input value={trecho.faixa} onChange={e => updateTrecho(trecho.id, "faixa", e.target.value)} className="h-11 bg-white border-border rounded-xl" placeholder="Ex: 1, 2, Acost." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Estaca Inicial</span>
              <Input inputMode="numeric" value={trecho.estaca_inicial} onChange={e => updateTrecho(trecho.id, "estaca_inicial", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Estaca Final</span>
              <Input inputMode="numeric" value={trecho.estaca_final} onChange={e => updateTrecho(trecho.id, "estaca_final", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Comp. (m)</span>
              <Input inputMode="decimal" value={trecho.comprimento_m} onChange={e => updateTrecho(trecho.id, "comprimento_m", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Larg. (m)</span>
              <Input inputMode="decimal" value={trecho.largura_m} onChange={e => updateTrecho(trecho.id, "largura_m", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Área (m²)</span>
              <Input value={calcArea(trecho)} readOnly className="h-11 bg-muted/50 border-border rounded-xl text-muted-foreground cursor-not-allowed" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Espessura (cm)</span>
            <Input inputMode="decimal" value={trecho.espessura_m} onChange={e => updateTrecho(trecho.id, "espessura_m", e.target.value)} className="h-11 bg-white border-border rounded-xl" placeholder="Ex: 5" />
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Observações do Trecho</span>
            <Textarea value={trecho.observacoes} onChange={e => updateTrecho(trecho.id, "observacoes", e.target.value)} className="min-h-[70px] bg-white border-border text-base rounded-xl" placeholder="Observações deste trecho..." />
          </div>
        </div>
      ))}

      <Button size="sm" onClick={addTrecho} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Trecho
      </Button>

      {/* Tonelagem */}
      <div className="rdo-card space-y-3 border-l-4 border-l-blue-500">
        <h3 className="text-sm font-display font-bold text-blue-700">Tonelagem</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Total via NF (automático)</span>
            <div className="h-11 bg-muted/50 border border-border rounded-xl flex items-center px-3 text-base font-bold text-primary">
              {totalNF > 0 ? `${totalNF.toFixed(2)} t` : "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Tonelagem Aplicada (real)</span>
            <Input
              inputMode="decimal"
              value={data.tonelagem_aplicada ?? ""}
              onChange={e => onChange({ ...data, tonelagem_aplicada: e.target.value })}
              className="h-11 bg-white border-border rounded-xl"
              placeholder="Ex: 48.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

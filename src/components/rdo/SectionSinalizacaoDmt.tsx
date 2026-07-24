import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Route, Ruler, Trash2 } from "lucide-react";

export interface SinalizacaoHorizontalData {
  id: string;
  tipo: string;
  sentido: string;
  faixa: string;
  estaca_inicial: string;
  estaca_final: string;
  quantidade: string;
  comprimento_m: string;
  largura_m: string;
  quantidade_taxas: string;
}

export interface InformacoesDmtData {
  dmt_usina_km: string;
  dmt_canteiro_km: string;
}

interface Props {
  sinalizacoes: SinalizacaoHorizontalData[];
  dmt: InformacoesDmtData;
  onChangeSinalizacoes: (entries: SinalizacaoHorizontalData[]) => void;
  onChangeDmt: (data: InformacoesDmtData) => void;
}

export const emptySinalizacaoHorizontal = (): SinalizacaoHorizontalData => ({
  id: crypto.randomUUID(),
  tipo: "",
  sentido: "",
  faixa: "",
  estaca_inicial: "",
  estaca_final: "",
  quantidade: "",
  comprimento_m: "",
  largura_m: "",
  quantidade_taxas: "",
});

export default function SectionSinalizacaoDmt({
  sinalizacoes,
  dmt,
  onChangeSinalizacoes,
  onChangeDmt,
}: Props) {
  const updateSinalizacao = (id: string, field: keyof SinalizacaoHorizontalData, value: string) => {
    onChangeSinalizacoes(sinalizacoes.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addSinalizacao = () => {
    onChangeSinalizacoes([...sinalizacoes, emptySinalizacaoHorizontal()]);
  };

  const removeSinalizacao = (id: string) => {
    if (sinalizacoes.length <= 1) {
      onChangeSinalizacoes([emptySinalizacaoHorizontal()]);
      return;
    }
    onChangeSinalizacoes(sinalizacoes.filter((s) => s.id !== id));
  };

  const updateDmt = (field: keyof InformacoesDmtData, value: string) => {
    onChangeDmt({ ...dmt, [field]: value });
  };

  const toNumber = (value: string) => {
    if (!value) return 0;
    const n = parseFloat(String(value).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="px-4 space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Resumo:</span>{" "}
        {sinalizacoes.length} {sinalizacoes.length === 1 ? "sinalização lançada" : "sinalizações lançadas"}
      </div>

      <div className="space-y-3">
        {sinalizacoes.map((sinalizacao, idx) => {
          const comp = toNumber(sinalizacao.comprimento_m);
          const larg = toNumber(sinalizacao.largura_m);
          const areaM2 = comp > 0 && larg > 0
            ? (comp * larg).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";

          return (
            <div key={sinalizacao.id} className="rdo-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="rdo-section-title">
                  <Route className="w-5 h-5 text-primary" />
                  Sinalização Horizontal {idx + 1}
                </h2>
                <button
                  type="button"
                  onClick={() => removeSinalizacao(sinalizacao.id)}
                  className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors"
                  aria-label="Remover sinalização"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="rdo-label">Tipo</span>
                  <Select value={sinalizacao.tipo} onValueChange={(v) => updateSinalizacao(sinalizacao.id, "tipo", v)}>
                    <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Eixo direito">Eixo direito</SelectItem>
                      <SelectItem value="Eixo seccionado">Eixo seccionado</SelectItem>
                      <SelectItem value="Bordo">Bordo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className="rdo-label">Sentido</span>
                  <Select value={sinalizacao.sentido} onValueChange={(v) => updateSinalizacao(sinalizacao.id, "sentido", v)}>
                    <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRESCENTE">Crescente</SelectItem>
                      <SelectItem value="DECRESCENTE">Decrescente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="rdo-label">Faixa</span>
                <Input
                  value={sinalizacao.faixa}
                  onChange={(e) => updateSinalizacao(sinalizacao.id, "faixa", e.target.value)}
                  className="h-11 bg-white border-border rounded-xl"
                  placeholder="Ex: 1, 2, acostamento"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="rdo-label">Estaca Inicial</span>
                  <NumericInput
                    value={sinalizacao.estaca_inicial}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "estaca_inicial", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Estaca Final</span>
                  <NumericInput
                    value={sinalizacao.estaca_final}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "estaca_final", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="rdo-label">Quantidade</span>
                  <NumericInput
                    value={sinalizacao.quantidade}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "quantidade", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Quantidade de Taxas</span>
                  <NumericInput
                    value={sinalizacao.quantidade_taxas}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "quantidade_taxas", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <span className="rdo-label">Comprimento (m)</span>
                  <NumericInput
                    value={sinalizacao.comprimento_m}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "comprimento_m", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Largura (m)</span>
                  <NumericInput
                    value={sinalizacao.largura_m}
                    onChange={(e) => updateSinalizacao(sinalizacao.id, "largura_m", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Área (m²)</span>
                  <Input
                    value={areaM2}
                    readOnly
                    placeholder="Auto"
                    className="h-11 bg-muted/50 border-border rounded-xl text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          size="sm"
          onClick={addSinalizacao}
          className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold"
        >
          <Plus className="w-5 h-5" /> Adicionar Sinalização
        </Button>
      </div>

      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <Ruler className="w-5 h-5 text-primary" />
          Informações de DMT
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">DMT Usina (km)</span>
            <NumericInput
              value={dmt.dmt_usina_km}
              onChange={(e) => updateDmt("dmt_usina_km", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">DMT Canteiro (km)</span>
            <NumericInput
              value={dmt.dmt_canteiro_km}
              onChange={(e) => updateDmt("dmt_canteiro_km", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

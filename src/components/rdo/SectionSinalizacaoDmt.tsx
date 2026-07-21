import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, Ruler } from "lucide-react";

export interface SinalizacaoHorizontalData {
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
  sinalizacao: SinalizacaoHorizontalData;
  dmt: InformacoesDmtData;
  onChangeSinalizacao: (data: SinalizacaoHorizontalData) => void;
  onChangeDmt: (data: InformacoesDmtData) => void;
}

export default function SectionSinalizacaoDmt({
  sinalizacao,
  dmt,
  onChangeSinalizacao,
  onChangeDmt,
}: Props) {
  const updateSinalizacao = (field: keyof SinalizacaoHorizontalData, value: string) => {
    onChangeSinalizacao({ ...sinalizacao, [field]: value });
  };

  const updateDmt = (field: keyof InformacoesDmtData, value: string) => {
    onChangeDmt({ ...dmt, [field]: value });
  };

  return (
    <div className="px-4 space-y-4">
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <Route className="w-5 h-5 text-primary" />
          Sinalização Horizontal
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Tipo</span>
            <Select value={sinalizacao.tipo} onValueChange={(v) => updateSinalizacao("tipo", v)}>
              <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EIXO">Eixo</SelectItem>
                <SelectItem value="BORDO">Bordo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Sentido</span>
            <Select value={sinalizacao.sentido} onValueChange={(v) => updateSinalizacao("sentido", v)}>
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
            onChange={(e) => updateSinalizacao("faixa", e.target.value)}
            className="h-11 bg-white border-border rounded-xl"
            placeholder="Ex: 1, 2, acostamento"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Estaca Inicial</span>
            <NumericInput
              value={sinalizacao.estaca_inicial}
              onChange={(e) => updateSinalizacao("estaca_inicial", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Estaca Final</span>
            <NumericInput
              value={sinalizacao.estaca_final}
              onChange={(e) => updateSinalizacao("estaca_final", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Quantidade</span>
            <NumericInput
              value={sinalizacao.quantidade}
              onChange={(e) => updateSinalizacao("quantidade", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Quantidade de Taxas</span>
            <NumericInput
              value={sinalizacao.quantidade_taxas}
              onChange={(e) => updateSinalizacao("quantidade_taxas", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Comprimento (m)</span>
            <NumericInput
              value={sinalizacao.comprimento_m}
              onChange={(e) => updateSinalizacao("comprimento_m", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Largura (m)</span>
            <NumericInput
              value={sinalizacao.largura_m}
              onChange={(e) => updateSinalizacao("largura_m", e.target.value)}
              className="h-11 bg-white border-border rounded-xl"
            />
          </div>
        </div>
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

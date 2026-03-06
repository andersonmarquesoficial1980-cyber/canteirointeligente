import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send } from "lucide-react";
import RdoHeader from "@/components/rdo/RdoHeader";
import RdoTipoSelector from "@/components/rdo/RdoTipoSelector";
import SectionInfraestrutura, { type InfraProducaoEntry } from "@/components/rdo/SectionInfraestrutura";
import SectionCauq, { type NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import SectionCanteiro, { type NotaFiscalInsumoEntry } from "@/components/rdo/SectionCanteiro";
import SectionEquipamentos, { type EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";
import SectionBasculante, { type BasculanteEntry } from "@/components/rdo/SectionBasculante";
import SectionManchaAreia, { type ManchaAreiaEntry } from "@/components/rdo/SectionManchaAreia";
import StepEfetivo, { type EfetivoEntry } from "@/components/rdo/StepEfetivo";

export default function RdoForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Header
  const [header, setHeader] = useState({
    data: today, obra_nome: "", cliente: "", local: "", status_obra: "Trabalhou",
  });
  const handleHeaderChange = (field: string, value: string) =>
    setHeader(prev => ({ ...prev, [field]: value }));

  // Tipo RDO
  const [tipoRdo, setTipoRdo] = useState("");

  // Infraestrutura
  const [empreiteiro, setEmpreiteiro] = useState("");
  const [tipoServico, setTipoServico] = useState("");
  const [infraProducao, setInfraProducao] = useState<InfraProducaoEntry[]>([{
    id: crypto.randomUUID(), sentido: "", estaca_inicial: "", estaca_final: "",
    comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false,
  }]);

  // CAUQ
  const [nfMassa, setNfMassa] = useState<NotaFiscalMassaEntry[]>([{
    id: crypto.randomUUID(), placa: "", usina: "", nf: "", tonelagem: "", tipo_material: "", tipo_material_outro: "",
  }]);

  // Canteiro
  const [nfInsumos, setNfInsumos] = useState<NotaFiscalInsumoEntry[]>([{
    id: crypto.randomUUID(), nf: "", fornecedor: "", material: "", quantidade: "",
  }]);

  // Shared
  const [equipamentos, setEquipamentos] = useState<EquipamentoEntry[]>([{
    id: crypto.randomUUID(), frota: "", patrimonio: "", empresa_dona: "", is_menor: false,
  }]);

  const [basculantes, setBasculantes] = useState<BasculanteEntry[]>([{
    id: crypto.randomUUID(), placa: "", material: "", viagens: "", empresa_dona: "",
  }]);

  const [teveEnsaio, setTeveEnsaio] = useState(false);
  const [manchaAreia, setManchaAreia] = useState<ManchaAreiaEntry[]>([{
    id: crypto.randomUUID(), faixa: "", d1_mm: "", d2_mm: "", d3_mm: "", volume_cm3: "25",
  }]);

  const [efetivo, setEfetivo] = useState<EfetivoEntry[]>([{
    id: crypto.randomUUID(), funcao: "", quantidade: "1", entrada: "", saida: "",
  }]);

  const handleSubmit = async () => {
    if (!header.obra_nome || !header.data) {
      toast({ title: "Erro", description: "Preencha OGS e Data.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Insert rdo_diarios
      const { data: rdo, error: rdoError } = await supabase
        .from("rdo_diarios")
        .insert({
          data: header.data,
          obra_nome: header.obra_nome,
          turno: tipoRdo || null,
          clima: header.status_obra || null,
        })
        .select("id")
        .single();

      if (rdoError) throw rdoError;
      const rdoId = rdo.id;

      // 2. Produção (infra)
      if (tipoRdo === "INFRAESTRUTURA") {
        const entries = infraProducao
          .filter(p => p.comprimento_m || p.largura_m)
          .map(p => ({
            rdo_id: rdoId,
            tipo_servico: tipoServico || null,
            sentido: p.sentido || null,
            faixa: p.estaca_inicial || null,
            km_inicial: p.estaca_inicial ? parseFloat(p.estaca_inicial) : null,
            km_final: p.estaca_final ? parseFloat(p.estaca_final) : null,
            comprimento_m: p.comprimento_m ? parseFloat(p.comprimento_m) : null,
            largura_m: p.largura_m ? parseFloat(p.largura_m) : null,
            espessura_cm: p.espessura_cm ? parseFloat(p.espessura_cm) : null,
          }));
        if (entries.length > 0) {
          const { error } = await supabase.from("rdo_producao").insert(entries);
          if (error) throw error;
        }
      }

      // 3. Efetivo
      const efEntries = efetivo
        .filter(e => e.funcao)
        .map(e => ({
          rdo_id: rdoId,
          funcao: e.funcao,
          quantidade: parseInt(e.quantidade) || 1,
          entrada: e.entrada || null,
          saida: e.saida || null,
        }));
      if (efEntries.length > 0) {
        const { error } = await supabase.from("rdo_efetivo").insert(efEntries);
        if (error) throw error;
      }

      // 4. Mancha de Areia
      if (teveEnsaio) {
        const manchaEntries = manchaAreia
          .filter(m => m.d1_mm || m.d2_mm || m.d3_mm)
          .map(m => {
            const vals = [m.d1_mm, m.d2_mm, m.d3_mm].map(Number).filter(v => !isNaN(v) && v > 0);
            const dm = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            const vol = parseFloat(m.volume_cm3) || 25;
            const hs = dm && dm > 0 ? (4 * vol * 1000) / (Math.PI * dm * dm) : null;
            return {
              rdo_id: rdoId,
              faixa: m.faixa || null,
              d1_mm: m.d1_mm ? parseFloat(m.d1_mm) : null,
              d2_mm: m.d2_mm ? parseFloat(m.d2_mm) : null,
              d3_mm: m.d3_mm ? parseFloat(m.d3_mm) : null,
              dm_mm: dm ? parseFloat(dm.toFixed(2)) : null,
              volume_cm3: vol,
              hs_mm: hs ? parseFloat(hs.toFixed(4)) : null,
            };
          });
        if (manchaEntries.length > 0) {
          const { error } = await supabase.from("rdo_mancha_areia").insert(manchaEntries);
          if (error) throw error;
        }
      }

      toast({ title: "✅ RDO Salvo!", description: "Relatório registrado com sucesso." });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">RDO Digital</h1>
            <p className="text-xs text-muted-foreground">Relatório Diário de Obra</p>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto pb-28 space-y-2">
        <div className="p-4">
          <RdoHeader data={header} onChange={handleHeaderChange} />
        </div>

        <RdoTipoSelector value={tipoRdo} onChange={setTipoRdo} />

        {/* Conditional sections */}
        {tipoRdo === "INFRAESTRUTURA" && (
          <SectionInfraestrutura
            empreiteiro={empreiteiro}
            tipoServico={tipoServico}
            producao={infraProducao}
            onChangeEmpreiteiro={setEmpreiteiro}
            onChangeTipoServico={setTipoServico}
            onChangeProducao={setInfraProducao}
          />
        )}

        {tipoRdo === "CAUQ" && <SectionCauq entries={nfMassa} onChange={setNfMassa} />}
        {tipoRdo === "CANTEIRO" && <SectionCanteiro entries={nfInsumos} onChange={setNfInsumos} />}

        {/* Shared modules */}
        {tipoRdo && (
          <>
            <SectionEquipamentos entries={equipamentos} onChange={setEquipamentos} />
            <SectionBasculante entries={basculantes} onChange={setBasculantes} />
            <StepEfetivo entries={efetivo} onChange={setEfetivo} />
            <SectionManchaAreia
              teveEnsaio={teveEnsaio}
              onToggleEnsaio={setTeveEnsaio}
              entries={manchaAreia}
              onChange={setManchaAreia}
            />
          </>
        )}
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border px-4 py-4">
        <Button
          onClick={handleSubmit}
          disabled={saving || !header.obra_nome}
          className="w-full h-14 text-base gap-2 font-semibold"
        >
          <Send className="w-5 h-5" /> {saving ? "Salvando..." : "Enviar RDO"}
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Send, FileText, BarChart3, Users, Circle, Thermometer } from "lucide-react";
import RdoStepIndicator from "@/components/rdo/RdoStepIndicator";
import StepDadosGerais from "@/components/rdo/StepDadosGerais";
import StepProducao, { type ProducaoEntry } from "@/components/rdo/StepProducao";
import StepEfetivo, { type EfetivoEntry } from "@/components/rdo/StepEfetivo";
import StepManchaAreia, { type ManchaAreiaEntry } from "@/components/rdo/StepManchaAreia";
import StepTemperatura, { type TemperaturaEntry } from "@/components/rdo/StepTemperatura";

const STEPS = [
  { label: "Dados Gerais", icon: <FileText className="w-4 h-4" /> },
  { label: "Produção", icon: <BarChart3 className="w-4 h-4" /> },
  { label: "Efetivo", icon: <Users className="w-4 h-4" /> },
  { label: "Mancha Areia", icon: <Circle className="w-4 h-4" /> },
  { label: "Temperatura", icon: <Thermometer className="w-4 h-4" /> },
];

export default function RdoForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [dadosGerais, setDadosGerais] = useState({
    data: today,
    obra_nome: "",
    equipamento: "",
    turno: "",
    clima: "",
  });

  const [producao, setProducao] = useState<ProducaoEntry[]>([{
    id: crypto.randomUUID(), tipo_servico: "", rodovia: "", sentido: "",
    faixa: "", km_inicial: "", km_final: "", comprimento_m: "", largura_m: "", espessura_cm: "",
  }]);

  const [efetivo, setEfetivo] = useState<EfetivoEntry[]>([{
    id: crypto.randomUUID(), funcao: "", quantidade: "1", entrada: "", saida: "",
  }]);

  const [manchaAreia, setManchaAreia] = useState<ManchaAreiaEntry[]>([{
    id: crypto.randomUUID(), faixa: "", d1_mm: "", d2_mm: "", d3_mm: "", volume_cm3: "25",
  }]);

  const [temperatura, setTemperatura] = useState<TemperaturaEntry[]>([{
    id: crypto.randomUUID(), placa_veiculo: "", hora_descarga: "", faixa_aplicada: "",
    km_inicial: "", km_final: "", temp_usina_c: "", temp_chegada_c: "", temp_rolagem_c: "",
  }]);

  const handleDadosChange = (field: string, value: any) => {
    setDadosGerais(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (step === 0) return dadosGerais.obra_nome && dadosGerais.data;
    return true;
  };

  const handleSubmit = async () => {
    if (!dadosGerais.obra_nome || !dadosGerais.data) {
      toast({ title: "Erro", description: "Preencha os dados obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Insert rdo_diarios
      const { data: rdo, error: rdoError } = await supabase
        .from("rdo_diarios")
        .insert({
          data: dadosGerais.data,
          obra_nome: dadosGerais.obra_nome,
          turno: dadosGerais.turno || null,
          clima: dadosGerais.clima || null,
        })
        .select("id")
        .single();

      if (rdoError) throw rdoError;
      const rdoId = rdo.id;

      // 2. Insert producao entries
      const prodEntries = producao
        .filter(p => p.comprimento_m || p.largura_m || p.tipo_servico)
        .map(p => ({
          rdo_id: rdoId,
          tipo_servico: p.tipo_servico || null,
          rodovia: p.rodovia || null,
          sentido: p.sentido || null,
          faixa: p.faixa || null,
          km_inicial: p.km_inicial ? parseFloat(p.km_inicial) : null,
          km_final: p.km_final ? parseFloat(p.km_final) : null,
          comprimento_m: p.comprimento_m ? parseFloat(p.comprimento_m) : null,
          largura_m: p.largura_m ? parseFloat(p.largura_m) : null,
          espessura_cm: p.espessura_cm ? parseFloat(p.espessura_cm) : null,
        }));

      if (prodEntries.length > 0) {
        const { error } = await supabase.from("rdo_producao").insert(prodEntries);
        if (error) throw error;
      }

      // 3. Insert efetivo
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

      // 4. Insert mancha de areia
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

      // 5. Insert temperatura
      const tempEntries = temperatura
        .filter(t => t.placa_veiculo || t.temp_usina_c || t.temp_chegada_c)
        .map(t => ({
          rdo_id: rdoId,
          placa_veiculo: t.placa_veiculo || null,
          hora_descarga: t.hora_descarga || null,
          faixa_aplicada: t.faixa_aplicada || null,
          km_inicial: t.km_inicial ? parseFloat(t.km_inicial) : null,
          km_final: t.km_final ? parseFloat(t.km_final) : null,
          temp_usina_c: t.temp_usina_c ? parseFloat(t.temp_usina_c) : null,
          temp_chegada_c: t.temp_chegada_c ? parseFloat(t.temp_chegada_c) : null,
          temp_rolagem_c: t.temp_rolagem_c ? parseFloat(t.temp_rolagem_c) : null,
        }));

      if (tempEntries.length > 0) {
        const { error } = await supabase.from("rdo_temperatura_espalhamento").insert(tempEntries);
        if (error) throw error;
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
            <h1 className="text-lg font-display font-bold text-foreground">RDO Digital</h1>
            <p className="text-xs text-muted-foreground">Relatório Diário de Obra</p>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      <RdoStepIndicator steps={STEPS} currentStep={step} />

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {step === 0 && <StepDadosGerais data={dadosGerais} onChange={handleDadosChange} />}
        {step === 1 && <StepProducao entries={producao} onChange={setProducao} />}
        {step === 2 && <StepEfetivo entries={efetivo} onChange={setEfetivo} />}
        {step === 3 && <StepManchaAreia entries={manchaAreia} onChange={setManchaAreia} />}
        {step === 4 && <StepTemperatura entries={temperatura} onChange={setTemperatura} />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border px-4 py-4 flex gap-3">
        {step > 0 && (
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            className="h-14 flex-1 text-base gap-2 border-border"
          >
            <ArrowLeft className="w-5 h-5" /> Voltar
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            className="h-14 flex-1 text-base gap-2 font-semibold"
          >
            Próximo <ArrowRight className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="h-14 flex-1 text-base gap-2 font-semibold bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5" /> {saving ? "Salvando..." : "Enviar RDO"}
          </Button>
        )}
      </div>
    </div>
  );
}

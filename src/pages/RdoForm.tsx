import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import RdoHeader from "@/components/rdo/RdoHeader";
import RdoTipoSelector from "@/components/rdo/RdoTipoSelector";
import SectionInfraestrutura, { type InfraProducaoEntry } from "@/components/rdo/SectionInfraestrutura";
import SectionCauq, { type NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import SectionCanteiro, { type NotaFiscalInsumoEntry } from "@/components/rdo/SectionCanteiro";
import SectionEquipamentos, { type EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";
import SectionBasculante, { type BasculanteEntry } from "@/components/rdo/SectionBasculante";
import SectionManchaAreia, { type ManchaAreiaEntry } from "@/components/rdo/SectionManchaAreia";
import StepEfetivo, { type EfetivoEntry } from "@/components/rdo/StepEfetivo";
import SectionProducaoCauq, { type ProducaoCauqData, type TrechoCauqEntry } from "@/components/rdo/SectionProducaoCauq";
import { buildHtmlReport } from "@/lib/buildHtmlReport";

export default function RdoForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];

  // Header
  const [header, setHeader] = useState({
    data: today, obra_nome: "", cliente: "", local: "", status_obra: "Trabalhou", turno: "",
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

  // Produção CAUQ
  const [producaoCauq, setProducaoCauq] = useState<ProducaoCauqData>({
    trechos: [{
      id: crypto.randomUUID(), tipo_servico: "", sentido_faixa: "", estaca_inicial: "", estaca_final: "",
      comprimento_m: "", largura_m: "", espessura_m: "", total_toneladas: "", observacoes: "",
    }],
  });

  // Canteiro
  const [nfInsumos, setNfInsumos] = useState<NotaFiscalInsumoEntry[]>([{
    id: crypto.randomUUID(), nf: "", fornecedor: "", material: "", quantidade: "",
  }]);

  // Shared
  const [equipamentos, setEquipamentos] = useState<EquipamentoEntry[]>([{
    id: crypto.randomUUID(), categoria: "", frota: "", patrimonio: "", empresa_dona: "", is_menor: false,
  }]);

  const [basculantes, setBasculantes] = useState<BasculanteEntry[]>([{
    id: crypto.randomUUID(), placa: "", material: "", viagens: "", empresa_dona: "",
  }]);

  const [teveEnsaio, setTeveEnsaio] = useState(false);
  const [manchaAreia, setManchaAreia] = useState<ManchaAreiaEntry[]>([{
    id: crypto.randomUUID(), faixa: "", d1_mm: "", d2_mm: "", d3_mm: "", volume_cm3: "25",
  }]);

  const [efetivo, setEfetivo] = useState<EfetivoEntry[]>([{
    id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "",
  }]);

  // Global hours for Efetivo
  const [globalEntrada, setGlobalEntrada] = useState("");
  const [globalSaida, setGlobalSaida] = useState("");

  const formatDateBR = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const handleWhatsAppResume = async () => {
    const lines: string[] = [];
    lines.push(`📋 *RDO - Relatório Diário de Obra*`);
    lines.push(``);
    lines.push(`📅 Data: ${formatDateBR(header.data)}`);
    lines.push(`🏗️ OGS: ${header.obra_nome} - Cliente: ${header.cliente}`);
    lines.push(`📍 Local: ${header.local}`);

    if (tipoRdo === "CAUQ" && producaoCauq.trechos.length > 0) {
      lines.push(``);
      lines.push(`📐 *Atividades Executadas:*`);
      producaoCauq.trechos.forEach((t, i) => {
        if (!t.tipo_servico && !t.comprimento_m) return;
        const c = parseFloat(t.comprimento_m) || 0;
        const l = parseFloat(t.largura_m) || 0;
        const area = (c * l).toFixed(2);
        lines.push(``);
        lines.push(`▸ ${t.tipo_servico || "—"} ${t.sentido_faixa || ""}`);
        lines.push(`  Est. ${t.estaca_inicial || "—"} a ${t.estaca_final || "—"}`);
        lines.push(`  ${t.comprimento_m || "0"} x ${t.largura_m || "0"} = ${area} m²`);
        lines.push(`  Espessura: ${t.espessura_m || "—"} m | Total: ${t.total_toneladas || "—"} Ton`);
        if (t.observacoes) {
          lines.push(`  Obs: ${t.observacoes}`);
        }
        if (t.justificativa_tonelagem) {
          lines.push(`  ⚠️ Justificativa Tonelagem: ${t.justificativa_tonelagem}`);
        }
      });

      const totalArea = producaoCauq.trechos.reduce((s, t) => {
        const c = parseFloat(t.comprimento_m) || 0;
        const l = parseFloat(t.largura_m) || 0;
        return s + c * l;
      }, 0);
      const totalTon = producaoCauq.trechos.reduce((s, t) => s + (parseFloat(t.total_toneladas) || 0), 0);

      lines.push(``);
      lines.push(`📊 *Resumo Geral:*`);
      lines.push(`  Área Total: ${totalArea.toFixed(2)} m²`);
      lines.push(`  Toneladas Totais: ${totalTon.toFixed(2)} Ton`);
    }

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "✅ Resumo copiado!", description: "Cole no seu WhatsApp." });
    } catch {
      // Fallback
    }

    if (isMobile) {
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
    }
  };

  const handleSubmit = async () => {
    if (!header.obra_nome || !header.data) {
      toast({ title: "Erro", description: "Preencha OGS e Data.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: rdo, error: rdoError } = await supabase
        .from("rdo_diarios")
        .insert({
          data: header.data,
          obra_nome: header.obra_nome,
          turno: header.turno || null,
          clima: header.status_obra || null,
        })
        .select("id")
        .single();

      if (rdoError) throw rdoError;
      const rdoId = rdo.id;

      // Produção (infra)
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

      // Produção CAUQ
      if (tipoRdo === "CAUQ") {
        const trechoEntries = producaoCauq.trechos
          .filter(t => t.comprimento_m || t.largura_m || t.tipo_servico)
          .map(t => ({
            rdo_id: rdoId,
            tipo_servico: t.tipo_servico || null,
            sentido: t.sentido_faixa || null,
            faixa: t.sentido_faixa || null,
            km_inicial: t.estaca_inicial ? parseFloat(t.estaca_inicial) : null,
            km_final: t.estaca_final ? parseFloat(t.estaca_final) : null,
            comprimento_m: t.comprimento_m ? parseFloat(t.comprimento_m) : null,
            largura_m: t.largura_m ? parseFloat(t.largura_m) : null,
            espessura_cm: t.espessura_m ? parseFloat(t.espessura_m) * 100 : null,
          }));
        if (trechoEntries.length > 0) {
          const { error } = await supabase.from("rdo_producao").insert(trechoEntries);
          if (error) throw error;
        }
      }

      // Efetivo
      const efEntries = efetivo
        .filter(e => e.funcao)
        .map(e => ({
          rdo_id: rdoId,
          funcao: e.funcao,
          quantidade: 1,
          entrada: globalEntrada || null,
          saida: globalSaida || null,
        }));
      if (efEntries.length > 0) {
        const { error } = await supabase.from("rdo_efetivo").insert(efEntries);
        if (error) throw error;
      }

      // Mancha de Areia
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

      // Build HTML report and send email
      try {
        const htmlReport = buildHtmlReport(rdoId, header, tipoRdo, producaoCauq, nfMassa, efetivo, equipamentos, basculantes, globalEntrada, globalSaida);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (token) {
          await supabase.functions.invoke("send-rdo-email", {
            body: { rdo_id: rdoId, html_report: htmlReport },
          });
        }
      } catch (emailErr) {
        console.warn("Email send failed (non-blocking):", emailErr);
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

      <div className="flex-1 overflow-y-auto pb-28 space-y-2">
        <div className="p-4">
          <RdoHeader data={header} onChange={handleHeaderChange} />
        </div>

        <RdoTipoSelector value={tipoRdo} onChange={setTipoRdo} />

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

        {tipoRdo === "CAUQ" && (
          <>
            <SectionCauq entries={nfMassa} onChange={setNfMassa} />
            <SectionProducaoCauq data={producaoCauq} onChange={setProducaoCauq} totalTonelagemNF={nfMassa.reduce((s, e) => s + (parseFloat(e.tonelagem) || 0), 0)} />
          </>
        )}
        {tipoRdo === "CANTEIRO" && <SectionCanteiro entries={nfInsumos} onChange={setNfInsumos} />}

        {tipoRdo && (
          <>
            <SectionEquipamentos entries={equipamentos} onChange={setEquipamentos} />
            <SectionBasculante entries={basculantes} onChange={setBasculantes} />
            <StepEfetivo
              entries={efetivo}
              onChange={setEfetivo}
              globalEntrada={globalEntrada}
              globalSaida={globalSaida}
              onChangeGlobalEntrada={setGlobalEntrada}
              onChangeGlobalSaida={setGlobalSaida}
            />
            <SectionManchaAreia
              teveEnsaio={teveEnsaio}
              onToggleEnsaio={setTeveEnsaio}
              entries={manchaAreia}
              onChange={setManchaAreia}
            />
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border px-4 py-4 space-y-2">
        {tipoRdo === "CAUQ" && (
          <Button
            type="button"
            onClick={handleWhatsAppResume}
            className="w-full h-12 text-base gap-2 font-semibold bg-[#25D366] hover:bg-[#1da851] text-white"
          >
            <MessageCircle className="w-5 h-5" /> 📱 Gerar Resumo WhatsApp
          </Button>
        )}
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

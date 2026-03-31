import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, MessageCircle, FileText, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import RdoHeader from "@/components/rdo/RdoHeader";
import RdoTipoSelector from "@/components/rdo/RdoTipoSelector";
import SectionInfraestrutura, { type InfraProducaoEntry } from "@/components/rdo/SectionInfraestrutura";
import SectionCauq, { type NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import SectionCanteiro, { type NotaFiscalInsumoEntry } from "@/components/rdo/SectionCanteiro";
import SectionNfConcreto, { type NfConcretoEntry } from "@/components/rdo/SectionNfConcreto";
import SectionEquipamentos, { type EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";


import StepEfetivo, { type EfetivoEntry } from "@/components/rdo/StepEfetivo";
import SectionProducaoCauq, { type ProducaoCauqData } from "@/components/rdo/SectionProducaoCauq";
import SectionAtividadesCanteiro from "@/components/rdo/SectionAtividadesCanteiro";
import { buildHtmlReport } from "@/lib/buildHtmlReport";
import logoCi from "@/assets/logo-ci.png";

const fmtBR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RdoForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const { profile } = useUserProfile();
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
    comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false, material: "",
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

  // Atividades de Canteiro
  const [teveUsinagem, setTeveUsinagem] = useState(false);
  const [totalUsinado, setTotalUsinado] = useState("");
  const [atividadesCanteiro, setAtividadesCanteiro] = useState("");
  const [observacoesGerais, setObservacoesGerais] = useState("");

  // Shared
  const [equipamentos, setEquipamentos] = useState<EquipamentoEntry[]>([{
    id: crypto.randomUUID(), categoria: "", subTipo: "", frota: "", tipo: "", nome: "", patrimonio: "", empresa_dona: "", is_menor: false,
  }]);


  const [efetivo, setEfetivo] = useState<EfetivoEntry[]>([{
    id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "",
  }]);

  // Global hours for Efetivo
  const [globalEntrada, setGlobalEntrada] = useState("");
  const [globalSaida, setGlobalSaida] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // Auto-fill hours based on turno
  useEffect(() => {
    if (header.turno === "diurno") {
      setGlobalEntrada("07:00");
      setGlobalSaida("17:00");
    } else if (header.turno === "noturno") {
      setGlobalEntrada("21:00");
      setGlobalSaida("05:00");
    }
  }, [header.turno]);

  // Save Draft handler
  const handleSaveDraft = useCallback(async () => {
    const normalizedTurno = header.turno?.trim().toLowerCase() || "";
    if (!header.obra_nome || !header.data) {
      toast({ title: "Atenção", description: "Preencha pelo menos OGS e Data para salvar.", variant: "destructive" });
      return;
    }
    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        setSavingDraft(false);
        return;
      }
      const responsavelNome = profile?.nome_completo || "Não identificado";
      const { error } = await supabase.from("rdo_diarios").insert({
        data: header.data,
        obra_nome: header.obra_nome,
        turno: normalizedTurno || "diurno",
        clima: header.status_obra || null,
        responsavel: responsavelNome,
        user_id: user.id,
      });
      if (error) throw error;
      toast({ title: "✅ Rascunho Salvo!", description: "Progresso registrado no banco de dados." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar rascunho", description: err.message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  }, [header, profile, toast]);

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
      producaoCauq.trechos.forEach((t) => {
        if (!t.tipo_servico && !t.comprimento_m) return;
        const c = parseFloat(t.comprimento_m) || 0;
        const l = parseFloat(t.largura_m) || 0;
        const area = c * l;
        lines.push(``);
        lines.push(`▸ ${t.tipo_servico || "—"} ${t.sentido_faixa || ""}`);
        lines.push(`  Est. ${t.estaca_inicial || "—"} a ${t.estaca_final || "—"}`);
        lines.push(`  ${fmtBR(c)} x ${fmtBR(l)} = ${fmtBR(area)} m²`);
        const espM = t.espessura_m ? (parseFloat(t.espessura_m) / 100) : 0;
        lines.push(`  Espessura: ${espM ? fmtBR(espM) : "—"} m | Total: ${t.total_toneladas ? fmtBR(parseFloat(t.total_toneladas)) : "—"} Ton`);
        if (t.observacoes) {
          lines.push(`  Obs: ${t.observacoes}`);
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
      lines.push(`  Área Total: ${fmtBR(totalArea)} m²`);
      lines.push(`  Toneladas Totais: ${fmtBR(totalTon)} Ton`);
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
    const normalizedTurno = header.turno.trim().toLowerCase();
    if (!header.obra_nome || !header.data || !normalizedTurno) {
      toast({ title: "Erro", description: "Preencha OGS, Data e Turno.", variant: "destructive" });
      return;
    }

    if (!["diurno", "noturno"].includes(normalizedTurno)) {
      toast({ title: "Erro", description: "Turno inválido. Use Diurno ou Noturno.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const responsavelNome = profile?.nome_completo || "Não identificado";
      const rdoPayload = {
        data: header.data,
        obra_nome: header.obra_nome,
        turno: normalizedTurno,
        clima: header.status_obra || null,
        responsavel: responsavelNome,
        user_id: user.id,
      };
      console.log("Payload rdo_diarios:", rdoPayload);

      const { data: rdo, error: rdoError } = await supabase
        .from("rdo_diarios")
        .insert(rdoPayload)
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
            espessura_cm: t.espessura_m ? parseFloat(t.espessura_m) : null,
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

      // Build HTML report and send email
      const htmlReport = buildHtmlReport(rdoId, header, tipoRdo, producaoCauq, nfMassa, efetivo, equipamentos, globalEntrada, globalSaida, { teveUsinagem, totalUsinado, atividadesCanteiro }, responsavelNome);
      let emailSent = false;
      try {
        console.log("Iniciando envio de e-mail...");
        const fmtDate = (d: string) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
        const rdoSubject = `RDO - ${header.obra_nome} - ${fmtDate(header.data)}`;
        const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-rdo-email", {
          body: { rdo_id: rdoId, html_report: htmlReport, subject: rdoSubject },
        });
        console.log("Resposta da função de e-mail:", emailResult);

        if (emailError) {
          console.error("Email invoke error:", emailError);
        } else if (emailResult?.success) {
          emailSent = true;
        } else {
          console.warn("Email response:", emailResult);
        }
      } catch (emailErr) {
        console.warn("Email send failed:", emailErr);
      }

      toast({
        title: emailSent ? "✅ RDO Salvo e E-mail Enviado!" : "✅ RDO Salvo!",
        description: emailSent
          ? "Relatório registrado e e-mail enviado com sucesso."
          : "Relatório registrado. O e-mail não pôde ser enviado.",
      });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Gradient Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">RDO Digital</h1>
            <p className="text-xs text-white/70">Relatório Diário de Obra</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft || !header.obra_nome}
            className="bg-white/15 border-white/30 text-white hover:bg-white/25 gap-1.5 text-xs font-bold rounded-lg"
          >
            <Save className="w-4 h-4" />
            {savingDraft ? "Salvando..." : "Rascunho"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-28 space-y-4 pt-4">
        <div className="px-4">
          <RdoHeader data={header} onChange={handleHeaderChange} />
        </div>

        <div className="px-4">
          <RdoTipoSelector value={tipoRdo} onChange={setTipoRdo} />
        </div>

        {tipoRdo === "INFRAESTRUTURA" && (
          <SectionInfraestrutura
            empreiteiro={empreiteiro}
            tipoServico={tipoServico}
            producao={infraProducao}
            onChangeEmpreiteiro={setEmpreiteiro}
            onChangeTipoServico={setTipoServico}
            onChangeProducao={setInfraProducao}
            tipoRdo="INFRA"
          />
        )}

        {tipoRdo === "CAUQ" && (
          <>
            <SectionCauq entries={nfMassa} onChange={setNfMassa} tipoRdo="CAUQ" />
            <SectionProducaoCauq data={producaoCauq} onChange={setProducaoCauq} tipoRdo="CAUQ" />
          </>
        )}
        {tipoRdo === "CANTEIRO" && <SectionCanteiro entries={nfInsumos} onChange={setNfInsumos} tipoRdo="CANTEIRO" />}

        {tipoRdo && (
          <>
            <SectionEquipamentos entries={equipamentos} onChange={setEquipamentos} tipoRdo={tipoRdo === "INFRAESTRUTURA" ? "INFRA" : tipoRdo} />
            
            <StepEfetivo
              entries={efetivo}
              onChange={setEfetivo}
              globalEntrada={globalEntrada}
              globalSaida={globalSaida}
              onChangeGlobalEntrada={setGlobalEntrada}
              onChangeGlobalSaida={setGlobalSaida}
            />
            {tipoRdo === "CANTEIRO" && (
              <SectionAtividadesCanteiro
                teveUsinagem={teveUsinagem}
                onToggleUsinagem={setTeveUsinagem}
                totalUsinado={totalUsinado}
                onChangeTotalUsinado={setTotalUsinado}
                atividadesCanteiro={atividadesCanteiro}
                onChangeAtividades={setAtividadesCanteiro}
              />
            )}

            {/* Observações Gerais */}
            <div className="px-4 space-y-2">
              <h2 className="font-display font-extrabold text-lg flex items-center gap-2" style={{ color: "hsl(220 70% 20%)" }}>
                <FileText className="w-5 h-5" style={{ color: "hsl(215 100% 50%)" }} />
                Observações Gerais
              </h2>
              <div className="rdo-card">
                <Textarea
                  value={observacoesGerais}
                  onChange={e => setObservacoesGerais(e.target.value)}
                  placeholder="Registre aqui observações importantes sobre o dia de trabalho..."
                  className="min-h-[120px] bg-white border-border rounded-xl text-base resize-y"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border px-4 py-4 space-y-2 shadow-[0_-4px_20px_-4px_hsl(215_60%_50%/0.1)]">
        {tipoRdo === "CAUQ" && (
          <Button
            type="button"
            onClick={handleWhatsAppResume}
            className="w-full h-12 text-base gap-2 font-semibold bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl"
          >
            <MessageCircle className="w-5 h-5" /> 📱 Gerar Resumo WhatsApp
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving || !header.obra_nome || !header.turno}
          className="w-full h-14 text-base gap-2 font-display font-bold rounded-xl bg-header-gradient hover:opacity-90 transition-opacity"
        >
          <Send className="w-5 h-5" /> {saving ? "Salvando..." : "Enviar RDO"}
        </Button>
      </div>
    </div>
  );
}

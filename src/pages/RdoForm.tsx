import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, MessageCircle, FileText, Save, RotateCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { saveRdoOffline } from "@/hooks/useOfflineSync";
import RdoHeader from "@/components/rdo/RdoHeader";
import RdoTipoSelector from "@/components/rdo/RdoTipoSelector";
import SectionInfraestrutura, { type InfraProducaoEntry } from "@/components/rdo/SectionInfraestrutura";
import SectionCauq, { type NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import SectionCanteiro, { type NotaFiscalInsumoEntry } from "@/components/rdo/SectionCanteiro";
import SectionNfConcreto, { type NfConcretoEntry } from "@/components/rdo/SectionNfConcreto";
import SectionPV, { type PVData, type PVMaterialEntry } from "@/components/rdo/SectionPV";
import { type AeroPavData } from "@/components/rdo/SectionAeroPavGru";
import SectionEfetivoTerceirizado, { type TerceirizadoEntry } from "@/components/rdo/SectionEfetivoTerceirizado";
import { useEmpresasTerceiras } from "@/hooks/useEmpresasTerceiras";
import SectionEquipamentos, { type EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";
import SectionEquipamentosPatio, { type EquipamentoPatioEntry } from "@/components/rdo/SectionEquipamentosPatio";


import StepEfetivo, { type EfetivoEntry } from "@/components/rdo/StepEfetivo";
import SectionProducaoCauq, { type ProducaoCauqData } from "@/components/rdo/SectionProducaoCauq";
import SectionAtividadesCanteiro from "@/components/rdo/SectionAtividadesCanteiro";
import { buildHtmlReport } from "@/lib/buildHtmlReport";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useDiaryUnlock } from "@/hooks/useDiaryUnlock";
import { useEquipes } from "@/hooks/useEquipes";

const fmtBR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getTodayInSaoPauloIso(): string {
  const br = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const [day, month, year] = br.split("/");
  return `${year}-${month}-${day}`;
}

function formatDateBRShort(dateValue: string): string {
  if (!dateValue) return "--/--";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return "--/--";
  return `${day}/${month}`;
}

export default function RdoForm() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const { profile } = useUserProfile();
  const isOnline = useOnlineStatus();
  const today = getTodayInSaoPauloIso();
  const isEditMode = !!searchParams.get("edit");

  // Header
  const [header, setHeader] = useState({
    data: today, obra_nome: "", cliente: "", local: "", status_obra: "Trabalhou", turno: "",
    responsavel: "",    // legado
    encarregado: "",    // encarregado da obra (autocomplete)
    engenheiro_responsavel: "", // novo: quem valida no WF Engenharia
    preenchido_por: "", // preenchido automaticamente com nome do usuário logado
  });
  const {
    isBlocked: isDateBlocked,
    isLoading: isUnlockLoading,
    prazoLabel,
  } = useDiaryUnlock(header.data, "rdo");
  const shouldBlockByDeadline = !isEditMode && !isUnlockLoading && isDateBlocked;

  const handleHeaderChange = (field: string, value: string) => {
    setHeader(prev => ({ ...prev, [field]: value }));

    // Auto-fill efetivo quando encarregado muda (só em modo criação, não edição, e só para RDO de Pavimentação)
    // Só dispara se o nome digitado corresponde EXATAMENTE a um responsavel cadastrado
    const tiposComAutoFill = ["CAUQ", "PV", "AEROPAV"];
    if (field === "encarregado" && value && !isEditMode && !loadingEquipes && tiposComAutoFill.includes(tipoRdo)) {
      const membros = getMembrosDoResponsavel(value);
      if (membros.length > 0) {
        // Agrupar por funcao (igual ao formato do StepEfetivo)
        const porFuncao: Record<string, { nomes: string[]; matriculas: string[] }> = {};
        membros.forEach(m => {
          const f = m.funcao || "SEM FUNÇÃO";
          if (!porFuncao[f]) porFuncao[f] = { nomes: [], matriculas: [] };
          porFuncao[f].nomes.push(m.nome);
          porFuncao[f].matriculas.push(m.matricula);
        });
        const novoEfetivo = Object.entries(porFuncao).map(([funcao, data]) => ({
          id: crypto.randomUUID(),
          funcao,
          nome: data.nomes.join("|||"),
          matricula: data.matriculas.join("|||"),
          entrada: "",
          saida: "",
          status: "" as const,
          horasExtras: "",
        }));
        setEfetivo(novoEfetivo);
        const equipeNome = membros[0]?.equipe || "";
        toast({
          title: `✅ Equipe carregada${equipeNome ? ": " + equipeNome : ""}`,
          description: `${membros.length} funcionário(s) pré-preenchido(s). Você pode ajustar.`,
        });
      }
    }
  };

  // Tipo RDO
  const [tipoRdo, setTipoRdo] = useState("");
  const isPatioRdo = tipoRdo === "PATIO";

  // Infraestrutura
  const [empreiteiro, setEmpreiteiro] = useState("");
  const [tipoServico, setTipoServico] = useState("");
  const [infraProducao, setInfraProducao] = useState<InfraProducaoEntry[]>([{
    id: crypto.randomUUID(), tipo_servico: "", sentido: "", estaca_inicial: "", estaca_final: "",
    comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false,
  }]);

  // NF Concreto (Infra)
  const [nfConcreto, setNfConcreto] = useState<NfConcretoEntry[]>([{
    id: crypto.randomUUID(), nf: "", quantidade_m3: "", tipo_concreto: "", fornecedor: "", foto_url: "",
  }]);

  // CAUQ
  const [nfMassa, setNfMassa] = useState<NotaFiscalMassaEntry[]>([{
    id: crypto.randomUUID(), placa: "", usina: "", nf: "", tonelagem: "", tipo_material: "", tipo_material_outro: "",
  }]);

  // Produção CAUQ
  const [producaoCauq, setProducaoCauq] = useState<ProducaoCauqData>({
    trechos: [{
      id: crypto.randomUUID(), tipo_servico: "", sentido: "", faixa: "", estaca_inicial: "", estaca_final: "",
      comprimento_m: "", largura_m: "", espessura_m: "", densidade: "", observacoes: "",
    }],
    tonelagem_aplicada: "",
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

  // PV (Poço de Visita)
  const [pvData, setPvData] = useState<PVData>({
    cliente: "", contrato: "", rua: "", bairro: "", cidade: "",
    modo_execucao: "mecanizado", equipamento_bobcat: "", acoplamento_fc: "",
    compressor: "", martelete: "", qtd_pvs: "",
    materiais: [{ id: crypto.randomUUID(), material: "", quantidade: "", unidade: "Ton" }],
    fotos_antes: [], fotos_durante: [], fotos_depois: [],
    observacoes: "",
  });
  // AEROPAV GRU
  const [aeroPavData, setAeroPavData] = useState<AeroPavData>({
    marmitas_quantidade: "", marmitas_turno: "", observacoes_logistica: "",
  });
  const [terceirizados, setTerceirizados] = useState<TerceirizadoEntry[]>([{
    id: crypto.randomUUID(), empresa_id: "", funcionario_ids: [],
  }]);
  const { empresas: empresasTerceiras, funcionarios: funcionariosTerceiros, loading: loadingTerceiros } = useEmpresasTerceiras();
  const { getMembrosDoResponsavel, loading: loadingEquipes } = useEquipes();
  // Shared
  const [equipamentos, setEquipamentos] = useState<EquipamentoEntry[]>([{
    id: crypto.randomUUID(), categoria: "", subTipo: "", frota: "", tipo: "", nome: "", patrimonio: "", empresa_dona: "", is_menor: false, fresadora_conica: "",
  }]);
  const [equipamentosPatio, setEquipamentosPatio] = useState<EquipamentoPatioEntry[]>([{
    id: crypto.randomUUID(), frota: "", nome: "", tipo: "", status_patio: "Disposição", observacao: "",
  }]);


  const [efetivo, setEfetivo] = useState<EfetivoEntry[]>([{
    id: crypto.randomUUID(), matricula: "", nome: "", funcao: "", entrada: "", saida: "",
  }]);

  // Global hours for Efetivo
  const [globalEntrada, setGlobalEntrada] = useState("");
  const [globalSaida, setGlobalSaida] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null); // ID do rascunho salvo — evita duplicatas
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [copiandoDiaAnterior, setCopiandoDiaAnterior] = useState(false);

  const copiarDiaAnterior = async () => {
    if (!header.obra_nome || !header.data) return;
    if (!header.encarregado) {
      toast({ title: "Preencha o Encarregado antes de copiar.", description: "O sistema usa o encarregado para identificar a equipe correta.", variant: "destructive" });
      return;
    }
    setCopiandoDiaAnterior(true);
    try {
      const dataAnterior = new Date(header.data);
      dataAnterior.setDate(dataAnterior.getDate() - 1);
      const dataAnteriorStr = dataAnterior.toISOString().split('T')[0];

      // Busca RDO do dia anterior da mesma OGS E mesmo encarregado
      const { data: rdoAnterior } = await (supabase as any)
        .from("rdo_diarios")
        .select("id")
        .eq("obra_nome", header.obra_nome)
        .eq("data", dataAnteriorStr)
        .eq("encarregado", header.encarregado)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rdoAnterior) {
        toast({ 
          title: `Nenhum RDO encontrado para o encarregado "${header.encarregado}" no dia anterior.`,
          description: "Verifique se o encarregado e a OGS estão corretos.",
          variant: "destructive" 
        });
        return;
      }

      const rdoId = rdoAnterior.id;
      const statusDestino = header.status_obra; // "Cancelou" ou "Folga"
      const statusEfetivo = statusDestino === "Cancelou" ? "Disposição" : "Folga";

      // Busca equipamentos e efetivo do dia anterior
      const [{ data: equipsAnt }, { data: efetivoAnt }] = await Promise.all([
        (supabase as any).from("rdo_equipamentos").select("*").eq("rdo_id", rdoId),
        (supabase as any).from("rdo_efetivo").select("*").eq("rdo_id", rdoId),
      ]);

      // Monta equipamentos copiados
      if (equipsAnt?.length) {
        setEquipamentos(equipsAnt.map((e: any) => ({
          id: crypto.randomUUID(),
          categoria: e.categoria || "",
          subTipo: e.sub_tipo || "",
          frota: e.frota || "",
          tipo: e.tipo || "",
          nome: e.nome || "",
          patrimonio: e.patrimonio || "",
          empresa_dona: e.empresa_dona || "",
          is_menor: e.is_menor || false,
          fresadora_conica: e.fresadora_conica || "",
        })));
      }

      // Monta efetivo copiado com status ajustado
      if (efetivoAnt?.length) {
        setEfetivo(efetivoAnt.map((e: any) => ({
          id: crypto.randomUUID(),
          matricula: e.matricula || "",
          nome: e.nome || "",
          funcao: e.funcao || "",
          entrada: e.entrada || "",
          saida: e.saida || "",
          status: statusEfetivo,
          employee_id: e.employee_id || null, // preservar vínculo do dia anterior
        })));
      }

      toast({ title: `✅ Equipamentos e efetivo copiados do dia anterior (${dataAnteriorStr}).` });
    } catch (err: any) {
      toast({ title: "Erro ao copiar dia anterior", description: err.message, variant: "destructive" });
    } finally {
      setCopiandoDiaAnterior(false);
    }
  };

  // Preencher "preenchido_por" automaticamente com o nome do usuário logado
  useEffect(() => {
    if (profile?.nome_completo && !header.preenchido_por) {
      setHeader(prev => ({ ...prev, preenchido_por: profile.nome_completo }));
    }
  }, [profile?.nome_completo]);

  // Carregar RDO existente em modo edição
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const carregar = async () => {
      const [{ data: rdo }, { data: efetivo }, { data: producao }, { data: equipamentos }, { data: nfRows }, { data: tercRows }] = await Promise.all([
        (supabase as any).from("rdo_diarios").select("*").eq("id", editId).maybeSingle(),
        (supabase as any).from("rdo_efetivo").select("*").eq("rdo_id", editId),
        (supabase as any).from("rdo_producao").select("*").eq("rdo_id", editId),
        (supabase as any).from("rdo_equipamentos").select("*").eq("rdo_id", editId),
        (supabase as any).from("rdo_nf_massa").select("*").eq("rdo_id", editId),
        (supabase as any).from("rdo_efetivo_terceiros").select("*").eq("rdo_id", editId),
      ]);
      if (!rdo) return;
      setHeader(prev => ({
        ...prev,
        data: rdo.data || prev.data,
        obra_nome: rdo.obra_nome || "",
        status_obra: rdo.clima || "Trabalhou",
        turno: rdo.turno || "",
        responsavel: rdo.responsavel || "",
        encarregado: (rdo as any).encarregado || rdo.responsavel || "",
        engenheiro_responsavel: (rdo as any).engenheiro_responsavel || "",
        preenchido_por: (rdo as any).preenchido_por || rdo.responsavel || "",
      }));
      setObservacoesGerais((rdo as any).observacoes_gerais || "");
      if (rdo.tipo_rdo) setTipoRdo(rdo.tipo_rdo);
      // Efetivo
      if (efetivo?.length) {
        setEfetivo(efetivo.map((e: any) => ({
          id: e.id,
          matricula: e.matricula || "",
          nome: e.nome || "",
          funcao: e.funcao || "",
          entrada: e.entrada || "",
          saida: e.saida || "",
          employee_id: e.employee_id || null,
        })));
        if (efetivo[0]?.entrada) setGlobalEntrada(efetivo[0].entrada);
        if (efetivo[0]?.saida) setGlobalSaida(efetivo[0].saida);
      }
      // Efetivo Terceirizado (modo edição)
      if (tercRows?.length) {
        const grouped: Record<string, { empresa_id: string; funcionario_ids: string[] }> = {};
        (tercRows as any[]).forEach((t: any) => {
          if (!grouped[t.empresa_id]) {
            grouped[t.empresa_id] = { empresa_id: t.empresa_id, funcionario_ids: [] };
          }
          grouped[t.empresa_id].funcionario_ids.push(t.funcionario_id);
        });
        const restoredTerc = Object.values(grouped).map(g => ({
          id: crypto.randomUUID(),
          empresa_id: g.empresa_id,
          funcionario_ids: g.funcionario_ids,
        }));
        if (restoredTerc.length > 0) setTerceirizados(restoredTerc);
      }
      // Produção CAUQ
      if (producao?.length) {
        setProducaoCauq({
          trechos: producao.map((p: any) => ({
            id: p.id,
            tipo_servico: p.tipo_servico || "",
            sentido: p.sentido_faixa || p.sentido || "",
            faixa: p.faixa || "",
            estaca_inicial: p.estaca_inicial || String(p.km_inicial || ""),
            estaca_final: p.estaca_final || String(p.km_final || ""),
            comprimento_m: String(p.comprimento_m || ""),
            largura_m: String(p.largura_m || ""),
            espessura_m: String(p.espessura_cm || ""),
            densidade: String(p.densidade || ""),
            observacoes: p.observacoes || "",
          })),
          tonelagem_aplicada: "",
        });
      }
      // Produção INFRA (edição)
      if (producao?.length && rdo.tipo_rdo === "INFRAESTRUTURA") {
        setInfraProducao(producao.map((p: any) => ({
          id: p.id || crypto.randomUUID(),
          tipo_servico: p.tipo_servico || "",
          sentido: p.sentido_faixa || p.sentido || "",
          estaca_inicial: p.estaca_inicial || String(p.km_inicial || ""),
          estaca_final: p.estaca_final || String(p.km_final || ""),
          comprimento_m: String(p.comprimento_m || ""),
          largura_m: String(p.largura_m || ""),
          espessura_cm: String(p.espessura_cm || ""),
          is_retrabalho: p.is_retrabalho || false,
        })));
      }
      // Equipamentos
      if (equipamentos?.length) {
        setEquipamentos(equipamentos.map((e: any) => ({
          id: e.id,
          categoria: e.categoria || "",
          subTipo: e.sub_tipo || "",
          frota: e.frota || "",
          tipo: e.tipo || "",
          nome: e.nome || "",
          patrimonio: e.patrimonio || "",
          empresa_dona: e.empresa_dona || "",
          is_menor: false,
          fresadora_conica: "",
        })));
      }
      // NF Massa
      if (nfRows?.length) {
        setNfMassa(nfRows.map((n: any) => ({
          id: n.id,
          placa: n.placa || "",
          usina: n.usina || "",
          nf: n.nf || "",
          tonelagem: String(n.tonelagem || ""),
          tipo_material: n.tipo_material || "",
          tipo_material_outro: "",
        })));
      }
    };
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const preenchidoPor = header.preenchido_por || profile?.nome_completo || "Não identificado";
      const encarregado = header.encarregado?.trim() || "";
      const engenheiroResponsavel = header.engenheiro_responsavel?.trim() || "";
      const draftPayload = {
        data: header.data,
        obra_nome: header.obra_nome,
        turno: normalizedTurno || "diurno",
        clima: header.status_obra || null,
        motivo_cancelamento: motivoCancelamento || null,
        responsavel: encarregado || preenchidoPor,
        preenchido_por: preenchidoPor,
        encarregado: encarregado || null,
        engenheiro_responsavel: engenheiroResponsavel || null,
        observacoes_gerais: observacoesGerais || null,
        user_id: user.id,
        company_id: profile?.company_id || null,
        status_validacao: "rascunho",
      };

      // ID existente: vem de rascunho já salvo nesta sessão OU de ?edit= na URL
      const existingId = draftId || searchParams.get("edit");

      if (existingId) {
        // UPDATE — não cria duplicata
        const { error } = await (supabase as any).from("rdo_diarios").update(draftPayload).eq("id", existingId);
        if (error) throw error;
      } else {
        // INSERT — primeiro rascunho desta sessão
        const { data: inserted, error } = await (supabase as any).from("rdo_diarios").insert(draftPayload).select("id").single();
        if (error) throw error;
        setDraftId(inserted.id);
        // Atualiza URL para que o botão Enviar use o mesmo registro
        setSearchParams(prev => { const n = new URLSearchParams(prev); n.set("edit", inserted.id); return n; }, { replace: true });
      }

      toast({ title: "📝 Rascunho salvo!", description: "Continue de onde parou quando quiser." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar rascunho", description: err.message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  }, [header, profile, motivoCancelamento, observacoesGerais, draftId, searchParams, setSearchParams, toast]);

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
        const c = parseFloat(String(t.comprimento_m).replace(",", ".")) || 0;
        const l = parseFloat(String(t.largura_m).replace(",", ".")) || 0;
        const area = c * l;
        lines.push(``);
        lines.push(`▸ ${t.tipo_servico || "—"} ${t.sentido_faixa || ""}`);
        lines.push(`  Est. ${t.estaca_inicial || "—"} a ${t.estaca_final || "—"}`);
        lines.push(`  ${fmtBR(c)} x ${fmtBR(l)} = ${fmtBR(area)} m²`);
        const espM = t.espessura_m ? (parseFloat(String(t.espessura_m).replace(",", ".")) / 100) : 0;
        lines.push(`  Espessura: ${espM ? fmtBR(espM) : "—"} m`);
        if (t.observacoes) {
          lines.push(`  Obs: ${t.observacoes}`);
        }
      });

      const totalArea = producaoCauq.trechos.reduce((s, t) => {
        const c = parseFloat(String(t.comprimento_m).replace(",", ".")) || 0;
        const l = parseFloat(String(t.largura_m).replace(",", ".")) || 0;
        return s + c * l;
      }, 0);
      const totalTon = parseFloat(String(producaoCauq.tonelagem_aplicada || "0").replace(",", ".")) || 0;

      lines.push(``);
      lines.push(`📊 *Resumo Geral:*`);
      lines.push(`  Área Total: ${fmtBR(totalArea)} m²`);
      lines.push(`  Toneladas Totais: ${fmtBR(totalTon)} Ton`);
    }

    if (tipoRdo === "PV") {
      lines.push(``);
      lines.push(`🕳️ *Poço de Visita (PV)*`);
      lines.push(`👤 Cliente: ${header.cliente}`);
      lines.push(`📍 ${pvData.rua}${pvData.bairro ? `, ${pvData.bairro}` : ""} - ${pvData.cidade}`);
      lines.push(`⚙️ Modo: ${pvData.modo_execucao === "mecanizado" ? "Mecanizado" : "Manual"}`);
      lines.push(`🔢 PVs Executados: *${pvData.qtd_pvs || "0"}*`);
      const filledMats = pvData.materiais.filter(m => m.material && m.quantidade);
      if (filledMats.length > 0) {
        lines.push(`📦 Materiais:`);
        filledMats.forEach(m => lines.push(`  ▸ ${m.material}: ${m.quantidade} ${m.unidade}`));
      }
      if (pvData.observacoes) {
        lines.push(`📝 Obs: ${pvData.observacoes}`);
      }
    }

    if (tipoRdo === "AEROPAV") {
      lines.push(``);
      lines.push(`🚧 *Drenagem & Terraplanagem*`);

      // Terceirizados agrupados por empresa
      const filledTerc = terceirizados.filter(t => t.empresa_id && t.funcionario_ids.length > 0);
      if (filledTerc.length > 0) {
        const totalTerc = filledTerc.reduce((s, t) => s + t.funcionario_ids.length, 0);
        lines.push(``);
        lines.push(`🏗️ *Efetivo Terceirizado (${totalTerc}):*`);
        filledTerc.forEach(t => {
          const emp = empresasTerceiras.find(e => e.id === t.empresa_id);
          const nomes = t.funcionario_ids.map(fid => funcionariosTerceiros.find(f => f.id === fid)?.nome || fid);
          lines.push(`  ▸ ${emp?.nome || "Empresa"}: ${nomes.join(", ")}`);
        });
      }
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

  const handleSaveAndNewStreet = async () => {
    if (!header.obra_nome || !header.turno) {
      toast({ title: "Atenção", description: "Preencha OGS e Turno antes de salvar.", variant: "destructive" });
      return;
    }
    // Submit the current RDO first
    await handleSubmitInternal(false);
    // Reset only street-specific fields, keeping shared data
    setPvData(prev => ({
      ...prev,
      rua: "",
      bairro: "",
      cidade: prev.cidade,
      qtd_pvs: "",
      materiais: [{ id: crypto.randomUUID(), material: "", quantidade: "", unidade: "Ton" }],
      fotos_antes: [],
      fotos_durante: [],
      fotos_depois: [],
      observacoes: "",
    }));
    setObservacoesGerais("");
    toast({ title: "✅ RDO salvo!", description: "Novo formulário pronto. Preencha a nova Rua e Produção." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitInternal = async (showNavigate = true) => {
    const normalizedTurno = header.turno.trim().toLowerCase();
    // Pátio Central: só precisa de data
    if (isPatioRdo) {
      if (!header.data) {
        toast({ title: "Erro", description: "Preencha a Data.", variant: "destructive" });
        return;
      }
    } else {
      if (!header.obra_nome || !header.data || !normalizedTurno) {
        toast({ title: "Erro", description: "Preencha OGS, Data e Turno.", variant: "destructive" });
        return;
      }
      if (!["diurno", "noturno"].includes(normalizedTurno)) {
        toast({ title: "Erro", description: "Turno inválido. Use Diurno ou Noturno.", variant: "destructive" });
        return;
      }
      // Efetivo obrigatório quando status é Trabalhou
      if (header.status_obra === "Trabalhou") {
        const validEfetivo = efetivo.filter(e => e.funcao);
        if (validEfetivo.length === 0) {
          toast({ title: "⚠️ Efetivo obrigatório", description: "Adicione pelo menos 1 funcionário no efetivo antes de enviar.", variant: "destructive" });
          return;
        }
        // Equipamentos obrigatórios quando status é Trabalhou (exceto Patio)
        if (!isPatioRdo && equipamentos.length === 0) {
          toast({ title: "⚠️ Equipamentos obrigatórios", description: "Adicione pelo menos 1 equipamento no RDO antes de enviar.", variant: "destructive" });
          return;
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
      return;
    }
    const preenchidoPor = header.preenchido_por || profile?.nome_completo || "Não identificado";
    const encarregado = header.encarregado?.trim() || "";
    const engenheiroResponsavel = header.engenheiro_responsavel?.trim() || "";
    const rdoPayload = {
      data: header.data,
      obra_nome: header.obra_nome,
      turno: normalizedTurno,
      clima: header.status_obra || null,
      motivo_cancelamento: motivoCancelamento || null,
      responsavel: encarregado || preenchidoPor, // legado — compat
      preenchido_por: preenchidoPor,
      encarregado: encarregado || null,
      engenheiro_responsavel: engenheiroResponsavel || null,
      observacoes_gerais: observacoesGerais || null,
      user_id: user.id,
      tipo_rdo: tipoRdo || null,
      company_id: profile?.company_id || null,
    };

    if (!isOnline) {
      await saveRdoOffline(
        {
          rdoPayload,
          tipoRdo,
          tipoServico,
          infraProducao,
          producaoCauq,
          efetivo,
          globalEntrada,
          globalSaida,
        },
        tipoRdo || "RDO",
      );

      toast({
        title: "Lançamento salvo offline ✅",
        description: "Será sincronizado quando a internet voltar.",
      });

      if (showNavigate) navigate("/obras");
      return;
    }

    setSaving(true);
    try {
      // RDO payload ready

      const editId = searchParams.get("edit");
      let rdoId: string;

      if (editId) {
        // Modo edição: atualiza registro existente e deleta filhos pra reinserir
        const { error: updError } = await (supabase as any)
          .from("rdo_diarios").update(rdoPayload).eq("id", editId);
        if (updError) throw updError;
        rdoId = editId;
        // Limpar dados filhos antes de reinserir
        await Promise.all([
          (supabase as any).from("rdo_efetivo").delete().eq("rdo_id", rdoId),
          (supabase as any).from("rdo_producao").delete().eq("rdo_id", rdoId),
          (supabase as any).from("rdo_equipamentos").delete().eq("rdo_id", rdoId),
          (supabase as any).from("rdo_nf_massa").delete().eq("rdo_id", rdoId),
          (supabase as any).from("rdo_efetivo_terceiros").delete().eq("rdo_id", rdoId),
        ]);
      } else {
        const { data: rdo, error: rdoError } = await supabase
          .from("rdo_diarios")
          .insert(rdoPayload)
          .select("id")
          .single();
        if (rdoError) throw rdoError;
        rdoId = rdo.id;
      }

      // Produção (infra)
      if (tipoRdo === "INFRAESTRUTURA") {
        const entries = infraProducao
          .filter(p => p.comprimento_m || p.largura_m || p.tipo_servico)
          .map(p => {
            const comp = p.comprimento_m ? parseFloat(String(p.comprimento_m).replace(",", ".")) : null;
            const larg = p.largura_m ? parseFloat(String(p.largura_m).replace(",", ".")) : null;
            const esp = p.espessura_cm ? parseFloat(String(p.espessura_cm).replace(",", ".")) : null;
            const area = comp && larg ? Math.round(comp * larg * 100) / 100 : null;
            const volume = area && esp ? Math.round(area * (esp / 100) * 1000) / 1000 : null;
            return {
              rdo_id: rdoId,
              tipo_servico: p.tipo_servico || null,
              sentido: p.sentido || null,
              sentido_faixa: p.sentido || null,
              faixa: p.sentido || null,
              estaca_inicial: p.estaca_inicial || null,
              estaca_final: p.estaca_final || null,
              km_inicial: p.estaca_inicial ? parseFloat(String(p.estaca_inicial).replace(",", ".")) : null,
              km_final: p.estaca_final ? parseFloat(String(p.estaca_final).replace(",", ".")) : null,
              comprimento_m: comp,
              largura_m: larg,
              espessura_cm: esp,
              area_m2: area,
              volume_m3: volume,
            };
          });
        if (entries.length > 0) {
          const { error } = await supabase.from("rdo_producao").insert(entries);
          if (error) throw error;
        }
      }

      // Produção CAUQ
      if (tipoRdo === "CAUQ") {
        const trechoEntries = producaoCauq.trechos
          .filter(t => t.comprimento_m || t.largura_m || t.tipo_servico)
          .map(t => {
            const comp = t.comprimento_m ? parseFloat(String(t.comprimento_m).replace(",", ".")) : null;
            const larg = t.largura_m ? parseFloat(String(t.largura_m).replace(",", ".")) : null;
            const area = comp && larg ? Math.round(comp * larg * 100) / 100 : null;
            return {
              rdo_id: rdoId,
              tipo_servico: t.tipo_servico || null,
              sentido: t.sentido_faixa || null,
              faixa: t.sentido_faixa || null,
              sentido_faixa: t.sentido_faixa || null,
              estaca_inicial: t.estaca_inicial || null,
              estaca_final: t.estaca_final || null,
              km_inicial: t.estaca_inicial ? parseFloat(String(t.estaca_inicial).replace(",", ".")) : null,
              km_final: t.estaca_final ? parseFloat(String(t.estaca_final).replace(",", ".")) : null,
              comprimento_m: comp,
              largura_m: larg,
              espessura_cm: t.espessura_m ? parseFloat(t.espessura_m.replace(",", ".")) : null,
              area_m2: area,
              densidade: t.densidade ? parseFloat(t.densidade.replace(",", ".")) : null,
              volume_m3: area && t.espessura_m ? Math.round(area * parseFloat(t.espessura_m.replace(",", ".")) / 100 * 100) / 100 : null,
              tonelagem: (() => {
                const vol = area && t.espessura_m ? area * parseFloat(t.espessura_m.replace(",", ".")) / 100 : null;
                const dens = t.densidade ? parseFloat(t.densidade.replace(",", ".")) : null;
                return vol && dens ? Math.round(vol * dens * 100) / 100 : null;
              })(),
              observacoes: t.observacoes || null,
            };
          });
        if (trechoEntries.length > 0) {
          const { error } = await supabase.from("rdo_producao").insert(trechoEntries);
          if (error) throw error;
        }
      }

      // Equipamentos
      const equipEntries = isPatioRdo
        ? equipamentosPatio
            .filter(e => e.frota)
            .map(e => ({
              rdo_id: rdoId,
              frota: e.frota || null,
              categoria: "PATIO",
              sub_tipo: e.status_patio || null,
              tipo: e.tipo || null,
              nome: e.nome || null,
              patrimonio: null,
              empresa_dona: e.observacao || null,
            }))
        : equipamentos
            .filter(e => e.frota || e.nome || e.tipo)
            .map(e => ({
              rdo_id: rdoId,
              frota: e.frota || null,
              categoria: e.categoria || null,
              sub_tipo: e.subTipo || null,
              tipo: e.tipo || null,
              nome: e.nome || null,
              patrimonio: e.patrimonio || null,
              empresa_dona: e.empresa_dona || null,
            }));
      if (equipEntries.length > 0) {
        const { error } = await (supabase as any).from("rdo_equipamentos").insert(equipEntries);
        if (error) console.warn("Equipamentos RDO:", error.message);
      }

      // NF de Massa
      const nfEntries = nfMassa
        .filter(n => n.nf || n.placa || n.tonelagem)
        .map(n => ({
          rdo_id: rdoId,
          nf: n.nf || null,
          placa: n.placa || null,
          usina: n.usina || null,
          tonelagem: n.tonelagem ? parseFloat(n.tonelagem.replace(",", ".")) : null,
          tipo_material: n.tipo_material || n.tipo_material_outro || null,
        }));
      if (nfEntries.length > 0) {
        const { error } = await (supabase as any).from("rdo_nf_massa").insert(nfEntries);
        if (error) console.warn("NF Massa RDO:", error.message);
      }

      // Efetivo
      const efEntries = efetivo
        .filter(e => e.funcao)
        .map(e => ({
          rdo_id: rdoId,
          company_id: profile?.company_id || null,
          funcao: e.funcao,
          nome: e.nome || null,
          matricula: e.matricula || null,
          quantidade: 1,
          entrada: e.entrada || globalEntrada || null,
          saida: e.saida || globalSaida || null,
          // employee_id: só grava quando há 1 funcionário (sem |||)
          employee_id: e.employee_id && !(e.nome || "").includes("|||") ? e.employee_id : null,
        }));
      if (efEntries.length > 0) {
        const { error } = await supabase.from("rdo_efetivo").insert(efEntries);
        if (error) throw error;
      }

      // Efetivo Terceirizado
      const tercEntries = terceirizados
        .filter(t => t.empresa_id && t.funcionario_ids.length > 0)
        .flatMap(t => {
          const empresa = empresasTerceiras.find(e => e.id === t.empresa_id);
          return t.funcionario_ids.map(fid => {
            const func = funcionariosTerceiros.find(f => f.id === fid);
            return {
              rdo_id: rdoId,
              empresa_id: t.empresa_id,
              empresa_nome: empresa?.nome || "",
              funcionario_id: fid,
              funcionario_nome: func?.nome || "",
            };
          });
        });
      if (tercEntries.length > 0) {
        const { error } = await (supabase as any).from("rdo_efetivo_terceiros").insert(tercEntries);
        if (error) console.warn("Efetivo terceirizado:", error.message);
      }

      // Build HTML report and send email
      const htmlReport = buildHtmlReport(rdoId, header, tipoRdo, producaoCauq, nfMassa, efetivo, equipamentos, globalEntrada, globalSaida, { teveUsinagem, totalUsinado, atividadesCanteiro }, encarregado || preenchidoPor, tipoRdo === "PV" ? pvData : undefined);
      let emailSent = false;
      try {
        // Sending email
        const fmtDate = (d: string) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
        const rdoSubject = `RDO - ${header.obra_nome} - ${fmtDate(header.data)}`;
        const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-rdo-email", {
          body: { rdo_id: rdoId, html_report: htmlReport, subject: rdoSubject },
        });
        // Email response received

        if (emailError) {
          console.error("Email invoke error:", emailError);
        } else if (emailResult?.success) {
          emailSent = true;
          // Send push notifications to users who opted in for RDO notifications
          try {
            const { data: myProfile } = await supabase
              .from("profiles")
              .select("company_id")
              .eq("user_id", user?.id)
              .maybeSingle();
            const myCompanyId = (myProfile as any)?.company_id;

            if (myCompanyId) {
              const { data: prefs } = await (supabase as any)
                .from("notification_prefs")
                .select("user_id")
                .eq("company_id", myCompanyId)
                .eq("notify_rdo", true)
                .neq("user_id", user.id);

              const { data: targets } = await (supabase as any)
                .from("notification_targets")
                .select("target_user_id")
                .eq("source_user_id", user.id)
                .eq("company_id", myCompanyId)
                .eq("event_type", "rdo");

              const allTargetIds = new Set<string>([
                ...((prefs || []).map((p: any) => p.user_id).filter(Boolean)),
                ...((targets || []).map((t: any) => t.target_user_id).filter(Boolean)),
              ]);
              allTargetIds.delete(user.id);

              const fmtDatePush = (d: string) => {
                const [y, m, day] = d.split("-");
                return `${day}/${m}/${y}`;
              };
              const pushUrl = rdoId ? `/visualizar-rdo/${rdoId}` : "/obras";

              for (const userId of allTargetIds) {
                supabase.functions.invoke("send-push", {
                  body: {
                    user_id: userId,
                    title: "📋 Novo RDO enviado",
                    body: `${header.obra_nome} — ${fmtDatePush(header.data)}`,
                    url: pushUrl,
                  },
                }).catch(() => {});
              }
            }
          } catch {}
        } else {
          console.warn("Email response:", emailResult);
        }
      } catch (emailErr) {
        console.warn("Email send failed:", emailErr);
      }

      // Push de confirmação para o próprio apontador
      try {
        const pushUrl = rdoId ? `/visualizar-rdo/${rdoId}` : "/obras";
        const fmtDate = (d: string) => {
          const [y, m, day] = d.split("-");
          return `${day}/${m}/${y}`;
        };
        supabase.functions.invoke("send-push", {
          body: {
            user_id: user.id,
            title: "✅ RDO enviado com sucesso",
            body: `${header.obra_nome} — ${fmtDate(header.data)}`,
            url: pushUrl,
          },
        }).catch(() => {});
      } catch {}

      toast({
        title: emailSent ? "✅ RDO Salvo e E-mail Enviado!" : "✅ RDO Salvo!",
        description: emailSent
          ? "Relatório registrado e e-mail enviado com sucesso."
          : "Relatório registrado com sucesso.",
        action: (
          <button
            onClick={() => navigate(`/relatorios/rdo/${encodeURIComponent(header.obra_nome)}?ini=${header.data}&fim=${header.data}`)}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
          >
            Ver PDF / Exportar →
          </button>
        ),
      });
      if (showNavigate) navigate("/obras");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => handleSubmitInternal(true);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Gradient Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/obras")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <LogoHomeButton className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">RDO Digital</h1>
            <p className="text-xs text-white/70">Relatório Diário de Obra</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft || (!header.obra_nome && !isPatioRdo)}
            className="bg-white/15 border-white/30 text-white hover:bg-white/25 gap-1.5 text-xs font-bold rounded-lg"
          >
            <Save className="w-4 h-4" />
            {savingDraft ? "Salvando..." : "Rascunho"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-28 space-y-4 pt-4">

        {/* PASSO 1: Tipo de RDO — sempre primeiro */}
        <div className="px-4">
          <RdoTipoSelector value={tipoRdo} onChange={v => {
            setTipoRdo(v);
            if (v === "PATIO") handleHeaderChange("obra_nome", "BASE / PÁTIO CENTRAL");
          }} />
          {isEditMode && !tipoRdo && (
            <div className="mt-2 px-1 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              ⚠️ Selecione o tipo do RDO acima para visualizar e editar os dados carregados.
            </div>
          )}
        </div>

        {/* PASSO 2: Informações Gerais — oculto no Pátio Central e enquanto tipo não escolhido */}
        {tipoRdo && !isPatioRdo && (
          <div className="px-4">
            <RdoHeader data={header} onChange={handleHeaderChange} />
          </div>
        )}

        {/* Pátio: só data */}
        {isPatioRdo && (
          <div className="px-4">
            <div className="rdo-card space-y-3">
              <h2 className="rdo-section-title">📅 Data</h2>
              <input
                type="date"
                value={header.data}
                onChange={e => handleHeaderChange("data", e.target.value)}
                className="w-full h-12 rounded-xl border border-border bg-secondary px-3 text-base focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {tipoRdo && !isPatioRdo && isUnlockLoading && !isEditMode && (
          <div className="mx-4 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            Verificando prazo de lançamento...
          </div>
        )}

        {tipoRdo && !isPatioRdo && shouldBlockByDeadline ? (
          <div className="px-4">
            <PrazoExpiradoCard date={header.data} prazoLabel={prazoLabel} onBack={() => navigate(-1)} />
          </div>
        ) : (
          <>
            {/* Cancelou: justificativa + botão copiar dia anterior */}
            {!isPatioRdo && (header.status_obra === "Cancelou" || header.status_obra === "Folga") && (
              <div className="mx-4 rounded-xl border border-border bg-card p-4 space-y-3">
                {header.status_obra === "Cancelou" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo do Cancelamento *</label>
                    <textarea
                      value={motivoCancelamento}
                      onChange={e => setMotivoCancelamento(e.target.value)}
                      placeholder="Ex: Chuva intensa, quebra de usina, falta de material..."
                      className="w-full min-h-[80px] rounded-xl border border-border bg-secondary px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={copiarDiaAnterior}
                  disabled={!header.obra_nome || !header.data || !header.encarregado || copiandoDiaAnterior}
                  className="w-full h-11 rounded-xl border border-primary text-primary text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 disabled:opacity-40 transition-colors"
                >
                  {copiandoDiaAnterior ? "Copiando..." : "📅 Copiar equipamentos e efetivo do dia anterior"}
                </button>
                <p className="text-[11px] text-muted-foreground text-center">
                  {!header.encarregado ? "⚠️ Preencha o Encarregado para identificar a equipe" : "Copia do RDO anterior desta OGS + encarregado"}
                </p>
              </div>
            )}
            {/* placeholder para manter estrutura */}

            {tipoRdo === "INFRAESTRUTURA" && (
              <>
                <SectionInfraestrutura
                  empreiteiro={empreiteiro}
                  producao={infraProducao}
                  onChangeEmpreiteiro={setEmpreiteiro}
                  onChangeProducao={setInfraProducao}
                  tipoRdo="INFRA"
                />
                <SectionNfConcreto entries={nfConcreto} onChange={setNfConcreto} />
              </>
            )}

            {tipoRdo === "CAUQ" && (
              <>
                <SectionCauq entries={nfMassa} onChange={setNfMassa} tipoRdo="CAUQ" />
                <SectionProducaoCauq data={producaoCauq} onChange={setProducaoCauq} tipoRdo="CAUQ" nfEntries={nfMassa} />
              </>
            )}
            {tipoRdo === "CANTEIRO" && <SectionCanteiro entries={nfInsumos} onChange={setNfInsumos} tipoRdo="CANTEIRO" />}
            {tipoRdo === "PV" && <SectionPV data={pvData} onChange={setPvData} />}
            {/* SectionAeroPavGru removida — Drenagem & Terraplanagem sem seção de marmitas */}

            {tipoRdo && (
              <>
                {isPatioRdo ? (
                  <SectionEquipamentosPatio entries={equipamentosPatio} onChange={setEquipamentosPatio} />
                ) : (
                  <SectionEquipamentos entries={equipamentos} onChange={setEquipamentos} tipoRdo={tipoRdo === "INFRAESTRUTURA" ? "INFRA" : tipoRdo} />
                )}
                
                {!isPatioRdo && <StepEfetivo
                  entries={efetivo}
                  onChange={setEfetivo}
                  globalEntrada={globalEntrada}
                  globalSaida={globalSaida}
                  onChangeGlobalEntrada={setGlobalEntrada}
                  onChangeGlobalSaida={setGlobalSaida}
                  encarregado={header.encarregado}
                />}
                {!isPatioRdo && (
                  <SectionEfetivoTerceirizado
                    entries={terceirizados}
                    onChange={setTerceirizados}
                    empresas={empresasTerceiras}
                    funcionarios={funcionariosTerceiros}
                    loadingData={loadingTerceiros}
                  />
                )}
                {!isPatioRdo && tipoRdo === "CANTEIRO" && (
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
          </>
        )}
      </div>

      {!shouldBlockByDeadline && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border px-4 py-4 space-y-2 shadow-[0_-4px_20px_-4px_hsl(215_60%_50%/0.1)]">
          {(tipoRdo === "CAUQ" || tipoRdo === "PV" || tipoRdo === "AEROPAV") && (
            <Button
              type="button"
              onClick={handleWhatsAppResume}
              className="w-full h-12 text-base gap-2 font-semibold bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl"
            >
              <MessageCircle className="w-5 h-5" /> 📱 Gerar Resumo WhatsApp
            </Button>
          )}
          {tipoRdo === "PV" && (
            <Button
              type="button"
              onClick={handleSaveAndNewStreet}
              disabled={saving || !header.obra_nome || !header.turno}
              className="w-full h-12 text-base gap-2 font-semibold rounded-xl border-2 border-primary bg-white text-primary hover:bg-primary/5"
            >
              <RotateCw className="w-5 h-5" /> Salvar e Iniciar Nova Rua
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveDraft}
              disabled={savingDraft || (!header.obra_nome && !isPatioRdo)}
              variant="outline"
              className="flex-1 h-12 text-sm gap-2 font-display font-bold rounded-xl border-2 border-primary text-primary hover:bg-primary/5"
            >
              <Save className="w-4 h-4" /> {savingDraft ? "Salvando..." : "Salvar Rascunho"}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || (!isPatioRdo && (!header.obra_nome || !header.turno))}
              className="flex-1 h-12 text-sm gap-2 font-display font-bold rounded-xl bg-header-gradient hover:opacity-90 transition-opacity"
            >
              <Send className="w-4 h-4" /> {saving ? "Enviando..." : "Enviar RDO"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrazoExpiradoCard({
  date,
  prazoLabel,
  onBack,
}: {
  date: string;
  prazoLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-card">
      <h3 className="text-base font-display font-bold text-foreground">⏰ Prazo expirado</h3>
      <p className="text-sm text-muted-foreground">
        O prazo para lançar o diário do dia {formatDateBRShort(date)} foi encerrado.
      </p>
      <p className="text-xs text-muted-foreground">
        Prazo permitido: {prazoLabel}. Entre em contato com o administrador para liberar este lançamento.
      </p>
      <Button variant="outline" className="w-full" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}

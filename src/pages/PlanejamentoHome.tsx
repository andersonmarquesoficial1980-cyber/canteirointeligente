import { useEffect, useMemo, useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, RefreshCcw, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function toMoney(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Planejamento = {
  id: string;
  ogs: string;
  obra: string;
  cliente: string | null;
  orcamento_baseline_id: string | null;
  receita_atualizada: number;
  custo_realizado: number;
  custo_comprometido: number;
  previsao_a_executar: number;
  desvio_vs_baseline: number;
};

type OrcamentoBase = {
  id: string;
  ogs: string;
  obra: string;
  total_orcado: number;
};

type CustoRealizadoComponente = {
  componente: string;
  valor: number;
};

type NfResumo = {
  qtd_nf_massa: number;
  ton_massa: number;
  qtd_nf_concreto: number;
  m3_concreto: number;
};

type NotaUpload = {
  id: string;
  origem: string;
  numero_nf: string | null;
  fornecedor: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  arquivo_nome: string;
  storage_path: string;
  considerar_no_custo: boolean;
  created_at: string;
};

type OrcamentoResumoOgs = {
  orcamentoId: string | null;
  versao: number | null;
  custoPrevisto: number;
  custoNaoPrevisto: number;
};

type NaoPrevistoDetalhe = {
  categoria: string;
  referencia: string;
  descricao: string;
  motivo: string;
  total: number;
  quantidade: number;
  fatorAplicacao: number;
  unidade: string;
};

const ORCAMENTO_RESUMO_ZERO: OrcamentoResumoOgs = {
  orcamentoId: null,
  versao: null,
  custoPrevisto: 0,
  custoNaoPrevisto: 0,
};

const NF_RESUMO_ZERO: NfResumo = {
  qtd_nf_massa: 0,
  ton_massa: 0,
  qtd_nf_concreto: 0,
  m3_concreto: 0,
};

export default function PlanejamentoHome() {
  const goBack = useSmartBack("/");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [planejamentos, setPlanejamentos] = useState<Planejamento[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoBase[]>([]);

  const [idAtual, setIdAtual] = useState<string | null>(null);
  const [ogs, setOgs] = useState("");
  const [obra, setObra] = useState("");
  const [cliente, setCliente] = useState("");
  const [orcamentoBaselineId, setOrcamentoBaselineId] = useState<string>("");

  const [receitaAtualizada, setReceitaAtualizada] = useState(1000000);
  const [custoRealizado, setCustoRealizado] = useState(420000);
  const [custoComprometido, setCustoComprometido] = useState(180000);
  const [previsaoAExecutar, setPrevisaoAExecutar] = useState(360000);

  // Parâmetros para transformar NF (que vem sem valor) em custo financeiro
  const [precoMassaTon, setPrecoMassaTon] = useState(0);
  const [precoConcretoM3, setPrecoConcretoM3] = useState(0);

  const [nfResumo, setNfResumo] = useState<NfResumo>(NF_RESUMO_ZERO);
  const [custosAuto, setCustosAuto] = useState<CustoRealizadoComponente[]>([]);
  const [syncingCustos, setSyncingCustos] = useState(false);

  // Upload de notas vindas de e-mail/SEFAZ/outros
  const [notasUploads, setNotasUploads] = useState<NotaUpload[]>([]);
  const [uploadingNota, setUploadingNota] = useState(false);
  const [abrindoNotaId, setAbrindoNotaId] = useState<string | null>(null);
  const [fileNota, setFileNota] = useState<File | null>(null);
  const [origemNota, setOrigemNota] = useState("email");
  const [numeroNfNota, setNumeroNfNota] = useState("");
  const [fornecedorNota, setFornecedorNota] = useState("");
  const [dataEmissaoNota, setDataEmissaoNota] = useState("");
  const [valorNota, setValorNota] = useState("");
  const [orcamentoResumoOgs, setOrcamentoResumoOgs] = useState<OrcamentoResumoOgs>(ORCAMENTO_RESUMO_ZERO);
  const [itensNaoPrevistos, setItensNaoPrevistos] = useState<NaoPrevistoDetalhe[]>([]);

  const baselineSelecionado = useMemo(
    () => orcamentos.find((o) => o.id === orcamentoBaselineId) || null,
    [orcamentos, orcamentoBaselineId]
  );

  const baselineOrcamento = useMemo(() => Number(baselineSelecionado?.total_orcado || 0), [baselineSelecionado]);

  const saldoObra = useMemo(
    () => receitaAtualizada - (custoRealizado + custoComprometido),
    [receitaAtualizada, custoRealizado, custoComprometido]
  );

  const eac = useMemo(() => custoRealizado + previsaoAExecutar, [custoRealizado, previsaoAExecutar]);

  const desvio = useMemo(() => eac - baselineOrcamento, [eac, baselineOrcamento]);
  const impactoNaoPrevistoSaldo = useMemo(() => -Number(orcamentoResumoOgs.custoNaoPrevisto || 0), [orcamentoResumoOgs]);
  const impactoNaoPrevistoMargemPercent = useMemo(() => {
    const receita = Number(receitaAtualizada || 0);
    if (receita <= 0) return 0;
    return (Number(orcamentoResumoOgs.custoNaoPrevisto || 0) / receita) * 100;
  }, [orcamentoResumoOgs, receitaAtualizada]);

  useEffect(() => {
    inicializar();
  }, []);

  useEffect(() => {
    if (!companyId || !ogs.trim()) {
      setOrcamentoResumoOgs(ORCAMENTO_RESUMO_ZERO);
      setItensNaoPrevistos([]);
      return;
    }

    carregarResumoOrcamentoOgs(companyId, ogs, orcamentoBaselineId || null);
  }, [companyId, ogs, orcamentoBaselineId]);

  async function inicializar() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.company_id) {
      toast({ title: "Erro", description: "Não foi possível identificar a empresa do usuário.", variant: "destructive" });
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setCompanyId(profile.company_id);
    await Promise.all([carregarPlanejamentos(profile.company_id), carregarOrcamentos(profile.company_id)]);
    setLoading(false);
  }

  async function carregarPlanejamentos(company: string) {
    const { data, error } = await (supabase as any)
      .from("wf_planejamento_obras")
      .select("id, ogs, obra, cliente, orcamento_baseline_id, receita_atualizada, custo_realizado, custo_comprometido, previsao_a_executar, desvio_vs_baseline")
      .eq("company_id", company)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast({ title: "Erro ao carregar planejamentos", description: error.message, variant: "destructive" });
      return;
    }

    setPlanejamentos((data || []) as Planejamento[]);
  }

  async function carregarOrcamentos(company: string) {
    const { data, error } = await (supabase as any)
      .from("wf_orcamentos")
      .select("id, ogs, obra, total_orcado")
      .eq("company_id", company)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "Erro ao carregar orçamentos base", description: error.message, variant: "destructive" });
      return;
    }

    setOrcamentos((data || []) as OrcamentoBase[]);
  }

  async function carregarParametrosNf(company: string, ogsAlvo: string) {
    if (!ogsAlvo.trim()) {
      setPrecoMassaTon(0);
      setPrecoConcretoM3(0);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("wf_planejamento_parametros_ogs")
      .select("preco_massa_ton, preco_concreto_m3")
      .eq("company_id", company)
      .eq("ogs", ogsAlvo.trim())
      .maybeSingle();

    if (error) {
      toast({ title: "Erro ao carregar parâmetros de NF", description: error.message, variant: "destructive" });
      return;
    }

    setPrecoMassaTon(Number(data?.preco_massa_ton || 0));
    setPrecoConcretoM3(Number(data?.preco_concreto_m3 || 0));
  }

  async function carregarNfResumo(company: string, ogsAlvo: string): Promise<NfResumo> {
    if (!ogsAlvo.trim()) {
      setNfResumo(NF_RESUMO_ZERO);
      return NF_RESUMO_ZERO;
    }

    const { data, error } = await (supabase as any).rpc("wf_nf_resumo_por_ogs", {
      p_company_id: company,
      p_ogs: ogsAlvo.trim(),
    });

    if (error) {
      toast({ title: "Erro ao ler resumo de NF", description: error.message, variant: "destructive" });
      return NF_RESUMO_ZERO;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const resumo: NfResumo = {
      qtd_nf_massa: Number(row?.qtd_nf_massa || 0),
      ton_massa: Number(row?.ton_massa || 0),
      qtd_nf_concreto: Number(row?.qtd_nf_concreto || 0),
      m3_concreto: Number(row?.m3_concreto || 0),
    };

    setNfResumo(resumo);
    return resumo;
  }

  async function carregarNotasUpload(company: string, ogsAlvo: string) {
    if (!ogsAlvo.trim()) {
      setNotasUploads([]);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("wf_notas_fiscais_uploads")
      .select("id, origem, numero_nf, fornecedor, data_emissao, valor_total, arquivo_nome, storage_path, considerar_no_custo, created_at")
      .eq("company_id", company)
      .eq("ogs", ogsAlvo.trim())
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast({ title: "Erro ao carregar notas uploadadas", description: error.message, variant: "destructive" });
      return;
    }

    setNotasUploads((data || []) as NotaUpload[]);
  }

  async function carregarResumoOrcamentoOgs(company: string, ogsAlvo: string, orcamentoIdPreferencial?: string | null) {
    const ogsNormalizada = ogsAlvo.trim();
    if (!ogsNormalizada) {
      setOrcamentoResumoOgs(ORCAMENTO_RESUMO_ZERO);
      setItensNaoPrevistos([]);
      return;
    }

    let orcamentoId = (orcamentoIdPreferencial || "").trim() || null;
    let versao: number | null = null;

    if (orcamentoId) {
      const { data: headerById, error: headerByIdError } = await (supabase as any)
        .from("wf_orcamentos")
        .select("id, versao")
        .eq("id", orcamentoId)
        .eq("company_id", company)
        .maybeSingle();

      if (headerByIdError) {
        toast({ title: "Erro ao carregar baseline", description: headerByIdError.message, variant: "destructive" });
        return;
      }

      if (!headerById?.id) {
        orcamentoId = null;
      } else {
        versao = Number(headerById.versao || 0);
      }
    }

    if (!orcamentoId) {
      const { data: header, error: headerError } = await (supabase as any)
        .from("wf_orcamentos")
        .select("id, versao")
        .eq("company_id", company)
        .eq("ogs", ogsNormalizada)
        .order("versao", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (headerError) {
        toast({ title: "Erro ao localizar orçamento da OGS", description: headerError.message, variant: "destructive" });
        return;
      }

      if (!header?.id) {
        setOrcamentoResumoOgs(ORCAMENTO_RESUMO_ZERO);
        setItensNaoPrevistos([]);
        return;
      }

      orcamentoId = header.id;
      versao = Number(header.versao || 0);
    }

    const { data: itens, error: itensError } = await (supabase as any)
      .from("wf_orcamento_itens")
      .select("natureza, total, categoria, referencia, descricao, motivo_nao_previsto, quantidade, fator_aplicacao, unidade")
      .eq("company_id", company)
      .eq("orcamento_id", orcamentoId);

    if (itensError) {
      toast({ title: "Erro ao calcular previsto x não previsto", description: itensError.message, variant: "destructive" });
      return;
    }

    const rows = (itens || []) as Array<{
      natureza: string | null;
      total: number | null;
      categoria: string | null;
      referencia: string | null;
      descricao: string | null;
      motivo_nao_previsto: string | null;
      quantidade: number | null;
      fator_aplicacao: number | null;
      unidade: string | null;
    }>;
    const custoPrevisto = rows
      .filter((r) => (r.natureza || "previsto") !== "nao_previsto")
      .reduce((acc, r) => acc + Number(r.total || 0), 0);

    const custoNaoPrevisto = rows
      .filter((r) => r.natureza === "nao_previsto")
      .reduce((acc, r) => acc + Number(r.total || 0), 0);

    const detalhesNaoPrevistos: NaoPrevistoDetalhe[] = rows
      .filter((r) => r.natureza === "nao_previsto")
      .map((r) => ({
        categoria: r.categoria || "Outros",
        referencia: r.referencia || "Sem referência",
        descricao: r.descricao || "",
        motivo: r.motivo_nao_previsto || "Sem motivo informado",
        total: Number(r.total || 0),
        quantidade: Number(r.quantidade || 0),
        fatorAplicacao: Number(r.fator_aplicacao || 0),
        unidade: r.unidade || "un",
      }))
      .sort((a, b) => b.total - a.total);

    setItensNaoPrevistos(detalhesNaoPrevistos);

    setOrcamentoResumoOgs({
      orcamentoId,
      versao,
      custoPrevisto,
      custoNaoPrevisto,
    });
  }

  async function carregarContextoOgs(company: string, ogsAlvo: string, orcamentoIdRef?: string | null) {
    await Promise.all([
      carregarParametrosNf(company, ogsAlvo),
      carregarNfResumo(company, ogsAlvo),
      carregarNotasUpload(company, ogsAlvo),
      carregarResumoOrcamentoOgs(company, ogsAlvo, orcamentoIdRef),
    ]);
  }

  async function salvarParametrosNf(company: string, user: string, ogsAlvo: string) {
    if (!ogsAlvo.trim()) return;

    const { error } = await (supabase as any)
      .from("wf_planejamento_parametros_ogs")
      .upsert(
        {
          company_id: company,
          ogs: ogsAlvo.trim(),
          preco_massa_ton: Number(precoMassaTon) || 0,
          preco_concreto_m3: Number(precoConcretoM3) || 0,
          updated_by: user,
        },
        { onConflict: "company_id,ogs" }
      );

    if (error) {
      throw new Error(error.message || "Falha ao salvar parâmetros de NF");
    }
  }

  async function uploadNotaFiscal() {
    if (!companyId || !userId) return;

    if (!ogs.trim()) {
      toast({ title: "OGS obrigatória", description: "Preencha a OGS antes de enviar nota fiscal.", variant: "destructive" });
      return;
    }

    if (!fileNota) {
      toast({ title: "Arquivo obrigatório", description: "Selecione o arquivo da nota fiscal.", variant: "destructive" });
      return;
    }

    setUploadingNota(true);

    try {
      const safeName = fileNota.name.replace(/\s+/g, "_");
      const filePath = `wf-planejamento/${companyId}/${ogs.trim()}/${Date.now()}_${safeName}`;

      const { error: storageError } = await supabase.storage
        .from("notas_fiscais")
        .upload(filePath, fileNota, { upsert: false, contentType: fileNota.type || "application/octet-stream" });

      if (storageError) {
        throw new Error(storageError.message || "Falha no upload para storage");
      }

      const { error: insertError } = await (supabase as any)
        .from("wf_notas_fiscais_uploads")
        .insert({
          company_id: companyId,
          ogs: ogs.trim(),
          origem: origemNota,
          numero_nf: numeroNfNota.trim() || null,
          fornecedor: fornecedorNota.trim() || null,
          data_emissao: dataEmissaoNota || null,
          valor_total: valorNota.trim() ? Number(valorNota) : null,
          arquivo_nome: fileNota.name,
          storage_path: filePath,
          considerar_no_custo: true,
          uploaded_by: userId,
          updated_by: userId,
        });

      if (insertError) {
        throw new Error(insertError.message || "Falha ao gravar metadados da nota");
      }

      toast({ title: "Upload concluído", description: "Nota fiscal vinculada à OGS com sucesso." });

      setFileNota(null);
      setNumeroNfNota("");
      setFornecedorNota("");
      setDataEmissaoNota("");
      setValorNota("");

      await carregarNotasUpload(companyId, ogs.trim());
    } catch (err: any) {
      toast({ title: "Erro no upload da nota", description: err?.message || "Falha desconhecida", variant: "destructive" });
    } finally {
      setUploadingNota(false);
    }
  }

  async function abrirNotaUpload(item: NotaUpload) {
    setAbrindoNotaId(item.id);
    try {
      const { data, error } = await supabase.storage.from("notas_fiscais").createSignedUrl(item.storage_path, 60 * 10);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Não foi possível gerar link assinado da nota");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "Erro ao abrir arquivo", description: err?.message || "Falha ao gerar link da nota", variant: "destructive" });
    } finally {
      setAbrindoNotaId(null);
    }
  }

  function novoPlanejamento() {
    setIdAtual(null);
    setOgs("");
    setObra("");
    setCliente("");
    setOrcamentoBaselineId("");
    setReceitaAtualizada(1000000);
    setCustoRealizado(0);
    setCustoComprometido(0);
    setPrevisaoAExecutar(0);
    setPrecoMassaTon(0);
    setPrecoConcretoM3(0);
    setNfResumo(NF_RESUMO_ZERO);
    setCustosAuto([]);
    setNotasUploads([]);
    setOrcamentoResumoOgs(ORCAMENTO_RESUMO_ZERO);
    setItensNaoPrevistos([]);
  }

  async function abrirPlanejamento(p: Planejamento) {
    setIdAtual(p.id);
    setOgs(p.ogs || "");
    setObra(p.obra || "");
    setCliente(p.cliente || "");
    setOrcamentoBaselineId(p.orcamento_baseline_id || "");
    setReceitaAtualizada(Number(p.receita_atualizada || 0));
    setCustoRealizado(Number(p.custo_realizado || 0));
    setCustoComprometido(Number(p.custo_comprometido || 0));
    setPrevisaoAExecutar(Number(p.previsao_a_executar || 0));
    setCustosAuto([]);

    if (companyId) {
      await carregarContextoOgs(companyId, p.ogs || "", p.orcamento_baseline_id || null);
    }
  }

  async function atualizarCustosAutomaticos() {
    if (!companyId || !userId || !ogs.trim()) {
      toast({ title: "Informe a OGS", description: "Preencha a OGS para calcular custos automáticos.", variant: "destructive" });
      return;
    }

    setSyncingCustos(true);

    try {
      const resumo = await carregarNfResumo(companyId, ogs.trim());

      const faltaMassa = resumo.ton_massa > 0 && Number(precoMassaTon || 0) <= 0;
      const faltaConcreto = resumo.m3_concreto > 0 && Number(precoConcretoM3 || 0) <= 0;

      if (faltaMassa || faltaConcreto) {
        const msg = [
          faltaMassa ? `NF Massa detectada (${resumo.ton_massa.toFixed(2)} t) sem preço R$/ton.` : "",
          faltaConcreto ? `NF Concreto detectada (${resumo.m3_concreto.toFixed(2)} m³) sem preço R$/m³.` : "",
        ]
          .filter(Boolean)
          .join(" ");

        toast({
          title: "Parâmetros obrigatórios para recalcular",
          description: msg,
          variant: "destructive",
        });
        setSyncingCustos(false);
        return;
      }

      // Persiste parâmetros antes do cálculo
      await salvarParametrosNf(companyId, userId, ogs.trim());

      const { data, error } = await (supabase as any).rpc("wf_custos_realizados_por_ogs", {
        p_company_id: companyId,
        p_ogs: ogs.trim(),
      });

      if (error) {
        toast({ title: "Erro ao calcular custos", description: error.message, variant: "destructive" });
        setSyncingCustos(false);
        return;
      }

      const rows = (data || []) as CustoRealizadoComponente[];
      setCustosAuto(rows);
      const total = Number(rows.find((r) => r.componente === "total")?.valor || 0);
      setCustoRealizado(total);
      toast({ title: "Custos atualizados", description: `Custo realizado recalculado: ${toMoney(total)}` });
    } catch (err: any) {
      toast({ title: "Erro nos parâmetros de NF", description: err?.message || "Falha ao salvar parâmetros", variant: "destructive" });
    } finally {
      setSyncingCustos(false);
    }
  }

  async function salvarPlanejamento() {
    if (!companyId || !userId) return;

    if (!ogs.trim() || !obra.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha OGS e Obra.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      await salvarParametrosNf(companyId, userId, ogs.trim());

      const payload = {
        id: idAtual || undefined,
        company_id: companyId,
        ogs: ogs.trim(),
        obra: obra.trim(),
        cliente: cliente.trim() || null,
        orcamento_baseline_id: orcamentoBaselineId || null,
        receita_atualizada: Number(receitaAtualizada) || 0,
        custo_realizado: Number(custoRealizado) || 0,
        custo_comprometido: Number(custoComprometido) || 0,
        previsao_a_executar: Number(previsaoAExecutar) || 0,
        desvio_vs_baseline: Number(desvio) || 0,
        updated_by: userId,
        created_by: idAtual ? undefined : userId,
      };

      const { error } = await (supabase as any)
        .from("wf_planejamento_obras")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        toast({ title: "Erro ao salvar planejamento", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      await carregarPlanejamentos(companyId);
      toast({ title: "Planejamento salvo", description: "Conta da obra e parâmetros de NF atualizados." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Falha ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">WF Planejamento</h1>
          <p className="text-xs text-muted-foreground">Planejado x realizado, comprometido e saldo da obra</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contas de obra recentes</CardTitle>
            <Button variant="outline" onClick={novoPlanejamento}>Nova conta da obra</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {planejamentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta da obra salva ainda.</p>}
            {planejamentos.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirPlanejamento(p)}
                className={`w-full text-left border rounded-md px-3 py-2 hover:bg-muted/40 ${idAtual === p.id ? "border-primary" : ""}`}
              >
                <div className="text-sm font-semibold">OGS {p.ogs} • {p.obra}</div>
                <div className="text-xs text-muted-foreground">Cliente: {p.cliente || "-"}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Conta da obra</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="OGS"
              value={ogs}
              onChange={(e) => setOgs(e.target.value)}
              onBlur={() => companyId && carregarContextoOgs(companyId, ogs, orcamentoBaselineId || null)}
            />
            <Input placeholder="Obra" value={obra} onChange={(e) => setObra(e.target.value)} />
            <Input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={orcamentoBaselineId}
              onChange={(e) => setOrcamentoBaselineId(e.target.value)}
            >
              <option value="">Selecione orçamento baseline</option>
              {orcamentos.map((o) => (
                <option key={o.id} value={o.id}>
                  OGS {o.ogs} • {o.obra} • {toMoney(Number(o.total_orcado || 0))}
                </option>
              ))}
            </select>

            <Input type="number" value={receitaAtualizada} onChange={(e) => setReceitaAtualizada(Number(e.target.value || 0))} placeholder="Receita atualizada" />
            <Input type="number" value={custoRealizado} onChange={(e) => setCustoRealizado(Number(e.target.value || 0))} placeholder="Custo realizado" />
            <Input type="number" value={custoComprometido} onChange={(e) => setCustoComprometido(Number(e.target.value || 0))} placeholder="Custo comprometido" />
            <Input type="number" value={previsaoAExecutar} onChange={(e) => setPrevisaoAExecutar(Number(e.target.value || 0))} placeholder="Previsão a executar" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Parâmetros financeiros das NFs do RDO (por OGS)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              type="number"
              value={precoMassaTon}
              onChange={(e) => setPrecoMassaTon(Number(e.target.value || 0))}
              placeholder="Preço Massa (R$/ton)"
            />
            <Input
              type="number"
              value={precoConcretoM3}
              onChange={(e) => setPrecoConcretoM3(Number(e.target.value || 0))}
              placeholder="Preço Concreto (R$/m³)"
            />
          </CardContent>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            As NFs de massa e concreto vêm do RDO sem valor. Esses parâmetros transformam tonelagem/m³ em custo financeiro automático no saldo da obra.
          </CardContent>
          <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="border rounded-md px-3 py-2">
              <div className="text-xs text-muted-foreground">NF Massa (RDO)</div>
              <div className="font-semibold">{nfResumo.qtd_nf_massa} NF(s) • {nfResumo.ton_massa.toFixed(2)} t</div>
            </div>
            <div className="border rounded-md px-3 py-2">
              <div className="text-xs text-muted-foreground">NF Concreto (RDO)</div>
              <div className="font-semibold">{nfResumo.qtd_nf_concreto} NF(s) • {nfResumo.m3_concreto.toFixed(2)} m³</div>
            </div>
          </CardContent>
          {(nfResumo.ton_massa > 0 && precoMassaTon <= 0) || (nfResumo.m3_concreto > 0 && precoConcretoM3 <= 0) ? (
            <CardContent className="pt-0">
              <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>
                  Há NF(s) lançadas sem parâmetro financeiro. Defina preço por ton/m³ para permitir recálculo automático sem distorção.
                </span>
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Notas (Suprimentos / Financeiro / Fiscal)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={origemNota}
              onChange={(e) => setOrigemNota(e.target.value)}
            >
              <option value="email">Recebida por E-mail</option>
              <option value="sefaz">SEFAZ</option>
              <option value="orgao_emissor">Outro órgão emissor</option>
              <option value="outros">Outros</option>
            </select>
            <Input type="file" onChange={(e) => setFileNota(e.target.files?.[0] || null)} />
            <Input placeholder="Número da NF (opcional)" value={numeroNfNota} onChange={(e) => setNumeroNfNota(e.target.value)} />
            <Input placeholder="Fornecedor/Usina (opcional)" value={fornecedorNota} onChange={(e) => setFornecedorNota(e.target.value)} />
            <Input type="date" value={dataEmissaoNota} onChange={(e) => setDataEmissaoNota(e.target.value)} />
            <Input type="number" step="0.01" placeholder="Valor total da NF (R$)" value={valorNota} onChange={(e) => setValorNota(e.target.value)} />
          </CardContent>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Quando o valor for informado, a nota entra automaticamente no custo realizado como <b>nf_upload_financeiro</b> ao clicar em "Atualizar custos automáticos por OGS".
          </CardContent>
          <CardContent className="pt-0">
            <Button onClick={uploadNotaFiscal} disabled={uploadingNota || !ogs.trim()}>
              {uploadingNota ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar nota e vincular à OGS
            </Button>
          </CardContent>
          <CardContent className="space-y-2">
            {notasUploads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma nota uploadada para esta OGS ainda.</p>
            ) : (
              notasUploads.map((n) => (
                <div key={n.id} className="border rounded-md px-3 py-2 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="font-semibold">{n.arquivo_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.origem} • NF {n.numero_nf || "-"} • {n.fornecedor || "-"} • {n.valor_total != null ? toMoney(Number(n.valor_total)) : "sem valor"}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => abrirNotaUpload(n)} disabled={abrindoNotaId === n.id}>
                    {abrindoNotaId === n.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Abrir
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Button variant="outline" onClick={atualizarCustosAutomaticos} disabled={syncingCustos}>
              {syncingCustos ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              Atualizar custos automáticos por OGS
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Composição automática do Custo Realizado</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {custosAuto.length === 0 && (
              <p className="text-sm text-muted-foreground">Clique em "Atualizar custos automáticos por OGS" para carregar combustível, suprimentos, terceiros, medições e NFs estimadas.</p>
            )}
            {custosAuto.filter((c) => c.componente !== "total").map((c) => (
              <div key={c.componente} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span className="capitalize">{c.componente.replace(/_/g, " ")}</span>
                <span className="font-semibold">{toMoney(Number(c.valor || 0))}</span>
              </div>
            ))}
            {custosAuto.length > 0 && (
              <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-muted/40">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{toMoney(Number(custosAuto.find((c) => c.componente === "total")?.valor || 0))}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Impacto do Não Previsto (por OGS)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi title="Orçado Previsto" value={orcamentoResumoOgs.custoPrevisto} status="ok" />
            <Kpi title="Orçado Não Previsto" value={orcamentoResumoOgs.custoNaoPrevisto} status={orcamentoResumoOgs.custoNaoPrevisto > 0 ? "alert" : "ok"} />
            <Kpi title="Impacto no Saldo" value={impactoNaoPrevistoSaldo} status={impactoNaoPrevistoSaldo < 0 ? "alert" : "ok"} />
            <div className="rounded-md border px-3 py-2 bg-background">
              <div className="text-xs text-muted-foreground">Impacto na Margem</div>
              <div className={`text-2xl font-bold ${impactoNaoPrevistoMargemPercent > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {impactoNaoPrevistoMargemPercent.toFixed(2)}%
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Versão orçamento: {orcamentoResumoOgs.versao ?? "-"}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-2">
            <div className="text-xs text-muted-foreground">Detalhamento dos não previstos (top maiores custos)</div>
            {itensNaoPrevistos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem itens não previstos para esta OGS.</p>
            ) : (
              itensNaoPrevistos.slice(0, 12).map((item, idx) => (
                <div key={`${item.referencia}-${idx}`} className="border rounded-md px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{item.categoria} • {item.referencia}</div>
                    <div className="font-bold text-red-600">{toMoney(item.total)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.descricao || "Sem descrição"} • {item.quantidade} × {item.fatorAplicacao} {item.unidade}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Motivo: {item.motivo}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Kpi title="Baseline" value={baselineOrcamento} status="ok" />
          <Kpi title="Saldo da Obra" value={saldoObra} status={saldoObra < 0 ? "alert" : "ok"} />
          <Kpi title="EAC (estimativa final)" value={eac} status={desvio > 0 ? "alert" : "ok"} />
          <Kpi title="Desvio vs Baseline" value={desvio} status={desvio > 0 ? "alert" : "ok"} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <Button onClick={salvarPlanejamento} disabled={saving} className="w-full md:w-auto">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar conta da obra
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Kpi({ title, value, status }: { title: string; value: number; status: "ok" | "alert" }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${status === "alert" ? "text-red-600" : "text-emerald-600"}`}>
          {toMoney(value)}
        </div>
      </CardContent>
    </Card>
  );
}

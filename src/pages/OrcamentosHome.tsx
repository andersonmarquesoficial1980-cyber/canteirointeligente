import { useEffect, useMemo, useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CategoriaItem = "Mão de obra" | "Equipamentos" | "Transporte" | "Materiais" | "Terceiros" | "Outros";
type NaturezaItem = "previsto" | "nao_previsto";

type DetalhamentoCustos = {
  salario?: number;
  beneficios?: number;
  encargos?: number;
  adicionais?: number;
  locacao?: number;
  combustivel?: number;
  manutencao?: number;
  operador?: number;
  frete?: number;
  pedagio?: number;
  diaria?: number;
  motorista?: number;
  materiais?: number;
  terceiros?: number;
  outros?: number;
};

type OrcamentoItem = {
  id: string;
  categoria: CategoriaItem;
  referencia: string;
  descricao: string;
  natureza: NaturezaItem;
  motivoNaoPrevisto: string;
  quantidade: number;
  unidade: string;
  fatorAplicacao: number;
  unitario: number;
  detalhamento: DetalhamentoCustos;
};

type OrcamentoLista = {
  id: string;
  ogs: string;
  obra: string;
  cliente: string;
  versao: number;
  total_orcado: number;
  receita_proposta: number;
  created_at: string;
};

type OrcamentoItemRow = {
  id: string;
  categoria: string | null;
  referencia: string | null;
  descricao: string | null;
  natureza: string | null;
  motivo_nao_previsto: string | null;
  quantidade: number | null;
  unidade: string | null;
  fator_aplicacao: number | null;
  unitario: number | null;
  detalhamento: DetalhamentoCustos | null;
};

type CampoDetalhamento = {
  key: keyof DetalhamentoCustos;
  label: string;
};

const CATEGORIAS: CategoriaItem[] = ["Mão de obra", "Equipamentos", "Transporte", "Materiais", "Terceiros", "Outros"];
const FUNCOES_MAO_OBRA = ["Ajudante", "Operador", "Motorista", "Encarregado", "Rasteleiro", "Sinaleiro"];
const REFERENCIAS_EQUIPAMENTOS = ["Rolo compactador", "Vibroacabadora", "Fresadora", "Pá carregadeira", "Caminhão pipa"];
const REFERENCIAS_TRANSPORTE = ["Caminhão toco", "Carreta", "Bitrem", "Van", "Ônibus"];

function toMoney(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function novoItemDefault(): OrcamentoItem {
  return {
    id: crypto.randomUUID(),
    categoria: "Mão de obra",
    referencia: "Ajudante",
    descricao: "Equipe de execução",
    natureza: "previsto",
    motivoNaoPrevisto: "",
    quantidade: 5,
    unidade: "dia",
    fatorAplicacao: 22,
    unitario: 0,
    detalhamento: {
      salario: 95,
      beneficios: 35,
      encargos: 42,
      adicionais: 10,
    },
  };
}

function camposPorCategoria(categoria: CategoriaItem): CampoDetalhamento[] {
  if (categoria === "Mão de obra") {
    return [
      { key: "salario", label: "Salário (R$/dia)" },
      { key: "beneficios", label: "Benefícios (R$/dia)" },
      { key: "encargos", label: "Encargos (R$/dia)" },
      { key: "adicionais", label: "Adicionais (R$/dia)" },
    ];
  }

  if (categoria === "Equipamentos") {
    return [
      { key: "locacao", label: "Locação/Deprec. (R$/hora ou dia)" },
      { key: "combustivel", label: "Combustível (R$)" },
      { key: "manutencao", label: "Manutenção (R$)" },
      { key: "operador", label: "Operador (R$)" },
    ];
  }

  if (categoria === "Transporte") {
    return [
      { key: "frete", label: "Frete/caminhão (R$)" },
      { key: "motorista", label: "Motorista (R$)" },
      { key: "pedagio", label: "Pedágio (R$)" },
      { key: "diaria", label: "Diária/estadia (R$)" },
    ];
  }

  if (categoria === "Materiais") {
    return [{ key: "materiais", label: "Materiais (R$ unitário)" }];
  }

  if (categoria === "Terceiros") {
    return [{ key: "terceiros", label: "Serviço terceiro (R$ unitário)" }];
  }

  return [{ key: "outros", label: "Outros (R$ unitário)" }];
}

function calcularUnitarioPorDetalhe(item: OrcamentoItem): number {
  const campos = camposPorCategoria(item.categoria);
  return campos.reduce((acc, campo) => acc + (Number(item.detalhamento?.[campo.key]) || 0), 0);
}

function calcularTotalItem(item: OrcamentoItem): number {
  const unitario = Number(item.unitario) || 0;
  return (Number(item.quantidade) || 0) * (Number(item.fatorAplicacao) || 0) * unitario;
}

function placeholderReferencia(categoria: CategoriaItem) {
  if (categoria === "Mão de obra") return "Função (ex: Ajudante, Operador)";
  if (categoria === "Equipamentos") return "Equipamento (ex: Rolo BW)";
  if (categoria === "Transporte") return "Veículo/serviço (ex: Caminhão 3/4)";
  if (categoria === "Materiais") return "Material (ex: CAP 50/70)";
  if (categoria === "Terceiros") return "Fornecedor/serviço";
  return "Referência";
}

function sugestoesReferencia(categoria: CategoriaItem): string[] {
  if (categoria === "Mão de obra") return FUNCOES_MAO_OBRA;
  if (categoria === "Equipamentos") return REFERENCIAS_EQUIPAMENTOS;
  if (categoria === "Transporte") return REFERENCIAS_TRANSPORTE;
  return [];
}

export default function OrcamentosHome() {
  const goBack = useSmartBack("/");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [orcamentos, setOrcamentos] = useState<OrcamentoLista[]>([]);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);

  const [ogs, setOgs] = useState("");
  const [cliente, setCliente] = useState("");
  const [obra, setObra] = useState("");
  const [versao, setVersao] = useState<number>(1);
  const [receitaProposta, setReceitaProposta] = useState<number>(1000000);
  const [bdiPercentual, setBdiPercentual] = useState<number>(18);
  const [impostosPercentual, setImpostosPercentual] = useState<number>(6);
  const [contingenciaPercentual, setContingenciaPercentual] = useState<number>(3);

  const [itens, setItens] = useState<OrcamentoItem[]>([
    {
      id: "1",
      categoria: "Mão de obra",
      referencia: "Ajudante",
      descricao: "Equipe de execução principal",
      natureza: "previsto",
      motivoNaoPrevisto: "",
      quantidade: 5,
      unidade: "dia",
      fatorAplicacao: 22,
      unitario: 182,
      detalhamento: { salario: 95, beneficios: 35, encargos: 42, adicionais: 10 },
    },
    {
      id: "2",
      categoria: "Equipamentos",
      referencia: "Rolo compactador BW",
      descricao: "Compactação",
      natureza: "previsto",
      motivoNaoPrevisto: "",
      quantidade: 1,
      unidade: "hora",
      fatorAplicacao: 180,
      unitario: 165,
      detalhamento: { locacao: 90, combustivel: 40, manutencao: 20, operador: 15 },
    },
    {
      id: "3",
      categoria: "Transporte",
      referencia: "Caminhão toco",
      descricao: "Frete de material",
      natureza: "previsto",
      motivoNaoPrevisto: "",
      quantidade: 12,
      unidade: "viagem",
      fatorAplicacao: 1,
      unitario: 620,
      detalhamento: { frete: 430, motorista: 120, pedagio: 35, diaria: 35 },
    },
  ]);

  const custoPrevisto = useMemo(
    () => itens.filter((item) => item.natureza === "previsto").reduce((acc, item) => acc + calcularTotalItem(item), 0),
    [itens]
  );

  const custoNaoPrevisto = useMemo(
    () => itens.filter((item) => item.natureza === "nao_previsto").reduce((acc, item) => acc + calcularTotalItem(item), 0),
    [itens]
  );

  const custoDireto = useMemo(() => custoPrevisto + custoNaoPrevisto, [custoPrevisto, custoNaoPrevisto]);

  const impostos = useMemo(() => (custoDireto * (Number(impostosPercentual) || 0)) / 100, [custoDireto, impostosPercentual]);
  const contingencia = useMemo(() => (custoDireto * (Number(contingenciaPercentual) || 0)) / 100, [custoDireto, contingenciaPercentual]);
  const bdi = useMemo(() => (custoDireto * (Number(bdiPercentual) || 0)) / 100, [custoDireto, bdiPercentual]);
  const totalOrcado = useMemo(() => custoDireto + impostos + contingencia + bdi, [custoDireto, impostos, contingencia, bdi]);
  const margem = useMemo(() => (Number(receitaProposta) || 0) - totalOrcado, [receitaProposta, totalOrcado]);
  const margemPercentual = useMemo(() => {
    if (!receitaProposta) return 0;
    return (margem / receitaProposta) * 100;
  }, [margem, receitaProposta]);

  useEffect(() => {
    inicializar();
  }, []);

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
    await carregarLista(profile.company_id);
    setLoading(false);
  }

  async function carregarLista(company: string) {
    const { data, error } = await supabase
      .from("wf_orcamentos")
      .select("id, ogs, obra, cliente, versao, total_orcado, receita_proposta, created_at")
      .eq("company_id", company)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast({ title: "Erro ao carregar orçamentos", description: error.message, variant: "destructive" });
      return;
    }

    setOrcamentos(data || []);
  }

  async function carregarOrcamento(id: string) {
    if (!companyId) return;

    const { data: header, error: headerError } = await supabase
      .from("wf_orcamentos")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (headerError || !header) {
      toast({ title: "Erro ao carregar orçamento", description: headerError?.message || "Registro não encontrado.", variant: "destructive" });
      return;
    }

    const { data: itensDb, error: itensError } = await supabase
      .from("wf_orcamento_itens")
      .select("id, categoria, referencia, descricao, natureza, motivo_nao_previsto, quantidade, unidade, fator_aplicacao, unitario, detalhamento")
      .eq("orcamento_id", id)
      .eq("company_id", companyId)
      .order("ordem", { ascending: true });

    if (itensError) {
      toast({ title: "Erro ao carregar itens", description: itensError.message, variant: "destructive" });
      return;
    }

    setOrcamentoId(header.id);
    setOgs(header.ogs || "");
    setCliente(header.cliente || "");
    setObra(header.obra || "");
    setVersao(Number(header.versao || 1));
    setReceitaProposta(Number(header.receita_proposta || 0));
    setImpostosPercentual(Number(header.impostos_percentual || 0));
    setContingenciaPercentual(Number(header.contingencia_percentual || 0));
    setBdiPercentual(Number(header.bdi_percentual || 0));

    const itensRows = (itensDb || []) as unknown as OrcamentoItemRow[];
    const itensCarregados: OrcamentoItem[] = itensRows.map((i) => {
      const categoria = ((i.categoria || "Outros") as CategoriaItem) || "Outros";
      const detalhamento = (i.detalhamento || {}) as DetalhamentoCustos;
      const base: OrcamentoItem = {
        id: i.id,
        categoria,
        referencia: i.referencia || "",
        descricao: i.descricao || "",
        natureza: (i.natureza === "nao_previsto" ? "nao_previsto" : "previsto") as NaturezaItem,
        motivoNaoPrevisto: i.motivo_nao_previsto || "",
        quantidade: Number(i.quantidade || 0),
        unidade: i.unidade || "un",
        fatorAplicacao: Number(i.fator_aplicacao || 1),
        unitario: Number(i.unitario || 0),
        detalhamento,
      };

      const unitarioCalculado = calcularUnitarioPorDetalhe(base);
      return { ...base, unitario: unitarioCalculado > 0 ? unitarioCalculado : base.unitario };
    });

    setItens(itensCarregados.length > 0 ? itensCarregados : [novoItemDefault()]);
  }

  function novoOrcamento() {
    setOrcamentoId(null);
    setOgs("");
    setCliente("");
    setObra("");
    setVersao(1);
    setReceitaProposta(1000000);
    setImpostosPercentual(6);
    setContingenciaPercentual(3);
    setBdiPercentual(18);
    setItens([novoItemDefault()]);
  }

  async function salvarOrcamento() {
    if (!companyId || !userId) return;

    if (!ogs.trim() || !cliente.trim() || !obra.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha OGS, Cliente e Obra.", variant: "destructive" });
      return;
    }

    const semMotivo = itens.find((item) => item.natureza === "nao_previsto" && !item.motivoNaoPrevisto.trim());
    if (semMotivo) {
      toast({
        title: "Motivo obrigatório",
        description: `Informe o motivo do não previsto no item "${semMotivo.referencia || semMotivo.descricao || semMotivo.categoria}".`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const payload = {
      id: orcamentoId || undefined,
      company_id: companyId,
      ogs: ogs.trim(),
      cliente: cliente.trim(),
      obra: obra.trim(),
      versao: Number(versao) || 1,
      status: "rascunho",
      receita_proposta: Number(receitaProposta) || 0,
      impostos_percentual: Number(impostosPercentual) || 0,
      contingencia_percentual: Number(contingenciaPercentual) || 0,
      bdi_percentual: Number(bdiPercentual) || 0,
      custo_direto_total: custoDireto,
      impostos_total: impostos,
      contingencia_total: contingencia,
      bdi_total: bdi,
      total_orcado: totalOrcado,
      margem_prevista: margem,
      updated_by: userId,
      created_by: orcamentoId ? undefined : userId,
      observacoes: `previsto=${custoPrevisto.toFixed(2)};nao_previsto=${custoNaoPrevisto.toFixed(2)}`,
    };

    const { data: saved, error: saveError } = await supabase
      .from("wf_orcamentos")
      .upsert(payload, { onConflict: "id" })
      .select("id")
      .single();

    if (saveError || !saved?.id) {
      toast({ title: "Erro ao salvar orçamento", description: saveError?.message || "Falha ao salvar.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const saveId = saved.id as string;

    const { error: deleteError } = await supabase
      .from("wf_orcamento_itens")
      .delete()
      .eq("orcamento_id", saveId)
      .eq("company_id", companyId);

    if (deleteError) {
      toast({ title: "Erro ao atualizar itens", description: deleteError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const itensPayload = itens.map((item, idx) => {
      const unitario = calcularUnitarioPorDetalhe(item);
      return {
        company_id: companyId,
        orcamento_id: saveId,
        ordem: idx + 1,
        categoria: item.categoria || "Outros",
        referencia: item.referencia || "",
        descricao: item.descricao || "",
        natureza: item.natureza,
        motivo_nao_previsto: item.natureza === "nao_previsto" ? item.motivoNaoPrevisto.trim() : null,
        quantidade: Number(item.quantidade) || 0,
        unidade: item.unidade || "un",
        fator_aplicacao: Number(item.fatorAplicacao) || 1,
        unitario,
        detalhamento: item.detalhamento || {},
      };
    });

    if (itensPayload.length > 0) {
      const { error: itensSaveError } = await supabase.from("wf_orcamento_itens").insert(itensPayload);

      if (itensSaveError) {
        toast({ title: "Erro ao salvar itens", description: itensSaveError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    setOrcamentoId(saveId);
    await carregarLista(companyId);
    toast({ title: "Orçamento salvo", description: "Registro detalhado atualizado com sucesso." });
    setSaving(false);
  }

  function atualizarItem(id: string, patch: Partial<OrcamentoItem>) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        return { ...next, unitario: calcularUnitarioPorDetalhe(next) };
      })
    );
  }

  function atualizarDetalhamento(id: string, key: keyof DetalhamentoCustos, value: number) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          detalhamento: {
            ...(item.detalhamento || {}),
            [key]: Number(value) || 0,
          },
        };
        return { ...next, unitario: calcularUnitarioPorDetalhe(next) };
      })
    );
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItemDefault()]);
  }

  function removerItem(id: string) {
    setItens((prev) => prev.filter((item) => item.id !== id));
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
          <h1 className="text-lg font-bold">WF Orçamentos</h1>
          <p className="text-xs text-muted-foreground">Composição completa do valor final da obra</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Orçamentos recentes</CardTitle>
            <Button variant="outline" onClick={novoOrcamento}>Novo orçamento</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {orcamentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum orçamento salvo ainda.</p>}
            {orcamentos.map((o) => (
              <button
                key={o.id}
                onClick={() => carregarOrcamento(o.id)}
                className={`w-full text-left border rounded-md px-3 py-2 hover:bg-muted/40 ${orcamentoId === o.id ? "border-primary" : ""}`}
              >
                <div className="text-sm font-semibold">OGS {o.ogs} • {o.obra}</div>
                <div className="text-xs text-muted-foreground">
                  {o.cliente} • v{o.versao} • Total {toMoney(Number(o.total_orcado || 0))}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dados do orçamento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input placeholder="OGS (ex: 2566)" value={ogs} onChange={(e) => setOgs(e.target.value)} />
            <Input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <Input placeholder="Obra" value={obra} onChange={(e) => setObra(e.target.value)} />
            <Input type="number" placeholder="Versão" value={versao} onChange={(e) => setVersao(Number(e.target.value || 1))} />
            <Input type="number" placeholder="Receita proposta" value={receitaProposta} onChange={(e) => setReceitaProposta(Number(e.target.value || 0))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Composição detalhada por função/equipamento/transporte</CardTitle>
            <Button onClick={adicionarItem} size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar item</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {itens.map((item) => {
              const campos = camposPorCategoria(item.categoria);
              const total = calcularTotalItem(item);
              return (
                <div key={item.id} className="border rounded-lg p-3 bg-background space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <select
                      className="md:col-span-2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={item.categoria}
                      onChange={(e) => atualizarItem(item.id, { categoria: e.target.value as CategoriaItem, unitario: 0, detalhamento: {} })}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <div className="md:col-span-3 space-y-1">
                      <div className="text-[11px] text-muted-foreground">Função/Referência</div>
                      <Input
                        list={`referencias-${item.id}`}
                        placeholder={placeholderReferencia(item.categoria)}
                        value={item.referencia}
                        onChange={(e) => atualizarItem(item.id, { referencia: e.target.value })}
                      />
                      <datalist id={`referencias-${item.id}`}>
                        {sugestoesReferencia(item.categoria).map((op) => (
                          <option key={op} value={op} />
                        ))}
                      </datalist>
                    </div>

                    <Input
                      className="md:col-span-3"
                      placeholder="Descrição"
                      value={item.descricao}
                      onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })}
                    />

                    <select
                      className="md:col-span-2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={item.natureza}
                      onChange={(e) => atualizarItem(item.id, { natureza: e.target.value as NaturezaItem })}
                    >
                      <option value="previsto">Previsto</option>
                      <option value="nao_previsto">Não previsto</option>
                    </select>

                    <div className="md:col-span-1 text-right text-xs text-muted-foreground">{toMoney(total)}</div>
                    <div className="md:col-span-1 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {item.natureza === "nao_previsto" && (
                    <Input
                      placeholder="Motivo obrigatório do não previsto (ex: caminhão extra solicitado por suprimentos)"
                      value={item.motivoNaoPrevisto}
                      onChange={(e) => atualizarItem(item.id, { motivoNaoPrevisto: e.target.value })}
                    />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {campos.map((campo) => (
                      <div key={campo.key} className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">{campo.label}</div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={Number(item.detalhamento?.[campo.key] || 0)}
                          onChange={(e) => atualizarDetalhamento(item.id, campo.key, Number(e.target.value || 0))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">
                        {item.categoria === "Mão de obra" ? "Qtd da função" : "Quantidade"}
                      </div>
                      <Input
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(item.id, { quantidade: Number(e.target.value || 0) })}
                        placeholder={item.categoria === "Mão de obra" ? "Ex: 5 ajudantes" : "Quantidade"}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">Unidade</div>
                      <Input
                        value={item.unidade}
                        onChange={(e) => atualizarItem(item.id, { unidade: e.target.value })}
                        placeholder="dia/hora/viagem"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">Período (dias/horas/viagens)</div>
                      <Input
                        type="number"
                        value={item.fatorAplicacao}
                        onChange={(e) => atualizarItem(item.id, { fatorAplicacao: Number(e.target.value || 0) })}
                        placeholder="Ex: 22"
                      />
                    </div>

                    <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
                      <div className="text-xs text-muted-foreground">Custo unitário</div>
                      <div className="font-semibold">{toMoney(item.unitario)}</div>
                    </div>
                    <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
                      <div className="text-xs text-muted-foreground">Total do item</div>
                      <div className="font-bold">{toMoney(total)}</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    Fórmula: custo unitário × quantidade × período = total do item.
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fechamento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input type="number" value={impostosPercentual} onChange={(e) => setImpostosPercentual(Number(e.target.value || 0))} placeholder="Impostos %" />
            <Input type="number" value={contingenciaPercentual} onChange={(e) => setContingenciaPercentual(Number(e.target.value || 0))} placeholder="Contingência %" />
            <Input type="number" value={bdiPercentual} onChange={(e) => setBdiPercentual(Number(e.target.value || 0))} placeholder="BDI %" />
            <div className="rounded-md border px-3 py-2 text-sm bg-muted/40">
              <div className="text-muted-foreground">Total Orçado</div>
              <div className="font-bold">{toMoney(totalOrcado)}</div>
            </div>
          </CardContent>
          <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-0">
            <Resumo label="Previsto" valor={custoPrevisto} />
            <Resumo label="Não previsto" valor={custoNaoPrevisto} destaque={custoNaoPrevisto > 0 ? "negativo" : undefined} />
            <Resumo label="Custo Direto" valor={custoDireto} />
            <Resumo label="Impostos" valor={impostos} />
            <Resumo label="BDI" valor={bdi} />
            <Resumo label="Margem" valor={margem} destaque={margem < 0 ? "negativo" : "positivo"} sublabel={`${margemPercentual.toFixed(2)}% da receita`} />
          </CardContent>
          <CardContent className="pt-0">
            <Button onClick={salvarOrcamento} disabled={saving} className="w-full md:w-auto">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar orçamento
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Resumo({ label, valor, destaque, sublabel }: { label: string; valor: number; destaque?: "positivo" | "negativo"; sublabel?: string }) {
  return (
    <div className="rounded-md border px-3 py-2 bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-bold ${destaque === "negativo" ? "text-red-600" : destaque === "positivo" ? "text-green-600" : ""}`}>
        {toMoney(valor)}
      </div>
      {sublabel ? <div className="text-[11px] text-muted-foreground mt-1">{sublabel}</div> : null}
    </div>
  );
}

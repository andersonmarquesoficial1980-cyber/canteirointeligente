import { useEffect, useMemo, useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type OrcamentoItem = {
  id: string;
  categoria: string;
  descricao: string;
  quantidade: number;
  unitario: number;
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

function toMoney(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function novoItemDefault(): OrcamentoItem {
  return {
    id: crypto.randomUUID(),
    categoria: "Outros",
    descricao: "Novo item",
    quantidade: 1,
    unitario: 0,
  };
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
    { id: "1", categoria: "Mão de obra", descricao: "Equipe de execução", quantidade: 1, unitario: 180000 },
    { id: "2", categoria: "Materiais", descricao: "CAP + agregados + itens de consumo", quantidade: 1, unitario: 260000 },
    { id: "3", categoria: "Equipamentos", descricao: "Máquinas próprias/locadas", quantidade: 1, unitario: 210000 },
    { id: "4", categoria: "Transporte", descricao: "Pessoal + materiais + equipamentos", quantidade: 1, unitario: 90000 },
  ]);

  const custoDireto = useMemo(
    () => itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0) * (Number(item.unitario) || 0), 0),
    [itens]
  );

  const impostos = useMemo(() => (custoDireto * (Number(impostosPercentual) || 0)) / 100, [custoDireto, impostosPercentual]);
  const contingencia = useMemo(() => (custoDireto * (Number(contingenciaPercentual) || 0)) / 100, [custoDireto, contingenciaPercentual]);
  const bdi = useMemo(() => (custoDireto * (Number(bdiPercentual) || 0)) / 100, [custoDireto, bdiPercentual]);
  const totalOrcado = useMemo(() => custoDireto + impostos + contingencia + bdi, [custoDireto, impostos, contingencia, bdi]);
  const margem = useMemo(() => (Number(receitaProposta) || 0) - totalOrcado, [receitaProposta, totalOrcado]);

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
    const { data, error } = await (supabase as any)
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

    const { data: header, error: headerError } = await (supabase as any)
      .from("wf_orcamentos")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (headerError || !header) {
      toast({ title: "Erro ao carregar orçamento", description: headerError?.message || "Registro não encontrado.", variant: "destructive" });
      return;
    }

    const { data: itensDb, error: itensError } = await (supabase as any)
      .from("wf_orcamento_itens")
      .select("id, categoria, descricao, quantidade, unitario")
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
    setItens(
      (itensDb || []).map((i: any) => ({
        id: i.id,
        categoria: i.categoria || "Outros",
        descricao: i.descricao || "",
        quantidade: Number(i.quantidade || 0),
        unitario: Number(i.unitario || 0),
      }))
    );
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
    };

    const { data: saved, error: saveError } = await (supabase as any)
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

    const { error: deleteError } = await (supabase as any)
      .from("wf_orcamento_itens")
      .delete()
      .eq("orcamento_id", saveId)
      .eq("company_id", companyId);

    if (deleteError) {
      toast({ title: "Erro ao atualizar itens", description: deleteError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const itensPayload = itens.map((item, idx) => ({
      company_id: companyId,
      orcamento_id: saveId,
      ordem: idx + 1,
      categoria: item.categoria || "Outros",
      descricao: item.descricao || "",
      quantidade: Number(item.quantidade) || 0,
      unitario: Number(item.unitario) || 0,
    }));

    if (itensPayload.length > 0) {
      const { error: itensSaveError } = await (supabase as any)
        .from("wf_orcamento_itens")
        .insert(itensPayload);

      if (itensSaveError) {
        toast({ title: "Erro ao salvar itens", description: itensSaveError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    setOrcamentoId(saveId);
    await carregarLista(companyId);
    toast({ title: "Orçamento salvo", description: "Registro atualizado com sucesso." });
    setSaving(false);
  }

  function atualizarItem(id: string, patch: Partial<OrcamentoItem>) {
    setItens((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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
            <CardTitle>Composição detalhada</CardTitle>
            <Button onClick={adicionarItem} size="sm"><Plus className="w-4 h-4 mr-2" />Adicionar item</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {itens.map((item) => {
              const total = (Number(item.quantidade) || 0) * (Number(item.unitario) || 0);
              return (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2 bg-background">
                  <Input className="col-span-12 md:col-span-2" value={item.categoria} onChange={(e) => atualizarItem(item.id, { categoria: e.target.value })} />
                  <Input className="col-span-12 md:col-span-5" value={item.descricao} onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })} />
                  <Input className="col-span-6 md:col-span-1" type="number" value={item.quantidade} onChange={(e) => atualizarItem(item.id, { quantidade: Number(e.target.value || 0) })} />
                  <Input className="col-span-6 md:col-span-2" type="number" value={item.unitario} onChange={(e) => atualizarItem(item.id, { unitario: Number(e.target.value || 0) })} />
                  <div className="col-span-10 md:col-span-1 text-sm font-semibold text-right">{toMoney(total)}</div>
                  <div className="col-span-2 md:col-span-1 text-right">
                    <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
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
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-0">
            <Resumo label="Custo Direto" valor={custoDireto} />
            <Resumo label="Impostos" valor={impostos} />
            <Resumo label="Contingência" valor={contingencia} />
            <Resumo label="BDI" valor={bdi} />
            <Resumo label="Margem" valor={margem} destaque={margem < 0 ? "negativo" : "positivo"} />
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

function Resumo({ label, valor, destaque }: { label: string; valor: number; destaque?: "positivo" | "negativo" }) {
  return (
    <div className="rounded-md border px-3 py-2 bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-bold ${destaque === "negativo" ? "text-red-600" : destaque === "positivo" ? "text-green-600" : ""}`}>
        {toMoney(valor)}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEquipamentoTipos } from "@/hooks/useEquipamentoTipos";
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
  _sugestao_unitario?: number;
  _sugestao_competencia?: string;
  _sugestao_equipe?: string;
  _sugestao_funcao_base?: string;
  _override_manual?: boolean;
  [key: string]: number | string | boolean | undefined;
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

type CustoFuncionarioMensal = {
  employee_id: string;
  competencia: string;
  equipe: string | null;
  salario: number | null;
  total_encargos: number | null;
  assistencia_medica: number | null;
  seguro_vida: number | null;
  vale_refeicao: number | null;
  totalpass: number | null;
  role?: string;
};

type FuncionarioRole = {
  id: string;
  role: string | null;
};

type CustoFuncaoAgregado = {
  funcaoBase: string;
  funcaoLabel: string;
  equipe: string;
  qtd: number;
  salarioDia: number;
  beneficiosDia: number;
  encargosDia: number;
  unitarioDia: number;
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
const FUNCOES_MAO_OBRA = ["Ajudante Geral", "Operador", "Motorista", "Encarregado", "Rasteleiro", "Sinaleiro"];
const REFERENCIAS_TRANSPORTE = ["Caminhão toco", "Carreta", "Bitrem", "Van", "Ônibus"];

function toMoney(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function novoItemDefault(): OrcamentoItem {
  return {
    id: crypto.randomUUID(),
    categoria: "Mão de obra",
    referencia: "",
    descricao: "",
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

function unidadePadraoPorCategoria(categoria: CategoriaItem): string {
  if (categoria === "Mão de obra") return "dia";
  if (categoria === "Equipamentos") return "hora";
  if (categoria === "Transporte") return "viagem";
  return "un";
}

function normalizarFuncaoMaoDeObra(referencia: string): string {
  const valor = String(referencia || "").trim();
  if (!valor) return "";
  if (valor.toLowerCase() === "ajudante") return "Ajudante Geral";
  return valor;
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
  if (categoria === "Transporte") return REFERENCIAS_TRANSPORTE;
  return [];
}

function normalizarTexto(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarFuncaoBase(valor: string): string {
  const n = normalizarTexto(valor);
  if (!n) return "";
  return n
    .replace(/\bSR\b|\bPL\b|\bESP\b|\bJR\b/g, "")
    .replace(/\bI\b|\bII\b|\bIII\b|\bIV\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function OrcamentosHome() {
  const goBack = useSmartBack("/");
  const { toast } = useToast();
  const { tiposFlat: tiposEquipamentosFlat } = useEquipamentoTipos();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [funcoesCadastro, setFuncoesCadastro] = useState<string[]>([]);
  const [custosMdo, setCustosMdo] = useState<CustoFuncionarioMensal[]>([]);
  const [competenciaCusto, setCompetenciaCusto] = useState<string>("");
  const [equipeCustoFiltro, setEquipeCustoFiltro] = useState<string>("TODAS");
  const [diasBaseMensal, setDiasBaseMensal] = useState<number>(22);

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

  const [itens, setItens] = useState<OrcamentoItem[]>([novoItemDefault()]);

  const referenciasEquipamentos = useMemo(() => {
    const labels = (tiposEquipamentosFlat || []).map((t) => String(t.label || "").trim()).filter(Boolean);
    return Array.from(new Set(labels));
  }, [tiposEquipamentosFlat]);

  const competenciasDisponiveis = useMemo(() => {
    const list = Array.from(new Set((custosMdo || []).map((c) => String(c.competencia || "")).filter(Boolean)));
    return list.sort((a, b) => b.localeCompare(a));
  }, [custosMdo]);

  const equipesDisponiveis = useMemo(() => {
    const base = (custosMdo || []).filter((c) => (competenciaCusto ? c.competencia === competenciaCusto : true));
    const list = Array.from(new Set(base.map((c) => String(c.equipe || "SEM_EQUIPE")).filter(Boolean)));
    return ["TODAS", ...list.sort((a, b) => a.localeCompare(b))];
  }, [custosMdo, competenciaCusto]);

  const custosMaoDeObraAgregados = useMemo(() => {
    const mapa = new Map<string, CustoFuncaoAgregado>();

    (custosMdo || [])
      .filter((c) => (competenciaCusto ? c.competencia === competenciaCusto : true))
      .filter((c) => (equipeCustoFiltro === "TODAS" ? true : (c.equipe || "SEM_EQUIPE") === equipeCustoFiltro))
      .forEach((c) => {
        const role = String(c.role || "").trim();
        const funcaoBase = normalizarFuncaoBase(role);
        if (!funcaoBase) return;

        const equipe = String(c.equipe || "SEM_EQUIPE").trim() || "SEM_EQUIPE";
        const key = `${funcaoBase}__${equipeCustoFiltro === "TODAS" ? "TODAS" : equipe}`;

        const atual = mapa.get(key) || {
          funcaoBase,
          funcaoLabel: role,
          equipe,
          qtd: 0,
          salarioDia: 0,
          beneficiosDia: 0,
          encargosDia: 0,
          unitarioDia: 0,
        };

        const salarioDia = (Number(c.salario || 0) || 0) / Math.max(Number(diasBaseMensal) || 22, 1);
        const beneficiosDia =
          ((Number(c.assistencia_medica || 0) || 0) +
            (Number(c.seguro_vida || 0) || 0) +
            (Number(c.vale_refeicao || 0) || 0) +
            (Number(c.totalpass || 0) || 0)) /
          Math.max(Number(diasBaseMensal) || 22, 1);
        const encargosDia = (Number(c.total_encargos || 0) || 0) / Math.max(Number(diasBaseMensal) || 22, 1);

        atual.qtd += 1;
        atual.salarioDia += salarioDia;
        atual.beneficiosDia += beneficiosDia;
        atual.encargosDia += encargosDia;
        atual.unitarioDia += salarioDia + beneficiosDia + encargosDia;

        mapa.set(key, atual);
      });

    return Array.from(mapa.values())
      .map((x) => ({
        ...x,
        salarioDia: x.qtd > 0 ? x.salarioDia / x.qtd : 0,
        beneficiosDia: x.qtd > 0 ? x.beneficiosDia / x.qtd : 0,
        encargosDia: x.qtd > 0 ? x.encargosDia / x.qtd : 0,
        unitarioDia: x.qtd > 0 ? x.unitarioDia / x.qtd : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [custosMdo, competenciaCusto, equipeCustoFiltro, diasBaseMensal]);

  const funcoesMdoOpcoes = useMemo(() => {
    const doCadastro = funcoesCadastro.length > 0 ? funcoesCadastro : FUNCOES_MAO_OBRA;
    const daBaseCusto = custosMaoDeObraAgregados.map((c) => c.funcaoLabel).filter(Boolean);
    return Array.from(new Set([...doCadastro, ...daBaseCusto]));
  }, [funcoesCadastro, custosMaoDeObraAgregados]);

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

  const resumoPorFuncao = useMemo(() => {
    const mapa = new Map<string, { funcao: string; quantidade: number; total: number }>();

    itens
      .filter((item) => item.categoria === "Mão de obra")
      .forEach((item) => {
        const funcao = (item.referencia || "Sem função").trim() || "Sem função";
        const atual = mapa.get(funcao) || { funcao, quantidade: 0, total: 0 };
        atual.quantidade += Number(item.quantidade || 0);
        atual.total += calcularTotalItem(item);
        mapa.set(funcao, atual);
      });

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [itens]);

  const resumoGeralEquipe = useMemo(() => {
    const totalPessoas = resumoPorFuncao.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
    const custoTotalMaoDeObra = resumoPorFuncao.reduce((acc, r) => acc + Number(r.total || 0), 0);
    const qtdFuncoes = resumoPorFuncao.length;
    const custoMedioPorFuncao = qtdFuncoes > 0 ? custoTotalMaoDeObra / qtdFuncoes : 0;

    return {
      totalPessoas,
      custoTotalMaoDeObra,
      qtdFuncoes,
      custoMedioPorFuncao,
    };
  }, [resumoPorFuncao]);

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
    await Promise.all([carregarLista(profile.company_id), carregarFuncoes(profile.company_id), carregarCustosMdo(profile.company_id)]);
    setLoading(false);
  }

  async function carregarFuncoes(company: string) {
    const { data, error } = await (supabase as any)
      .from("funcoes")
      .select("nome")
      .eq("company_id", company)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      toast({ title: "Aviso", description: "Não foi possível carregar cadastro de funções. Usando sugestões padrão.", variant: "destructive" });
      return;
    }

    const nomes = (data || [])
      .map((f: any) => String(f?.nome || "").trim())
      .filter((n: string) => n.length > 0);

    setFuncoesCadastro(nomes);
  }

  async function carregarCustosMdo(company: string) {
    const { data: custos, error: custosError } = await (supabase as any)
      .from("wf_custo_funcionario_mensal")
      .select("employee_id, competencia, equipe, salario, total_encargos, assistencia_medica, seguro_vida, vale_refeicao, totalpass")
      .eq("company_id", company)
      .order("competencia", { ascending: false })
      .limit(5000);

    if (custosError) {
      toast({ title: "Aviso", description: "Não foi possível carregar base de custos MDO.", variant: "destructive" });
      return;
    }

    const rows = (custos || []) as CustoFuncionarioMensal[];
    if (rows.length === 0) {
      setCustosMdo([]);
      setCompetenciaCusto("");
      return;
    }

    const employeeIds = Array.from(new Set(rows.map((r) => String(r.employee_id || "")).filter(Boolean)));
    let rolesMap = new Map<string, string>();

    if (employeeIds.length > 0) {
      const { data: emps, error: empsError } = await (supabase as any)
        .from("employees")
        .select("id, role")
        .in("id", employeeIds)
        .eq("company_id", company);

      if (!empsError) {
        const empRows = (emps || []) as FuncionarioRole[];
        rolesMap = new Map(empRows.map((e) => [String(e.id), String(e.role || "")]));
      }
    }

    const merged = rows.map((r) => ({
      ...r,
      role: rolesMap.get(String(r.employee_id || "")) || "",
    }));

    setCustosMdo(merged);
    const compAtual = merged[0]?.competencia ? String(merged[0].competencia) : "";
    setCompetenciaCusto((old) => old || compAtual);
  }

  function buscarSugestaoMaoDeObra(referencia: string): CustoFuncaoAgregado | null {
    const base = normalizarFuncaoBase(referencia);
    if (!base) return null;

    const candidatos = custosMaoDeObraAgregados.filter((c) => c.funcaoBase === base);
    if (candidatos.length === 0) return null;

    return candidatos.sort((a, b) => b.qtd - a.qtd)[0] || null;
  }

  function aplicarSugestaoMaoDeObra(itemId: string, referencia: string) {
    const sugestao = buscarSugestaoMaoDeObra(referencia);

    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (item.categoria !== "Mão de obra") return { ...item, referencia };

        if (!sugestao) {
          return { ...item, referencia };
        }

        const detalhamento: DetalhamentoCustos = {
          ...(item.detalhamento || {}),
          salario: Number(sugestao.salarioDia.toFixed(2)),
          beneficios: Number(sugestao.beneficiosDia.toFixed(2)),
          encargos: Number(sugestao.encargosDia.toFixed(2)),
          adicionais: Number(item.detalhamento?.adicionais || 0),
          _sugestao_unitario: Number(sugestao.unitarioDia.toFixed(2)),
          _sugestao_competencia: competenciaCusto,
          _sugestao_equipe: equipeCustoFiltro,
          _sugestao_funcao_base: sugestao.funcaoBase,
          _override_manual: false,
        };

        const next = {
          ...item,
          referencia,
          detalhamento,
        };

        return { ...next, unitario: calcularUnitarioPorDetalhe(next) };
      })
    );
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
        referencia: categoria === "Mão de obra" ? normalizarFuncaoMaoDeObra(i.referencia || "") : (i.referencia || ""),
        descricao: i.descricao || "",
        natureza: (i.natureza === "nao_previsto" ? "nao_previsto" : "previsto") as NaturezaItem,
        motivoNaoPrevisto: i.motivo_nao_previsto || "",
        quantidade: Number(i.quantidade || 0),
        unidade: i.unidade || unidadePadraoPorCategoria(categoria),
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

    const semFuncao = itens.find((item) => item.categoria === "Mão de obra" && !String(item.referencia || "").trim());
    if (semFuncao) {
      toast({
        title: "Função obrigatória",
        description: "Selecione a função em todos os itens de Mão de obra antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const semTipoEquipamento = itens.find((item) => item.categoria === "Equipamentos" && !String(item.referencia || "").trim());
    if (semTipoEquipamento) {
      toast({
        title: "Tipo de equipamento obrigatório",
        description: "Selecione o Tipo de Equipamento em todos os itens da categoria Equipamentos antes de salvar.",
        variant: "destructive",
      });
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
      const sugestaoUnitario = Number(item.detalhamento?._sugestao_unitario || 0);
      const overrideManual = item.categoria === "Mão de obra" && sugestaoUnitario > 0 ? Math.abs(unitario - sugestaoUnitario) > 0.01 : false;
      const detalhamentoPayload = {
        ...(item.detalhamento || {}),
        _sugestao_unitario: sugestaoUnitario > 0 ? sugestaoUnitario : undefined,
        _sugestao_competencia: item.detalhamento?._sugestao_competencia || undefined,
        _sugestao_equipe: item.detalhamento?._sugestao_equipe || undefined,
        _sugestao_funcao_base: item.detalhamento?._sugestao_funcao_base || undefined,
        _override_manual: overrideManual,
      };

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
        unidade: unidadePadraoPorCategoria(item.categoria),
        fator_aplicacao: Number(item.fatorAplicacao) || 1,
        unitario,
        detalhamento: detalhamentoPayload,
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

        const unitario = calcularUnitarioPorDetalhe(next);
        const sugestaoUnitario = Number(next.detalhamento?._sugestao_unitario || 0);
        const overrideManual =
          item.categoria === "Mão de obra" && sugestaoUnitario > 0 ? Math.abs(unitario - sugestaoUnitario) > 0.01 : false;

        return {
          ...next,
          unitario,
          detalhamento: {
            ...(next.detalhamento || {}),
            _override_manual: overrideManual,
          },
        };
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
          <CardHeader><CardTitle>Base de custo MDO (autofill)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Competência</div>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={competenciaCusto}
                onChange={(e) => setCompetenciaCusto(e.target.value)}
              >
                {competenciasDisponiveis.length === 0 ? <option value="">Sem base carregada</option> : null}
                {competenciasDisponiveis.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Filtro de equipe para sugestão</div>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={equipeCustoFiltro}
                onChange={(e) => setEquipeCustoFiltro(e.target.value)}
              >
                {equipesDisponiveis.map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Divisor mensal → dia (MDO)</div>
              <Input
                type="number"
                value={diasBaseMensal}
                onChange={(e) => setDiasBaseMensal(Math.max(Number(e.target.value || 1), 1))}
                placeholder="Ex: 22"
              />
            </div>

            <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
              <div className="text-xs text-muted-foreground">Funções com base calculada</div>
              <div className="font-bold text-lg">{custosMaoDeObraAgregados.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Ao selecionar uma função em Mão de obra, o custo diário é sugerido automaticamente.
              </div>
            </div>
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
                      onChange={(e) => {
                        const novaCategoria = e.target.value as CategoriaItem;
                        atualizarItem(item.id, {
                          categoria: novaCategoria,
                          unidade: unidadePadraoPorCategoria(novaCategoria),
                          unitario: 0,
                          detalhamento: {},
                        });
                      }}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <div className="md:col-span-6 space-y-1">
                      <div className="text-[11px] text-muted-foreground">Função/Referência</div>
                      {item.categoria === "Mão de obra" ? (
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={item.referencia}
                          onChange={(e) => aplicarSugestaoMaoDeObra(item.id, e.target.value)}
                        >
                          <option value="">Selecione a função</option>
                          {[
                            ...(item.referencia && !funcoesMdoOpcoes.includes(item.referencia) ? [item.referencia] : []),
                            ...funcoesMdoOpcoes,
                          ].map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      ) : item.categoria === "Equipamentos" ? (
                        <>
                          <Input
                            list={`tipos-equip-${item.id}`}
                            placeholder="Digite ou selecione o Tipo de Equipamento"
                            value={item.referencia}
                            onChange={(e) => atualizarItem(item.id, { referencia: e.target.value })}
                          />
                          <datalist id={`tipos-equip-${item.id}`}>
                            {[
                              ...(item.referencia && !referenciasEquipamentos.includes(item.referencia) ? [item.referencia] : []),
                              ...referenciasEquipamentos,
                            ].map((op) => (
                              <option key={op} value={op} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>

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

                  {item.categoria === "Mão de obra" && Number(item.detalhamento?._sugestao_unitario || 0) > 0 ? (
                    <div className="text-[11px] rounded-md border px-2 py-1 bg-muted/30 flex flex-wrap gap-2 items-center">
                      <span className="text-muted-foreground">Sugestão base:</span>
                      <span className="font-semibold">{toMoney(Number(item.detalhamento?._sugestao_unitario || 0))}/dia</span>
                      <span className="text-muted-foreground">• competência {String(item.detalhamento?._sugestao_competencia || "-")}</span>
                      <span className="text-muted-foreground">• equipe {String(item.detalhamento?._sugestao_equipe || "TODAS")}</span>
                      {Boolean(item.detalhamento?._override_manual) ? (
                        <span className="text-amber-700 font-semibold">• override manual aplicado</span>
                      ) : (
                        <span className="text-green-700 font-semibold">• usando valor sugerido</span>
                      )}
                    </div>
                  ) : null}

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
                      <div className="text-[11px] text-muted-foreground">Período (dias/horas/viagens)</div>
                      <Input
                        type="number"
                        value={item.fatorAplicacao}
                        onChange={(e) => atualizarItem(item.id, { fatorAplicacao: Number(e.target.value || 0) })}
                        placeholder="Ex: 22"
                      />
                    </div>

                    <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
                      <div className="text-xs text-muted-foreground">Unidade aplicada</div>
                      <div className="font-semibold">{unidadePadraoPorCategoria(item.categoria)}</div>
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
          <CardHeader><CardTitle>Resumo por função (Mão de obra)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-0">
            <div className="rounded-md border px-3 py-2 bg-background">
              <div className="text-xs text-muted-foreground">Total de pessoas (soma quantidades)</div>
              <div className="font-bold text-lg">{resumoGeralEquipe.totalPessoas}</div>
            </div>
            <div className="rounded-md border px-3 py-2 bg-background">
              <div className="text-xs text-muted-foreground">Qtd de funções</div>
              <div className="font-bold text-lg">{resumoGeralEquipe.qtdFuncoes}</div>
            </div>
            <div className="rounded-md border px-3 py-2 bg-background">
              <div className="text-xs text-muted-foreground">Custo total mão de obra</div>
              <div className="font-bold text-lg">{toMoney(resumoGeralEquipe.custoTotalMaoDeObra)}</div>
            </div>
            <div className="rounded-md border px-3 py-2 bg-background">
              <div className="text-xs text-muted-foreground">Custo médio por função</div>
              <div className="font-bold text-lg">{toMoney(resumoGeralEquipe.custoMedioPorFuncao)}</div>
            </div>
          </CardContent>
          <CardContent className="space-y-2">
            {resumoPorFuncao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem itens de mão de obra para resumir.</p>
            ) : (
              resumoPorFuncao.map((r) => (
                <div key={r.funcao} className="border rounded-md px-3 py-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-semibold">{r.funcao}</div>
                    <div className="text-xs text-muted-foreground">Quantidade total: {r.quantidade}</div>
                  </div>
                  <div className="font-bold">{toMoney(r.total)}</div>
                </div>
              ))
            )}
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

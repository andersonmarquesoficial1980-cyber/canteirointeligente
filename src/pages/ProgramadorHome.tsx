// WF Programador — Gestão de equipes, funcionários e equipamentos
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Users, Wrench, Calendar, CalendarDays, Save, Users2, Truck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { sortOgsData } from "@/hooks/useOgsReference";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";
import { applyProgramadorBatch } from "@/lib/programadorBatch";
import { buildPersonMovement, buildEquipmentMovement, summarizeTeamRental, assertNewAdmission } from "@/lib/programadorIndividual";
import { saveMonthlyRental } from "@/lib/programadorRental";
import { EfficiencyMeeting } from "@/components/EfficiencyMeeting";
import { fetchTeamsForCompany, filterByTeamSelection, programadorEmployeesQuery } from "@/lib/programadorTeams";
import { ProgramadorRoster } from "@/components/ProgramadorRoster";
import { TeamPicker, rankTeamsByAllocation } from "@/components/TeamPicker";
import { groupPeopleForProgramador, groupEquipmentForProgramador } from "@/lib/programadorGroups";
import { useProgramadorPinnedTeams } from "@/hooks/useProgramadorPinnedTeams";
import { prepareRosterPersonChange, prepareRosterEquipmentChange, type PersonDraft, type EquipmentDraft } from "@/lib/programadorRoster";

const STATUS_FUNC_OPTIONS = [
  { value: "ativo", label: "ATIVO" },
  { value: "afastado", label: "AFASTADO" },
  { value: "demitido", label: "DEMITIDO" },
  { value: "ferias", label: "FÉRIAS" },
] as const;

const STATUS_EQUIP_OPTIONS = [
  { value: "ativo", label: "OPERACIONAL" },
  { value: "em_manutencao", label: "MANUTENÇÃO" },
  { value: "inoperante", label: "INOPERANTE" },
  { value: "devolver", label: "DEVOLVER" },
  { value: "devolvido", label: "DEVOLVIDO" },
  { value: "diaria", label: "DIÁRIA" },
  { value: "disposicao", label: "DISPOSIÇÃO" },
  { value: "inativo", label: "INATIVO (LEGADO)" },
] as const;

const STATUS_FUNC_VALUES = STATUS_FUNC_OPTIONS.map((s) => s.value);
const STATUS_EQUIP_VALUES = STATUS_EQUIP_OPTIONS.map((s) => s.value);

const normStatusToken = (value?: string | null) => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[_\s]/g, "")
  .toLowerCase()
  .trim();

const normalizeFuncionarioStatus = (value?: string | null) => {
  const s = normStatusToken(value);
  if (!s || s === "trabalhou" || s === "ativo") return "ativo";
  if (s === "afastado" || s === "falta" || s === "disposicao") return "afastado";
  if (s === "demitido" || s === "demissao") return "demitido";
  if (s === "ferias") return "ferias";
  return "ativo";
};

const normalizeEquipamentoStatus = (value?: string | null) => {
  const s = normStatusToken(value);
  if (!s || s === "ativo" || s === "operacional" || s === "operando") return "ativo";
  if (s.includes("manut")) return "em_manutencao";
  if (s === "inoperante") return "inoperante";
  if (s === "inativo" || s === "inativolegado") return "inativo";
  if (s === "devolver") return "devolver";
  if (s === "devolvido") return "devolvido";
  if (s === "diaria") return "diaria";
  if (s === "disposicao" || s === "reserva") return "disposicao";
  return "ativo";
};

const getFuncStatusLabel = (value?: string | null) => {
  const canon = normalizeFuncionarioStatus(value);
  return STATUS_FUNC_OPTIONS.find((s) => s.value === canon)?.label || canon.toUpperCase();
};

const getEquipStatusLabel = (value?: string | null) => {
  const canon = normalizeEquipamentoStatus(value);
  return STATUS_EQUIP_OPTIONS.find((s) => s.value === canon)?.label || canon.toUpperCase();
};

const PERIODOS = ["NOTURNO", "DIURNO", "INTEGRAL"];

interface Equipe { id: string; nome: string; responsavel: string | null; }
interface Funcionario { id: string; name: string; matricula: string | null; role: string | null; equipe: string | null; status: string | null; company_id?: string | null; }
interface Frota { id: string; frota: string; tipo: string; categoria_rdo?: string | null; setor: string | null; status?: string | null; company_id?: string | null; condicao: string | null; valor_mensal: number | null; empresa_proprietaria: string | null; locadora?: string | null; centro_custo?: string | null; placa?: string | null; }
interface Ogs { ogs_number: string; client_name: string; location_address: string; }

type Aba = "equipes" | "funcionarios" | "equipamentos";
type ModoFunc = "status" | "transferencia" | "admissao" | "demissao";
type ModoEquip = "status" | "transferencia";

type FuncDraftChange = { equipe: string; status: string };
type EquipDraftChange = { setor: string; status: string };

type ValidationIssue = {
  level: "erro" | "aviso";
  scope: "funcionario" | "equipamento" | "programacao";
  label: string;
  detail: string;
};

type ApplySummary = {
  when: string;
  funcionarios: number;
  equipamentos: number;
  avisos: number;
  forcaramIntegracao: boolean;
  motivo?: string;
};

export default function ProgramadorHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/");
  const origemQuery = origem ? `?origem=${encodeURIComponent(origem)}` : "";
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const companyId = profile?.company_id || null;
  const [aba, setAba] = useState<Aba>("equipes");
  const [saving, setSaving] = useState(false);

  // Dados de referência
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [frota, setFrota] = useState<Frota[]>([]);
  const [ogsList, setOgsList] = useState<Ogs[]>([]);

  // Form: Programação de equipe
  const [progData, setProgData] = useState(new Date().toISOString().split("T")[0]);
  const [progEquipe, setProgEquipe] = useState("");
  const [progOgs, setProgOgs] = useState("");
  const [progRua, setProgRua] = useState("");
  const [progCliente, setProgCliente] = useState("");
  const [progLocal, setProgLocal] = useState("");
  const [progPeriodo, setProgPeriodo] = useState("NOTURNO");
  const [progStatus, setProgStatus] = useState("TRABALHOU");
  const [progObs, setProgObs] = useState("");

  // Gestão visual por equipe (novo fluxo operacional)
  const [funcDraft, setFuncDraft] = useState<Record<string, FuncDraftChange>>({});
  const [equipDraft, setEquipDraft] = useState<Record<string, EquipDraftChange>>({});
  const [bulkFuncStatus, setBulkFuncStatus] = useState("");
  const [bulkFuncEquipe, setBulkFuncEquipe] = useState("");
  const [bulkEquipStatus, setBulkEquipStatus] = useState("");
  const [bulkEquipEquipe, setBulkEquipEquipe] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [forceIntegracaoOverride, setForceIntegracaoOverride] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [lastApplySummary, setLastApplySummary] = useState<ApplySummary | null>(null);
  const [funcSearch, setFuncSearch] = useState("");
  const [equipSearch, setEquipSearch] = useState("");
  const [onlyChangedFunc, setOnlyChangedFunc] = useState(false);
  const [onlyChangedEquip, setOnlyChangedEquip] = useState(false);
  const [filterFuncStatus, setFilterFuncStatus] = useState("TODOS");
  const [filterEquipStatus, setFilterEquipStatus] = useState("TODOS");
  const [modoOperacaoNoturna, setModoOperacaoNoturna] = useState(false);
  const [modoReuniao, setModoReuniao] = useState(false);
  const [rosterDirty, setRosterDirty] = useState(false);
  const [showAdmission, setShowAdmission] = useState(false);
  const [cadastrosLoading, setCadastrosLoading] = useState(false);
  const [cadastrosError, setCadastrosError] = useState("");
  const [cadastrosUpdatedAt, setCadastrosUpdatedAt] = useState<string | null>(null);

  // Utilitário: divide endereços com ;
  const splitRuas = (address: string) => address.split(";").map(r => r.trim()).filter(Boolean);

  // Form: Movimentação funcionário
  const [modoFunc, setModoFunc] = useState<ModoFunc>("status");
  const [funcId, setFuncId] = useState("");
  const [funcNome, setFuncNome] = useState("");
  const [funcMatricula, setFuncMatricula] = useState("");
  const [funcData, setFuncData] = useState(new Date().toISOString().split("T")[0]);
  const [funcStatus, setFuncStatus] = useState("");
  const [funcEquipeOrig, setFuncEquipeOrig] = useState("");
  const [funcEquipeDest, setFuncEquipeDest] = useState("");
  const [funcFuncao, setFuncFuncao] = useState("");
  const [funcAdmissao, setFuncAdmissao] = useState("");
  // Admissão: novo funcionário
  const [novoNome, setNovoNome] = useState("");
  const [novaMatricula, setNovaMatricula] = useState("");
  const [novaFuncao, setNovaFuncao] = useState("");
  const [novaEquipe, setNovaEquipe] = useState("");
  const [novaAdmissao, setNovaAdmissao] = useState(new Date().toISOString().split("T")[0]);
  const [novaObs, setNovaObs] = useState("");

  // Form: Movimentação equipamento
  const [modoEquip, setModoEquip] = useState<ModoEquip>("transferencia");
  const [equipFrota, setEquipFrota] = useState("");
  const [equipData, setEquipData] = useState(new Date().toISOString().split("T")[0]);
  const [equipStatus, setEquipStatus] = useState("");
  const [equipEquipeOrig, setEquipEquipeOrig] = useState("");
  const [equipEquipeDest, setEquipEquipeDest] = useState("");
  const [valorMensalDraft, setValorMensalDraft] = useState("");
  const recarregarCadastros = async () => {
    if (!companyId) {
      setEquipes([]); setFuncionarios([]); setFrota([]); setOgsList([]);
      setCadastrosUpdatedAt(null);
      setCadastrosError("Empresa não identificada");
      return;
    }
    setCadastrosLoading(true);
    setCadastrosError("");
    try {
    const funcionariosQuery = programadorEmployeesQuery(supabase, companyId);

    let frotaQuery: any = (supabase as any).from("equipamentos").select("id, frota, centro_custo, placa, tipo, categoria_rdo, setor, status, company_id, condicao, valor_mensal, empresa_proprietaria", { count: "exact" }).order("tipo").order("frota");
    if (companyId) frotaQuery = frotaQuery.eq("company_id", companyId);

    let ogsQuery: any = (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address");
    if (companyId) ogsQuery = ogsQuery.eq("company_id", companyId);

    const [funcRes, frotaRes, ogsRes] = await Promise.all([funcionariosQuery, frotaQuery, ogsQuery]);
    const failed = [funcRes, frotaRes, ogsRes].find(result => result.error);
    if (failed) throw new Error(failed.error.message);
    if (funcRes.count !== funcRes.data?.length || frotaRes.count !== frotaRes.data?.length) {
      throw new Error("A consulta retornou apenas parte dos cadastros. Totais de reunião indisponíveis até carregar todos os registros.");
    }
    const companyTeams = await fetchTeamsForCompany(supabase as any, companyId, funcRes.data as Funcionario[], frotaRes.data as Frota[]);
    setEquipes(companyTeams);
    if (funcRes?.data) {
      const normalizados = (funcRes.data as Funcionario[]).map((f) => ({
        ...f,
        status: normalizeFuncionarioStatus(f.status),
      }));
      setFuncionarios(normalizados);
    }
    if (frotaRes?.data) {
      const normalizados = (frotaRes.data as Frota[]).map((f) => ({
        ...f,
        status: normalizeEquipamentoStatus(f.status),
      }));
      setFrota(normalizados);
    }
    if (ogsRes?.data) setOgsList(sortOgsData(ogsRes.data));
    setCadastrosUpdatedAt(new Date().toISOString());
    } catch (error) {
      setCadastrosError((error as Error).message || "Falha na leitura dos cadastros centrais");
    } finally {
      setCadastrosLoading(false);
    }
  };

  useEffect(() => {
    recarregarCadastros();
  }, [companyId]);

  const handleOgsChange = (ogs: string) => {
    setProgOgs(ogs);
    setProgRua("");
    const o = ogsList.find(o => o.ogs_number === ogs);
    if (o) {
      setProgCliente(o.client_name);
      const ruas = splitRuas(o.location_address);
      setProgLocal(ruas.length === 1 ? ruas[0] : o.location_address);
    }
  };

  const handleFuncSelect = (id: string) => {
    const f = funcionarios.find(f => f.id === id);
    setFuncId(id);
    setFuncNome(f?.name ?? "");
    setFuncMatricula(f?.matricula ?? "");
    setFuncFuncao(f?.role ?? "");
    setFuncEquipeOrig(f?.equipe ?? "");
  };

  const handleEquipSelect = (equipmentId: string) => {
    setEquipFrota(equipmentId);
    const eq = frota.find((f) => f.id === equipmentId);
    setEquipEquipeOrig(eq?.setor || "");
    setEquipEquipeDest("");
    setEquipStatus("");
    setValorMensalDraft(eq?.valor_mensal != null ? String(eq.valor_mensal).replace(".", ",") : "");
  };

  const abrirFuncionarioDaEquipe = (id: string) => {
    if (funcMudancasPendentes + equipMudancasPendentes > 0) {
      toast({ title: "Alterações pendentes na equipe", description: "Aplique os ajustes da equipe antes de gerenciar uma pessoa separadamente.", variant: "destructive" });
      return;
    }
    handleFuncSelect(id);
    setModoFunc("status");
    setFuncStatus(""); setFuncEquipeDest("");
    setAba("funcionarios");
  };

  const abrirEquipamentoDaEquipe = (id: string) => {
    if (funcMudancasPendentes + equipMudancasPendentes > 0) {
      toast({ title: "Alterações pendentes na equipe", description: "Aplique os ajustes da equipe antes de gerenciar um equipamento separadamente.", variant: "destructive" });
      return;
    }
    handleEquipSelect(id);
    setModoEquip("status");
    setAba("equipamentos");
  };

  const equipesAtivas = useMemo(
    () => [...new Set((equipes || []).map((e) => (e.nome || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [equipes]
  );
  const equipesDestaque = useMemo(
    () => rankTeamsByAllocation(equipesAtivas, funcionarios, frota),
    [equipesAtivas, funcionarios, frota]
  );
  const sugestoesEquipes = useMemo(() => equipesDestaque.slice(0, 4), [equipesDestaque]);
  const baloesEquipe = useProgramadorPinnedTeams(companyId, profile?.user_id || null, equipesAtivas, sugestoesEquipes);

  const equipeOptionsComFallback = (valorAtual?: string) => {
    const lista = [...equipesAtivas];
    const legado = (valorAtual || "").trim();
    if (legado && !lista.some((n) => n.toLowerCase() === legado.toLowerCase())) {
      lista.push(legado);
    }
    return [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const statusFuncOptionsComFallback = (valorAtual?: string) => {
    const lista = [...STATUS_FUNC_VALUES];
    const legado = normalizeFuncionarioStatus(valorAtual);
    if (legado && !lista.includes(legado)) lista.push(legado);
    return [...new Set(lista)];
  };

  const statusEquipOptionsComFallback = (valorAtual?: string) => {
    const lista = [...STATUS_EQUIP_VALUES];
    const legado = normalizeEquipamentoStatus(valorAtual);
    if (legado && !lista.includes(legado)) lista.push(legado);
    return [...new Set(lista)];
  };

  const equipeResponsavel = (nome: string) => equipes.find(e => e.nome === nome)?.responsavel ?? null;

  const funcionariosDaEquipe = useMemo(() => {
    return filterByTeamSelection(funcionarios, progEquipe, (f) => f.equipe);
  }, [funcionarios, progEquipe]);

  const equipamentosDaEquipe = useMemo(() => {
    return filterByTeamSelection(frota, progEquipe, (f) => f.setor);
  }, [frota, progEquipe]);

  const resumoLocacaoEquipe = useMemo(() => summarizeTeamRental(equipamentosDaEquipe), [equipamentosDaEquipe]);
  const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const norm = (value?: string | null) => (value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  const riscoFuncionarioStatus = (status?: string | null) => {
    const s = normalizeFuncionarioStatus(status);
    if (s === "demitido" || s === "afastado") return 2;
    if (s === "ferias") return 1;
    return 0;
  };

  const riscoEquipStatus = (status?: string | null) => {
    const s = normalizeEquipamentoStatus(status);
    if (s === "inoperante") return 2;
    if (s === "em_manutencao" || s === "devolver") return 1;
    return 0;
  };

  const funcionarioMudou = (f: Funcionario, draft?: FuncDraftChange) => {
    const d = draft || { equipe: f.equipe || "", status: normalizeFuncionarioStatus(f.status) };
    return (d.equipe || "") !== (f.equipe || "") || normalizeFuncionarioStatus(d.status) !== normalizeFuncionarioStatus(f.status);
  };

  const equipamentoMudou = (eq: Frota, draft?: EquipDraftChange) => {
    const d = draft || { setor: eq.setor || "", status: normalizeEquipamentoStatus(eq.status) };
    return (d.setor || "") !== (eq.setor || "") || normalizeEquipamentoStatus(d.status) !== normalizeEquipamentoStatus(eq.status);
  };

  const funcionariosDaEquipeFiltrados = useMemo(() => {
    const base = funcionariosDaEquipe.filter((f) => {
      const draft = funcDraft[f.id] || { equipe: f.equipe || "", status: normalizeFuncionarioStatus(f.status) };
      const mudou = funcionarioMudou(f, draft);
      const risco = riscoFuncionarioStatus(draft.status);
      const okChanged = !onlyChangedFunc || mudou;
      const okStatus = filterFuncStatus === "TODOS" || (draft.status || "") === filterFuncStatus;
      const termo = norm(funcSearch);
      const okBusca = !termo || norm(f.name).includes(termo) || norm(f.matricula).includes(termo) || norm(draft.equipe).includes(termo);
      const okModo = !modoOperacaoNoturna || mudou || risco > 0;
      return okChanged && okStatus && okBusca && okModo;
    });

    return [...base].sort((a, b) => {
      const da = funcDraft[a.id] || { equipe: a.equipe || "", status: normalizeFuncionarioStatus(a.status) };
      const db = funcDraft[b.id] || { equipe: b.equipe || "", status: normalizeFuncionarioStatus(b.status) };
      const mudouA = funcionarioMudou(a, da) ? 1 : 0;
      const mudouB = funcionarioMudou(b, db) ? 1 : 0;
      if (mudouA !== mudouB) return mudouB - mudouA;
      const riscoA = riscoFuncionarioStatus(da.status);
      const riscoB = riscoFuncionarioStatus(db.status);
      if (riscoA !== riscoB) return riscoB - riscoA;
      return (a.name || "").localeCompare(b.name || "", "pt-BR");
    });
  }, [funcionariosDaEquipe, funcDraft, onlyChangedFunc, filterFuncStatus, funcSearch, modoOperacaoNoturna]);

  const equipamentosDaEquipeFiltrados = useMemo(() => {
    const base = equipamentosDaEquipe.filter((eq) => {
      const draft = equipDraft[eq.id] || { setor: eq.setor || "", status: normalizeEquipamentoStatus(eq.status) };
      const mudou = equipamentoMudou(eq, draft);
      const risco = riscoEquipStatus(draft.status);
      const okChanged = !onlyChangedEquip || mudou;
      const okStatus = filterEquipStatus === "TODOS" || (draft.status || "") === filterEquipStatus;
      const termo = norm(equipSearch);
      const okBusca = !termo || norm(eq.frota).includes(termo) || norm(eq.tipo).includes(termo) || norm(draft.setor).includes(termo);
      const okModo = !modoOperacaoNoturna || mudou || risco > 0;
      return okChanged && okStatus && okBusca && okModo;
    });

    return [...base].sort((a, b) => {
      const da = equipDraft[a.id] || { setor: a.setor || "", status: normalizeEquipamentoStatus(a.status) };
      const db = equipDraft[b.id] || { setor: b.setor || "", status: normalizeEquipamentoStatus(b.status) };
      const mudouA = equipamentoMudou(a, da) ? 1 : 0;
      const mudouB = equipamentoMudou(b, db) ? 1 : 0;
      if (mudouA !== mudouB) return mudouB - mudouA;
      const riscoA = riscoEquipStatus(da.status);
      const riscoB = riscoEquipStatus(db.status);
      if (riscoA !== riscoB) return riscoB - riscoA;
      return (a.frota || "").localeCompare(b.frota || "", "pt-BR");
    });
  }, [equipamentosDaEquipe, equipDraft, onlyChangedEquip, filterEquipStatus, equipSearch, modoOperacaoNoturna]);
  const gruposPessoas = useMemo(() => groupPeopleForProgramador(funcionariosDaEquipeFiltrados), [funcionariosDaEquipeFiltrados]);
  const gruposEquipamentos = useMemo(() => groupEquipmentForProgramador(equipamentosDaEquipeFiltrados), [equipamentosDaEquipeFiltrados]);

  const criticosFuncCount = useMemo(
    () => funcionariosDaEquipeFiltrados.filter((f) => riscoFuncionarioStatus((funcDraft[f.id]?.status ?? f.status)) >= 2).length,
    [funcionariosDaEquipeFiltrados, funcDraft]
  );

  const criticosEquipCount = useMemo(
    () => equipamentosDaEquipeFiltrados.filter((eq) => riscoEquipStatus((equipDraft[eq.id]?.status ?? eq.status)) >= 2).length,
    [equipamentosDaEquipeFiltrados, equipDraft]
  );

  const funcMudancasPendentes = useMemo(
    () => Object.entries(funcDraft).filter(([id, draft]) => {
      const atual = funcionarios.find((f) => f.id === id);
      if (!atual) return false;
      return (draft.equipe || "") !== (atual.equipe || "") || normalizeFuncionarioStatus(draft.status) !== normalizeFuncionarioStatus(atual.status);
    }).length,
    [funcDraft, funcionarios]
  );

  const equipMudancasPendentes = useMemo(
    () => Object.entries(equipDraft).filter(([id, draft]) => {
      const atual = frota.find((f) => f.id === id);
      if (!atual) return false;
      return (draft.setor || "") !== (atual.setor || "") || normalizeEquipamentoStatus(draft.status) !== normalizeEquipamentoStatus(atual.status);
    }).length,
    [equipDraft, frota]
  );

  const isForceableIntegracaoIssue = (issue: ValidationIssue) =>
    issue.level === "erro"
    && issue.scope === "funcionario"
    && (
      issue.label.startsWith("Sem integração:")
      || issue.label.startsWith("Integração pendente:")
      || issue.label.startsWith("Integração vencida:")
    );

  const blockingIssues = useMemo(
    () => validationIssues.filter((i) => i.level === "erro"),
    [validationIssues]
  );

  const forceableBlockingIssues = useMemo(
    () => blockingIssues.filter(isForceableIntegracaoIssue),
    [blockingIssues]
  );

  const nonForceableBlockingIssues = useMemo(
    () => blockingIssues.filter((i) => !isForceableIntegracaoIssue(i)),
    [blockingIssues]
  );

  const canForceCurrentBlocking = useMemo(
    () => blockingIssues.length > 0 && nonForceableBlockingIssues.length === 0,
    [blockingIssues, nonForceableBlockingIssues]
  );

  const forceReasonValid = useMemo(
    () => forceReason.trim().length >= 12,
    [forceReason]
  );

  const hasBlockingIssues = useMemo(
    () => blockingIssues.length > 0,
    [blockingIssues]
  );

  const carregarDraftsDaEquipe = () => {
    const nextFunc: Record<string, FuncDraftChange> = {};
    for (const f of funcionariosDaEquipe) {
      nextFunc[f.id] = { equipe: f.equipe || "", status: normalizeFuncionarioStatus(f.status) };
    }

    const nextEquip: Record<string, EquipDraftChange> = {};
    for (const eq of equipamentosDaEquipe) {
      nextEquip[eq.id] = { setor: eq.setor || "", status: normalizeEquipamentoStatus(eq.status) };
    }

    setFuncDraft(nextFunc);
    setEquipDraft(nextEquip);
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
  };

  useEffect(() => {
    carregarDraftsDaEquipe();
  }, [progEquipe, funcionariosDaEquipe, equipamentosDaEquipe]);

  useEffect(() => {
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
  }, [progData, progPeriodo, progOgs, progEquipe]);

  useEffect(() => {
    setFuncSearch("");
    setEquipSearch("");
    setOnlyChangedFunc(false);
    setOnlyChangedEquip(false);
    setFilterFuncStatus("TODOS");
    setFilterEquipStatus("TODOS");
    setModoOperacaoNoturna(false);
  }, [progEquipe]);

  const alternarModoOperacaoNoturna = () => {
    setModoOperacaoNoturna((prev) => {
      const next = !prev;
      if (next) {
        setOnlyChangedFunc(true);
        setOnlyChangedEquip(true);
      }
      return next;
    });
  };

  const atualizarFuncDraft = (id: string, campo: keyof FuncDraftChange, valor: string) => {
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
    setFuncDraft((prev) => ({
      ...prev,
      [id]: {
        equipe: prev[id]?.equipe ?? funcionarios.find((f) => f.id === id)?.equipe ?? "",
        status: normalizeFuncionarioStatus(prev[id]?.status ?? funcionarios.find((f) => f.id === id)?.status),
        [campo]: campo === "status" ? normalizeFuncionarioStatus(valor) : valor,
      },
    }));
  };

  const atualizarEquipDraft = (id: string, campo: keyof EquipDraftChange, valor: string) => {
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
    setEquipDraft((prev) => ({
      ...prev,
      [id]: {
        setor: prev[id]?.setor ?? frota.find((f) => f.id === id)?.setor ?? "",
        status: normalizeEquipamentoStatus(prev[id]?.status ?? frota.find((f) => f.id === id)?.status),
        [campo]: campo === "status" ? normalizeEquipamentoStatus(valor) : valor,
      },
    }));
  };

  const aplicarLoteFuncionarios = () => {
    const ids = funcionariosDaEquipe.map((f) => f.id);
    if (!ids.length) return;
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
    setFuncDraft((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const baseEquipe = next[id]?.equipe ?? funcionarios.find((f) => f.id === id)?.equipe ?? "";
        const baseStatus = normalizeFuncionarioStatus(next[id]?.status ?? funcionarios.find((f) => f.id === id)?.status);
        next[id] = {
          equipe: bulkFuncEquipe || baseEquipe,
          status: bulkFuncStatus || baseStatus,
        };
      }
      return next;
    });
  };

  const aplicarLoteEquipamentos = () => {
    const ids = equipamentosDaEquipe.map((f) => f.id);
    if (!ids.length) return;
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
    setEquipDraft((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const baseSetor = next[id]?.setor ?? frota.find((f) => f.id === id)?.setor ?? "";
        const baseStatus = normalizeEquipamentoStatus(next[id]?.status ?? frota.find((f) => f.id === id)?.status);
        next[id] = {
          setor: bulkEquipEquipe || baseSetor,
          status: bulkEquipStatus || baseStatus,
        };
      }
      return next;
    });
  };

  const validarMudancasEquipe = async (): Promise<{ ok: boolean; issues: ValidationIssue[] }> => {
    const issues: ValidationIssue[] = [];

    if (!progEquipe) {
      const base = [{ level: "erro", scope: "programacao", label: "Equipe não selecionada", detail: "Selecione uma equipe antes de validar." } as ValidationIssue];
      setValidationIssues(base);
      return { ok: false, issues: base };
    }

    setValidating(true);

    const funcFinal = funcionariosDaEquipe.map((f) => ({
      ...f,
      finalEquipe: funcDraft[f.id]?.equipe ?? f.equipe ?? "",
      finalStatus: normalizeFuncionarioStatus(funcDraft[f.id]?.status ?? f.status),
    }));

    const equipFinal = equipamentosDaEquipe.map((e) => ({
      ...e,
      finalSetor: equipDraft[e.id]?.setor ?? e.setor ?? "",
      finalStatus: normalizeEquipamentoStatus(equipDraft[e.id]?.status ?? e.status),
    }));

    for (const f of funcFinal) {
      if (funcionarioMudou(f, funcDraft[f.id]) && !(f.finalEquipe || "").trim()) {
        issues.push({
          level: "erro",
          scope: "funcionario",
          label: `Funcionário sem equipe: ${f.name}`,
          detail: "Defina a equipe antes de aplicar.",
        });
      }
      if (funcionarioMudou(f, funcDraft[f.id]) && !(f.finalStatus || "").trim()) {
        issues.push({
          level: "erro",
          scope: "funcionario",
          label: `Funcionário sem status: ${f.name}`,
          detail: "Defina o status antes de aplicar.",
        });
      }
    }

    for (const eq of equipFinal) {
      if (equipamentoMudou(eq, equipDraft[eq.id]) && !(eq.finalSetor || "").trim()) {
        issues.push({
          level: "erro",
          scope: "equipamento",
          label: `Equipamento sem equipe: ${eq.frota}`,
          detail: "Defina a equipe/setor antes de aplicar.",
        });
      }
      if (equipamentoMudou(eq, equipDraft[eq.id]) && !(eq.finalStatus || "").trim()) {
        issues.push({
          level: "erro",
          scope: "equipamento",
          label: `Equipamento sem status: ${eq.frota}`,
          detail: "Defina o status antes de aplicar.",
        });
      }
    }

    setValidationIssues(issues);
    setValidating(false);

    if (issues.some((i) => i.level === "erro")) {
      toast({ title: "Validação encontrou bloqueios", description: "Corrija os erros destacados antes de aplicar.", variant: "destructive" });
      return { ok: false, issues };
    }

    toast({
      title: "✅ Validação concluída",
      description: "Pronto para aplicar mudanças de alocação da equipe.",
    });

    return { ok: true, issues };
  };

  const salvarMudancasEquipe = async () => {
    const validacao = await validarMudancasEquipe();
    const blocking = validacao.issues.filter((i) => i.level === "erro");
    const forceable = blocking.filter(isForceableIntegracaoIssue);
    const nonForceable = blocking.filter((i) => !isForceableIntegracaoIssue(i));

    const canForce = blocking.length > 0
      && forceIntegracaoOverride
      && nonForceable.length === 0
      && forceable.length === blocking.length
      && forceReasonValid;

    if (!validacao.ok && !canForce) {
      if (blocking.length > 0 && nonForceable.length === 0 && forceable.length === blocking.length && !forceIntegracaoOverride) {
        toast({ title: "Bloqueio por integração", description: "Para seguir, ative o modo de forçar e informe o motivo obrigatório.", variant: "destructive" });
      } else if (blocking.length > 0 && nonForceable.length === 0 && forceIntegracaoOverride && !forceReasonValid) {
        toast({ title: "Informe o motivo", description: "Descreva o motivo com pelo menos 12 caracteres para forçar a aplicação.", variant: "destructive" });
      }
      return;
    }

    const forcedRun = !validacao.ok && canForce;

    const funcUpdates = Object.entries(funcDraft)
      .map(([id, draft]) => {
        const atual = funcionarios.find((f) => f.id === id);
        if (!atual) return null;
        const mudouEquipe = (draft.equipe || "") !== (atual.equipe || "");
        const mudouStatus = normalizeFuncionarioStatus(draft.status) !== normalizeFuncionarioStatus(atual.status);
        if (!mudouEquipe && !mudouStatus) return null;
        return { atual, draft, mudouEquipe, mudouStatus };
      })
      .filter(Boolean) as Array<{ atual: Funcionario; draft: FuncDraftChange; mudouEquipe: boolean; mudouStatus: boolean }>;

    const equipUpdates = Object.entries(equipDraft)
      .map(([id, draft]) => {
        const atual = frota.find((f) => f.id === id);
        if (!atual) return null;
        const mudouSetor = (draft.setor || "") !== (atual.setor || "");
        const mudouStatus = normalizeEquipamentoStatus(draft.status) !== normalizeEquipamentoStatus(atual.status);
        if (!mudouSetor && !mudouStatus) return null;
        return { atual, draft, mudouSetor, mudouStatus };
      })
      .filter(Boolean) as Array<{ atual: Frota; draft: EquipDraftChange; mudouSetor: boolean; mudouStatus: boolean }>;

    if (!funcUpdates.length && !equipUpdates.length) {
      toast({ title: "Sem alterações", description: "Nenhuma mudança pendente para salvar." });
      return;
    }

    setSaving(true);
    let appliedSuccessfully = false;
    try {
      const applied = await applyProgramadorBatch(supabase as any, {
        companyId,
        date: progData || new Date().toISOString().slice(0, 10),
        team: progEquipe === "__sem_equipe__" ? "Sem equipe" : progEquipe || "-",
        overrideReason: forcedRun ? forceReason.trim() : "",
        employees: funcUpdates.map((u) => ({
          id: u.atual.id, equipe: u.draft.equipe || null,
          status: normalizeFuncionarioStatus(u.draft.status),
        })),
        equipments: equipUpdates.map((u) => ({
          id: u.atual.id, setor: u.draft.setor || null,
          status: normalizeEquipamentoStatus(u.draft.status),
          responsavel_destino: equipeResponsavel(u.draft.setor || "") || null,
        })),
      });
      appliedSuccessfully = true;
      const avisosCount = validacao.issues.filter((i) => i.level === "aviso").length;
      await recarregarCadastros();
      setLastApplySummary({
        when: new Date().toISOString(),
        funcionarios: applied.funcionarios,
        equipamentos: applied.equipamentos,
        avisos: avisosCount,
        forcaramIntegracao: forcedRun,
        motivo: forcedRun ? forceReason.trim() : undefined,
      });
      setForceIntegracaoOverride(false);
      setForceReason("");
      toast({
        title: forcedRun ? "⚠️ Movimentações aplicadas com override" : "✅ Movimentações aplicadas",
        description: `${applied.funcionarios} funcionário(s) e ${applied.equipamentos} equipamento(s) atualizados${avisosCount ? ` • ${avisosCount} aviso(s)` : ""}.`,
      });
    } catch (error) {
      toast({
        title: appliedSuccessfully ? "Alterações aplicadas; falha ao atualizar a tela" : "Falha na aplicação do lote",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // SALVAR PROGRAMAÇÃO DE EQUIPE
  const salvarProgramacao = async () => {
    if (!progEquipe || progEquipe === "__sem_equipe__" || !progData) return;
    setSaving(true);
    const equipeInfo = equipes.find(e => e.nome === progEquipe);
    const { error } = await (supabase as any).from("ci_programacoes").insert({
      data: progData, equipe: progEquipe,
      responsavel: equipeInfo?.responsavel,
      ogs: progOgs || null, cliente: progCliente || null,
      local: progRua || progLocal || null, periodo: progPeriodo,
      status_equipe: progStatus, obs: progObs || null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✅ Programação salva!" });
      setProgOgs(""); setProgCliente(""); setProgLocal(""); setProgObs("");
    }
    setSaving(false);
  };

  // SALVAR MOVIMENTAÇÃO FUNCIONÁRIO
  const salvarMovFunc = async () => {
    if (modoFunc === "admissao") {
      if (!novoNome || !novaMatricula || !novaFuncao || !novaEquipe) return;
      setSaving(true);
      try {
        assertNewAdmission(companyId, null);
        const matricula = novaMatricula.trim();
        const nome = novoNome.trim().toUpperCase();
        const funcao = novaFuncao.trim().toUpperCase();
        const dataBase = novaAdmissao || new Date().toISOString().slice(0, 10);

        let busca: any = supabase
          .from("employees")
          .select("id, company_id")
          .eq("matricula", matricula)
          .limit(1);
        if (companyId) busca = busca.eq("company_id", companyId);

        const { data: existente, error: erroBusca } = await busca.maybeSingle();
        if (erroBusca) {
          toast({ title: "Erro ao consultar cadastro", description: erroBusca.message, variant: "destructive" });
          setSaving(false);
          return;
        }

        assertNewAdmission(companyId, existente?.id || null);
        const { data: created, error: erroInsert } = await (supabase as any).from("employees").insert({
          name: nome,
          matricula,
          role: funcao,
          equipe: novaEquipe,
          status: "ativo",
          data_admissao: dataBase,
          data_demissao: null,
          company_id: companyId,
        }).select("id").single();
        if (erroInsert) throw erroInsert;

        const { error } = await (supabase as any).from("ci_mov_funcionarios").insert({
          data: dataBase,
          tipo: "admissao",
          funcionario_id: created.id,
          funcionario_nome: nome,
          matricula: matricula,
          equipe_destino: novaEquipe,
          funcao: funcao,
          status: "ativo",
          data_admissao: dataBase,
          company_id: companyId,
          obs: novaObs || null,
        });

        if (error) {
          toast({ title: "Cadastro criado; auditoria pendente", description: `Não repita a admissão. Registro criado, mas o histórico falhou: ${error.message}`, variant: "destructive" });
        } else {
          await recarregarCadastros();
          toast({ title: "✅ Admissão registrada e sincronizada!" });
          setNovoNome(""); setNovaMatricula(""); setNovaFuncao(""); setNovaEquipe(""); setNovaObs("");
        }
      } catch (err: any) {
        toast({ title: "Erro inesperado", description: err?.message || "Falha ao registrar admissão.", variant: "destructive" });
      }
      setSaving(false);
      return;
    }
    const person = funcionarios.find(f => f.id === funcId);
    if (!person || !companyId) {
      toast({ title: "Selecione um funcionário da empresa", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const isTransfer = modoFunc === "transferencia";
      const target = isTransfer ? funcEquipeDest : modoFunc === "demissao" ? "demitido" : funcStatus;
      const change = buildPersonMovement(person, companyId, isTransfer ? "transferencia" : "status", target);
      await applyProgramadorBatch(supabase as any, {
        companyId, date: funcData, team: person.equipe || "-", overrideReason: "",
        employees: [change], equipments: [],
      });
      await recarregarCadastros();
      toast({ title: "Movimentação aplicada em Gestão de Pessoas e auditada" });
      setFuncId(""); setFuncNome(""); setFuncMatricula(""); setFuncStatus(""); setFuncEquipeOrig(""); setFuncEquipeDest("");
    } catch (error) {
      toast({ title: "Movimentação não concluída", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // SALVAR MOVIMENTAÇÃO EQUIPAMENTO
  const salvarMovEquip = async () => {
    const equipment = frota.find(f => f.id === equipFrota);
    if (!equipment || !companyId) {
      toast({ title: "Selecione um equipamento da empresa", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const isTransfer = modoEquip === "transferencia";
      const change = buildEquipmentMovement(
        equipment, companyId, modoEquip,
        isTransfer ? equipEquipeDest : equipStatus,
        equipeResponsavel(isTransfer ? equipEquipeDest : equipment.setor || ""),
      );
      await applyProgramadorBatch(supabase as any, {
        companyId, date: equipData, team: equipment.setor || "-", overrideReason: "",
        employees: [], equipments: [change],
      });
      await recarregarCadastros();
      toast({ title: "Movimentação aplicada em Gestão de Frotas e auditada" });
      setEquipFrota(""); setEquipStatus(""); setEquipEquipeOrig(""); setEquipEquipeDest("");
    } catch (error) {
      toast({ title: "Movimentação não concluída", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const salvarValorMensal = async () => {
    const equipment = frota.find(f => f.id === equipFrota);
    if (!equipment || !companyId) return;
    setSaving(true);
    let confirmed = false;
    try {
      const result = await saveMonthlyRental(supabase as any, equipment, companyId, valorMensalDraft);
      confirmed = true;
      const { data: persisted, error: readError } = await (supabase as any)
        .from("equipamentos").select("valor_mensal")
        .eq("id", equipment.id).eq("company_id", companyId).single();
      if (readError || Number(persisted?.valor_mensal) !== result.depois) {
        throw new Error(readError?.message || "O valor salvo não pôde ser conferido. Atualize a tela antes de tentar novamente.");
      }
      await recarregarCadastros();
      setValorMensalDraft(String(result.depois).replace(".", ","));
      toast({ title: "Valor mensal salvo e conferido na Gestão de Frotas", description: `Antes: ${result.antes == null ? "não cadastrado" : moeda(result.antes)} · Agora: ${moeda(result.depois)}. Histórico gravado.` });
    } catch (error) {
      toast({ title: confirmed ? "Valor aplicado; conferência da tela pendente" : "Valor mensal não atualizado", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dataMovimentacao = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  const salvarFuncionarioNaLista = async (id: string, draft: PersonDraft): Promise<void> => {
    const person = funcionarios.find(f => f.id === id);
    if (!person || !companyId || cadastrosError || cadastrosLoading) throw new Error("Cadastro indisponível; atualize a tela antes de salvar");
    const change = prepareRosterPersonChange(person, companyId, draft);
    if (change.status === "demitido" && person.status !== "demitido"
      && !window.confirm(`Confirmar a demissão de ${person.name}? O cadastro e o histórico serão atualizados.`)) {
      throw new Error("Demissão cancelada");
    }
    setSaving(true);
    let applied = false;
    try {
      const result = await applyProgramadorBatch(supabase as any, {
        companyId, date: dataMovimentacao(), team: person.equipe || "-", overrideReason: "",
        employees: [change], equipments: [],
      });
      if (result.funcionarios !== 1) throw new Error("O banco não aplicou a alteração. Atualize a tela e confira o registro.");
      applied = true;
      const { data: persisted, error } = await (supabase as any).from("employees").select("equipe,status")
        .eq("id", id).eq("company_id", companyId).single();
      if (error || !persisted || persisted.equipe !== change.equipe || persisted.status !== change.status) {
        throw new Error(error?.message || "A alteração foi aplicada, mas a conferência não confirmou os dados. Atualize a tela antes de tentar novamente.");
      }
      await recarregarCadastros();
      toast({ title: "Funcionário atualizado em Gestão de Pessoas, com histórico" });
    } catch (cause) {
      if (applied) throw new Error(`Alteração aplicada; conferência da tela pendente. Não repita sem verificar o cadastro: ${(cause as Error).message}`);
      throw cause;
    } finally { setSaving(false); }
  };

  const salvarEquipamentoNaLista = async (id: string, draft: EquipmentDraft): Promise<void> => {
    const equipment = frota.find(f => f.id === id);
    if (!equipment || !companyId || cadastrosError || cadastrosLoading) throw new Error("Cadastro indisponível; atualize a tela antes de salvar");
    const change = prepareRosterEquipmentChange(equipment, companyId, draft, equipeResponsavel(draft.setor));
    setSaving(true);
    let applied = false;
    try {
      const result = await applyProgramadorBatch(supabase as any, {
        companyId, date: dataMovimentacao(), team: equipment.setor || "-", overrideReason: "",
        employees: [], equipments: [change],
      });
      if (result.equipamentos !== 1) throw new Error("O banco não aplicou a alteração. Atualize a tela e confira o registro.");
      applied = true;
      const { data: persisted, error } = await (supabase as any).from("equipamentos").select("setor,status")
        .eq("id", id).eq("company_id", companyId).single();
      if (error || !persisted || persisted.setor !== change.setor || persisted.status !== change.status) {
        throw new Error(error?.message || "A alteração foi aplicada, mas a conferência não confirmou os dados. Atualize a tela antes de tentar novamente.");
      }
      await recarregarCadastros();
      toast({ title: "Equipamento atualizado em Gestão de Frotas, com histórico" });
    } catch (cause) {
      if (applied) throw new Error(`Alteração aplicada; conferência da tela pendente. Não repita sem verificar o cadastro: ${(cause as Error).message}`);
      throw cause;
    } finally { setSaving(false); }
  };

  const salvarPrecoNaLista = async (id: string, text: string): Promise<number> => {
    const equipment = frota.find(f => f.id === id);
    if (!equipment || !companyId || cadastrosError || cadastrosLoading) throw new Error("Cadastro indisponível; atualize a tela antes de salvar");
    setSaving(true);
    let applied = false;
    try {
      const result = await saveMonthlyRental(supabase as any, equipment, companyId, text);
      applied = true;
      const { data: persisted, error } = await (supabase as any).from("equipamentos").select("valor_mensal")
        .eq("id", id).eq("company_id", companyId).single();
      if (error || persisted?.valor_mensal == null || Number(persisted.valor_mensal) !== result.depois) {
        throw new Error(error?.message || "Valor aplicado, mas não confirmado na consulta. Confira o equipamento antes de tentar novamente.");
      }
      await recarregarCadastros();
      toast({ title: "Valor mensal confirmado em Gestão de Frotas", description: `Antes: ${result.antes == null ? "não cadastrado" : moeda(result.antes)} · Agora: ${moeda(result.depois)}` });
      return result.depois;
    } catch (cause) {
      if (applied) throw new Error(`Valor aplicado; conferência da tela pendente. Não repita sem verificar o cadastro: ${(cause as Error).message}`);
      throw cause;
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center bg-header-gradient px-3 shadow-sm">
        <div className="flex w-full items-center gap-2.5">
          <button onClick={goBack} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <LogoHomeButton className="w-8 h-8 rounded-full border border-white/30" />
          <div className="flex-1">
            <h1 className="text-base font-display font-bold text-white leading-tight">WF Programador</h1>
            <p className="hidden sm:block text-[11px] text-white/70">Equipes · Funcionários · Equipamentos</p>
          </div>
          <button
            onClick={() => navigate(`/programador/programacao-noturna${origemQuery}`)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5" /> Obras
          </button>
        </div>
      </header>

      {/* Tabs */}
      {!modoReuniao && <div className="flex border-b border-border bg-card sticky top-14 z-40">
        {([
          { id: "equipes", label: "Equipes", icon: Calendar },
          { id: "funcionarios", label: "Funcionários", icon: Users },
          { id: "equipamentos", label: "Equipamentos", icon: Wrench },
        ] as const).map(t => (
          <button key={t.id} onClick={() => {
            if (t.id !== aba && rosterDirty && !window.confirm("Descartar alterações não salvas neste registro?")) return;
            setRosterDirty(false);
            setAba(t.id);
          }}
            className={`flex-1 flex h-10 items-center justify-center gap-1.5 text-xs font-semibold transition-colors border-b-2 ${
              aba === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>}

      <div className="flex-1 px-3 py-3 pb-4 space-y-3">
        {modoReuniao && (
          <EfficiencyMeeting
            people={funcionarios} equipment={frota} initialTeam={progEquipe} pinnedTeams={baloesEquipe.pinned}
            updatedAt={cadastrosUpdatedAt} error={cadastrosError} loading={cadastrosLoading}
            onRefresh={() => { void recarregarCadastros(); }} onExit={() => setModoReuniao(false)}
            onManagePerson={(id) => {
              const person = funcionarios.find(f => f.id === id);
              if (person) setProgEquipe(person.equipe || "");
              setModoReuniao(false);
              abrirFuncionarioDaEquipe(id);
            }}
            onManageEquipment={(id) => {
              const equipment = frota.find(f => f.id === id);
              if (equipment) setProgEquipe(equipment.setor || "");
              setModoReuniao(false);
              abrirEquipamentoDaEquipe(id);
            }}
          />
        )}
        {!modoReuniao && cadastrosError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            Falha ao consultar os cadastros de Pessoas e Frotas: {cadastrosError}. Atualize a página antes de alterar registros.
          </p>
        )}

        {/* ── ABA EQUIPES ── */}
        {!modoReuniao && aba === "equipes" && (
          <div className="space-y-3">

            {/* Contexto de alocação (sem programação diária) */}
            <div className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Alocação por equipe</h3>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/integracao-obras${origemQuery}`)}>
                    <Building2 className="w-4 h-4 mr-1" /> Integrações
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center gap-1.5">
                <TeamPicker teams={equipesAtivas} pinned={baloesEquipe.pinned} value={progEquipe} onChange={setProgEquipe}
                  onPin={baloesEquipe.pin} onUnpin={baloesEquipe.unpin} allowNoTeam />
                {progEquipe && equipeResponsavel(progEquipe) && <p className="text-[11px] text-muted-foreground xl:max-w-64 truncate" title={equipeResponsavel(progEquipe) || undefined}>
                  Responsável: {equipeResponsavel(progEquipe)}
                </p>}
              </div>
              {baloesEquipe.error && <p role="alert" className="text-[11px] text-amber-800">{baloesEquipe.error}</p>}
            </div>

            {/* Painel operacional por equipe (Pessoas + Equipamentos) */}
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Gestão da equipe</h3>
                  <p className="text-[11px] text-muted-foreground">Pessoas e frota no cadastro central · alterações com histórico</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(funcMudancasPendentes + equipMudancasPendentes) > 0 && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      {funcMudancasPendentes + equipMudancasPendentes} pendente(s)
                    </span>
                  )}
                  <Button type="button" size="sm" className="h-8 text-xs" variant={modoOperacaoNoturna ? "default" : "outline"} onClick={alternarModoOperacaoNoturna}>
                    {modoOperacaoNoturna ? "Operação noturna: ON" : "Operação noturna"}
                  </Button>
                  <Button type="button" size="sm" className="h-8 text-xs" variant="outline"
                    disabled={cadastrosLoading || !!cadastrosError || !!(funcMudancasPendentes + equipMudancasPendentes)}
                    onClick={() => {
                      setOnlyChangedFunc(false); setOnlyChangedEquip(false);
                      setModoOperacaoNoturna(false);
                      setFilterFuncStatus("TODOS"); setFilterEquipStatus("TODOS");
                      setFuncSearch(""); setEquipSearch("");
                      setModoReuniao(true);
                    }}>Apresentar eficiência</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5" aria-label="Resumo da equipe selecionada">
                <div className="rounded-lg border border-border bg-muted/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Pessoas</p>
                  <p className="text-base font-semibold tabular-nums">{funcionariosDaEquipe.length}</p>
                  <p className="text-[10px] text-muted-foreground">{funcMudancasPendentes} pendentes · {criticosFuncCount} críticos</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Equipamentos</p>
                  <p className="text-base font-semibold tabular-nums">{equipamentosDaEquipe.length}</p>
                  <p className="text-[10px] text-muted-foreground">{equipMudancasPendentes} pendentes · {criticosEquipCount} críticos</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Terceiros</p>
                  <p className="text-base font-semibold tabular-nums">{resumoLocacaoEquipe.rented}</p>
                  <p className="text-[10px] text-muted-foreground">{resumoLocacaoEquipe.withoutPrice} sem valor cadastrado</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Mensal conhecido</p>
                  <p className="text-base font-semibold tabular-nums">{moeda(resumoLocacaoEquipe.monthlyKnown)}</p>
                  <p className="text-[10px] text-muted-foreground">Não inclui preços ausentes</p>
                </div>
              </div>

                {modoOperacaoNoturna && (
                  <p className="text-[11px] text-primary font-semibold">
                    Modo operação noturna ativo: lista prioriza alterados e críticos para ação imediata.
                  </p>
                )}

              {!progEquipe ? (
                <p className="text-xs text-muted-foreground">Selecione uma equipe acima para visualizar os membros e equipamentos vinculados.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start min-h-0">
                    {/* Funcionários */}
                    <div className="min-w-0 rounded-xl border border-border p-2.5 space-y-2 lg:flex lg:flex-col min-h-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users2 className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold">{progEquipe === "__sem_equipe__" ? "Pessoas sem equipe" : "Pessoas da equipe"} ({funcionariosDaEquipeFiltrados.length}/{funcionariosDaEquipe.length})</h4>
                        </div>
                        <span className="text-xs text-muted-foreground">{funcMudancasPendentes} mudança(s)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(150px,180px)] 2xl:grid-cols-[minmax(0,1fr)_170px_auto] gap-1.5">
                        <Input className="h-8 min-w-0 text-xs"
                          value={funcSearch}
                          onChange={(e) => setFuncSearch(e.target.value)}
                          placeholder="Buscar por nome, matrícula ou equipe..."
                        />
                        <Select value={filterFuncStatus} onValueChange={setFilterFuncStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS">Todos os status</SelectItem>
                            {STATUS_FUNC_VALUES.map((s) => <SelectItem key={`ffs-${s}`} value={s}>{getFuncStatusLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" className="h-8 text-xs" variant={onlyChangedFunc ? "default" : "outline"} onClick={() => setOnlyChangedFunc((v) => !v)}>
                          {onlyChangedFunc ? "Somente alterados: ON" : "Somente alterados"}
                        </Button>
                      </div>

                      <details className="rounded-lg border border-border/70 px-2.5 py-1.5">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Ações em lote · pessoas</summary>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <Select value={bulkFuncEquipe} onValueChange={setBulkFuncEquipe}>
                          <SelectTrigger><SelectValue placeholder="Nova equipe" /></SelectTrigger>
                          <SelectContent>{equipesAtivas.map(nome => <SelectItem key={`bf-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bulkFuncStatus} onValueChange={setBulkFuncStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Novo status" /></SelectTrigger>
                          <SelectContent>{STATUS_FUNC_VALUES.map((s) => <SelectItem key={`bfs-${s}`} value={s}>{getFuncStatusLabel(s)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={aplicarLoteFuncionarios}>Aplicar lote (Pessoas)</Button>
                        </div>
                      </details>

                      <div className="space-y-1.5 max-h-80 lg:max-h-[calc(100vh-330px)] overflow-auto pr-1">
                        {funcionariosDaEquipeFiltrados.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum funcionário encontrado com os filtros atuais.</p>
                        ) : gruposPessoas.map((group) => <section key={group.title} className="space-y-1.5" aria-label={group.title}>
                          <h5 className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-muted/70 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                            {group.title}<span className="font-normal tabular-nums text-muted-foreground">{group.items.length}</span>
                          </h5>
                          {group.items.map((f) => {
                          const draft = funcDraft[f.id] || { equipe: f.equipe || "", status: normalizeFuncionarioStatus(f.status) };
                          const mudou = funcionarioMudou(f, draft);
                          return (
                            <div key={f.id} className={`rounded-lg border p-2 ${mudou ? "border-primary bg-primary/5" : "border-border"}`}>
                              <div className="flex flex-col xl:flex-row xl:items-center gap-1.5">
                                <div className="flex items-start justify-between gap-2 xl:flex-1 min-w-0">
                                  <p className="text-xs font-semibold leading-tight break-words">{f.matricula ? `[${f.matricula}] ` : ""}{f.name}</p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {(() => {
                                      const risco = riscoFuncionarioStatus(draft.status);
                                      if (risco >= 2) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">CRÍTICO</span>;
                                      if (risco === 1) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ATENÇÃO</span>;
                                      return null;
                                    })()}
                                    {mudou && <span className="text-[10px] font-bold text-primary">ALTERADO</span>}
                                  </div>
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(142px,160px)] gap-1.5 w-full xl:w-[390px] 2xl:w-[440px] shrink-0">
                                  <Select value={draft.equipe || ""} onValueChange={(v) => atualizarFuncDraft(f.id, "equipe", v)}>
                                    <SelectTrigger className="h-8 min-w-0 text-xs" aria-label={`Equipe de ${f.name}`}><SelectValue placeholder="Equipe" /></SelectTrigger>
                                    <SelectContent>{equipeOptionsComFallback(draft.equipe).map(nome => <SelectItem key={`${f.id}-eq-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={draft.status || ""} onValueChange={(v) => atualizarFuncDraft(f.id, "status", v)}>
                                    <SelectTrigger className="h-8 min-w-0 text-xs" aria-label={`Status de ${f.name}`} title={getFuncStatusLabel(draft.status)}><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>{statusFuncOptionsComFallback(draft.status).map(s => <SelectItem key={`${f.id}-st-${s}`} value={s}>{getFuncStatusLabel(s)}</SelectItem>)}</SelectContent>
                                  </Select></div>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-muted-foreground">
                                <span>{f.role || "Função não informada"}</span>
                                <button type="button" className="text-primary hover:underline" onClick={() => abrirFuncionarioDaEquipe(f.id)}>Gerenciar pessoa</button>
                              </div>
                            </div>
                          );
                          })}
                        </section>)}
                      </div>
                    </div>

                    {/* Equipamentos */}
                    <div className="min-w-0 rounded-xl border border-border p-2.5 space-y-2 lg:flex lg:flex-col min-h-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold">{progEquipe === "__sem_equipe__" ? "Equipamentos sem equipe" : "Equipamentos da equipe"} ({equipamentosDaEquipeFiltrados.length}/{equipamentosDaEquipe.length})</h4>
                        </div>
                        <span className="text-xs text-muted-foreground">{equipMudancasPendentes} mudança(s)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(150px,180px)] 2xl:grid-cols-[minmax(0,1fr)_170px_auto] gap-1.5">
                        <Input className="h-8 min-w-0 text-xs"
                          value={equipSearch}
                          onChange={(e) => setEquipSearch(e.target.value)}
                          placeholder="Buscar por frota, tipo ou equipe..."
                        />
                        <Select value={filterEquipStatus} onValueChange={setFilterEquipStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS">Todos os status</SelectItem>
                            {STATUS_EQUIP_VALUES.map((s) => <SelectItem key={`fes-${s}`} value={s}>{getEquipStatusLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" className="h-8 text-xs" variant={onlyChangedEquip ? "default" : "outline"} onClick={() => setOnlyChangedEquip((v) => !v)}>
                          {onlyChangedEquip ? "Somente alterados: ON" : "Somente alterados"}
                        </Button>
                      </div>

                      <details className="rounded-lg border border-border/70 px-2.5 py-1.5">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Ações em lote · equipamentos</summary>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <Select value={bulkEquipEquipe} onValueChange={setBulkEquipEquipe}>
                          <SelectTrigger><SelectValue placeholder="Nova equipe" /></SelectTrigger>
                          <SelectContent>{equipesAtivas.map(nome => <SelectItem key={`be-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bulkEquipStatus} onValueChange={setBulkEquipStatus}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Novo status" /></SelectTrigger>
                          <SelectContent>{STATUS_EQUIP_VALUES.map((s) => <SelectItem key={`bes-${s}`} value={s}>{getEquipStatusLabel(s)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={aplicarLoteEquipamentos}>Aplicar lote (Equip.)</Button>
                        </div>
                      </details>

                      <div className="space-y-1.5 max-h-80 lg:max-h-[calc(100vh-330px)] overflow-auto pr-1">
                        {equipamentosDaEquipeFiltrados.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum equipamento encontrado com os filtros atuais.</p>
                        ) : gruposEquipamentos.map((group) => <section key={group.title} className="space-y-1.5" aria-label={group.title}>
                          <h5 className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-muted/70 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                            {group.title}<span className="font-normal tabular-nums text-muted-foreground">{group.items.length}</span>
                          </h5>
                          {group.items.map((eq) => {
                          const draft = equipDraft[eq.id] || { setor: eq.setor || "", status: normalizeEquipamentoStatus(eq.status) };
                          const mudou = equipamentoMudou(eq, draft);
                          return (
                            <div key={eq.id} className={`rounded-lg border p-2 ${mudou ? "border-primary bg-primary/5" : "border-border"}`}>
                              <div className="flex flex-col xl:flex-row xl:items-center gap-1.5">
                                <div className="flex items-start justify-between gap-2 xl:flex-1 min-w-0">
                                  <p className="text-xs font-semibold leading-tight break-words">{eq.frota} — {eq.tipo}</p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {(() => {
                                      const risco = riscoEquipStatus(draft.status);
                                      if (risco >= 2) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">CRÍTICO</span>;
                                      if (risco === 1) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ATENÇÃO</span>;
                                      return null;
                                    })()}
                                    {mudou && <span className="text-[10px] font-bold text-primary">ALTERADO</span>}
                                  </div>
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(142px,160px)] gap-1.5 w-full xl:w-[390px] 2xl:w-[440px] shrink-0">
                                  <Select value={draft.setor || ""} onValueChange={(v) => atualizarEquipDraft(eq.id, "setor", v)}>
                                    <SelectTrigger className="h-8 min-w-0 text-xs" aria-label={`Equipe do equipamento ${eq.frota || eq.tipo}`}><SelectValue placeholder="Equipe/Setor" /></SelectTrigger>
                                    <SelectContent>{equipeOptionsComFallback(draft.setor).map(nome => <SelectItem key={`${eq.id}-eq-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={draft.status || ""} onValueChange={(v) => atualizarEquipDraft(eq.id, "status", v)}>
                                    <SelectTrigger className="h-8 min-w-0 text-xs" aria-label={`Status do equipamento ${eq.frota || eq.tipo}`} title={getEquipStatusLabel(draft.status)}><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>{statusEquipOptionsComFallback(draft.status).map(s => <SelectItem key={`${eq.id}-st-${s}`} value={s}>{getEquipStatusLabel(s)}</SelectItem>)}</SelectContent>
                                  </Select></div>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                                <span>{(eq.condicao || "").toUpperCase() === "TERCEIRO" ? "Terceiro" : eq.condicao || "Condição não informada"}</span>
                                {(eq.condicao || "").toUpperCase() === "TERCEIRO" && <span>{eq.valor_mensal != null ? `${moeda(eq.valor_mensal)}/mês` : "Valor mensal não cadastrado"}</span>}
                                {eq.empresa_proprietaria && <span>{eq.empresa_proprietaria}</span>}
                                <button type="button" className="ml-auto text-primary hover:underline" onClick={() => abrirEquipamentoDaEquipe(eq.id)}>Gerenciar equipamento</button>
                              </div>
                            </div>
                          );
                          })}
                        </section>)}
                      </div>
                    </div>
                  </div>

                  {validationIssues.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">Resultado da validação</p>
                      <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                        {validationIssues.map((issue, idx) => (
                          <div key={`${issue.label}-${idx}`} className={`text-xs rounded-md px-2 py-1.5 border ${issue.level === "erro" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                            <p className="font-semibold">{issue.label}</p>
                            <p>{issue.detail}</p>
                          </div>
                        ))}
                      </div>

                      {hasBlockingIssues && canForceCurrentBlocking && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-2">
                          <label className="flex items-start gap-2 text-xs text-amber-800">
                            <input
                              type="checkbox"
                              checked={forceIntegracaoOverride}
                              onChange={(e) => setForceIntegracaoOverride(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              Forçar aplicação mesmo com bloqueios de integração ({forceableBlockingIssues.length})
                            </span>
                          </label>
                          {forceIntegracaoOverride && (
                            <div className="space-y-1">
                              <Label className="text-[11px] text-amber-900">Motivo obrigatório (mín. 12 caracteres)</Label>
                              <Textarea
                                rows={2}
                                value={forceReason}
                                onChange={(e) => setForceReason(e.target.value)}
                                placeholder="Ex.: operação emergencial aprovada pelo gestor"
                                className="text-xs"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {hasBlockingIssues && !canForceCurrentBlocking && (
                        <p className="text-xs text-red-700 font-semibold">
                          Existem bloqueios não-forçáveis (ex.: conflito de equipamento). Corrija antes de aplicar.
                        </p>
                      )}
                    </div>
                  )}

                  {lastApplySummary && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                      <p className="text-xs font-semibold text-emerald-800">Última aplicação</p>
                      <p className="text-xs text-emerald-700">
                        {new Date(lastApplySummary.when).toLocaleString("pt-BR")} • {lastApplySummary.funcionarios} funcionário(s) • {lastApplySummary.equipamentos} equipamento(s)
                        {lastApplySummary.avisos ? ` • ${lastApplySummary.avisos} aviso(s)` : ""}
                        {lastApplySummary.forcaramIntegracao ? " • COM OVERRIDE" : ""}
                      </p>
                      {lastApplySummary.forcaramIntegracao && lastApplySummary.motivo && (
                        <p className="text-xs text-emerald-800">Motivo: {lastApplySummary.motivo}</p>
                      )}
                    </div>
                  )}

                  {!modoReuniao && <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 lg:mt-auto">
                    <Button type="button" variant="outline" onClick={validarMudancasEquipe} disabled={validating || saving || !!cadastrosError || cadastrosLoading || (!funcMudancasPendentes && !equipMudancasPendentes)}>
                      {validating ? "Validando..." : "Validar alterações"}
                    </Button>
                    <Button
                      onClick={salvarMudancasEquipe}
                      disabled={
                        saving
                        || !!cadastrosError
                        || cadastrosLoading
                        || validating
                        || (!funcMudancasPendentes && !equipMudancasPendentes)
                        || (hasBlockingIssues && (!canForceCurrentBlocking || !forceIntegracaoOverride || !forceReasonValid))
                      }
                      className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90 gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Aplicando mudanças..." : `Validar e aplicar (${funcMudancasPendentes + equipMudancasPendentes})`}
                    </Button>
                  </div>}
                </>
              )}
            </div>
          </div>
        )}

        {/* As abas individuais listam os cadastros mestres; sem formulários de movimentação. */}
        {!modoReuniao && (aba === "funcionarios" || aba === "equipamentos") && (
          <div className="space-y-3">
          {aba === "funcionarios" && (
            <div>
              <Button type="button" variant="outline" size="sm" disabled={saving || !!cadastrosError || cadastrosLoading}
                onClick={() => { setModoFunc("admissao"); setShowAdmission(value => !value); }}>
                {showAdmission ? "Fechar nova admissão" : "+ Nova admissão"}
              </Button>
              {showAdmission && <div className="rounded-lg border border-border bg-card p-3 mt-2 space-y-2" aria-label="Nova admissão">
                <p className="font-semibold text-sm">Cadastrar funcionário no cadastro central</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs text-muted-foreground">Nome completo *
                    <Input className="mt-1 uppercase" value={novoNome} onChange={event => setNovoNome(event.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">Matrícula *
                    <Input className="mt-1" value={novaMatricula} onChange={event => setNovaMatricula(event.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">Função *
                    <Input className="mt-1 uppercase" value={novaFuncao} onChange={event => setNovaFuncao(event.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">Equipe *
                    <select className="block w-full h-10 mt-1 border border-input rounded-md bg-background px-2 text-sm text-foreground" value={novaEquipe} onChange={event => setNovaEquipe(event.target.value)}>
                      <option value="">Selecione a equipe</option>{equipesAtivas.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">Data de admissão *
                    <Input className="mt-1" type="date" value={novaAdmissao} onChange={event => setNovaAdmissao(event.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">Observações
                    <Input className="mt-1" value={novaObs} onChange={event => setNovaObs(event.target.value)} />
                  </label>
                </div>
                <Button type="button" size="sm" disabled={saving || !novoNome.trim() || !novaMatricula.trim() || !novaFuncao.trim() || !novaEquipe || !novaAdmissao}
                  onClick={salvarMovFunc}>{saving ? "Salvando..." : "Registrar admissão"}</Button>
                <p className="text-[11px] text-muted-foreground">Matrículas existentes exigem revisão humana. Se o cadastro for criado mas a auditoria falhar, não repita a admissão.</p>
              </div>}
            </div>
          )}
          <ProgramadorRoster
            key={aba}
            kind={aba}
            people={funcionarios}
            equipment={frota}
            teams={equipesAtivas}
            saving={saving || cadastrosLoading}
            error={cadastrosError}
            initialSelectedId={aba === "funcionarios" ? funcId : equipFrota}
            onSavePerson={salvarFuncionarioNaLista}
            onSaveEquipment={salvarEquipamentoNaLista}
            onSavePrice={salvarPrecoNaLista}
            onDirtyChange={setRosterDirty}
          />
          </div>
        )}

      </div>
    </div>
  );
}

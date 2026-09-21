// WF Programador — Gestão de equipes, funcionários e equipamentos
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Users, Wrench, Calendar, CalendarDays, ChevronRight, Save, Users2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { sortOgsData } from "@/hooks/useOgsReference";
import IntegracaoObrasCard from "@/components/IntegracaoObrasCard";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";

const STATUS_FUNC = ["TRABALHOU", "AFASTADO", "DISPOSIÇÃO", "FÉRIAS", "FALTA"];
const STATUS_EQUIP = ["OPERACIONAL", "MANUTENÇÃO", "INOPERANTE"];
const PERIODOS = ["NOTURNO", "DIURNO", "INTEGRAL"];

interface Equipe { id: string; nome: string; responsavel: string | null; }
interface Funcionario { id: string; name: string; matricula: string | null; role: string | null; equipe: string | null; status: string | null; company_id?: string | null; }
interface Frota { id: string; frota: string; tipo: string; setor: string | null; status?: string | null; company_id?: string | null; }
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
  const [funcObs, setFuncObs] = useState("");
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
  const [equipObs, setEquipObs] = useState("");

  useEffect(() => {
    let equipesQuery: any = (supabase as any).from("ci_equipes").select("*").eq("ativa", true).order("nome");
    if (companyId) equipesQuery = equipesQuery.eq("company_id", companyId);

    let funcionariosQuery: any = supabase.from("employees").select("id, name, matricula, role, equipe, status, company_id").order("name");
    if (companyId) funcionariosQuery = funcionariosQuery.eq("company_id", companyId);

    let frotaQuery: any = (supabase as any).from("equipamentos").select("id, frota, tipo, setor, status, company_id").order("tipo").order("frota");
    if (companyId) frotaQuery = frotaQuery.eq("company_id", companyId);

    let ogsQuery: any = (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address");
    if (companyId) ogsQuery = ogsQuery.eq("company_id", companyId);

    Promise.all([equipesQuery, funcionariosQuery, frotaQuery, ogsQuery]).then(([eqRes, funcRes, frotaRes, ogsRes]: any[]) => {
      if (eqRes?.data) setEquipes(eqRes.data);
      if (funcRes?.data) setFuncionarios(funcRes.data as Funcionario[]);
      if (frotaRes?.data) setFrota(frotaRes.data);
      if (ogsRes?.data) setOgsList(sortOgsData(ogsRes.data));
    });
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

  const handleEquipSelect = (frotaCod: string) => {
    setEquipFrota(frotaCod);
    const eq = frota.find((f) => f.frota === frotaCod);
    if (eq?.setor) setEquipEquipeOrig(eq.setor);
  };

  const equipesAtivas = useMemo(
    () => [...new Set((equipes || []).map((e) => (e.nome || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [equipes]
  );

  const equipeOptionsComFallback = (valorAtual?: string) => {
    const lista = [...equipesAtivas];
    const legado = (valorAtual || "").trim();
    if (legado && !lista.some((n) => n.toLowerCase() === legado.toLowerCase())) {
      lista.push(legado);
    }
    return [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const statusFuncOptionsComFallback = (valorAtual?: string) => {
    const lista = [...STATUS_FUNC];
    const legado = (valorAtual || "").trim();
    if (legado && !lista.some((n) => n.toLowerCase() === legado.toLowerCase())) lista.push(legado);
    return [...new Set(lista)];
  };

  const statusEquipOptionsComFallback = (valorAtual?: string) => {
    const lista = [...STATUS_EQUIP];
    const legado = (valorAtual || "").trim();
    if (legado && !lista.some((n) => n.toLowerCase() === legado.toLowerCase())) lista.push(legado);
    return [...new Set(lista)];
  };

  const equipeResponsavel = (nome: string) => equipes.find(e => e.nome === nome)?.responsavel ?? null;

  const funcionariosDaEquipe = useMemo(() => {
    if (!progEquipe) return [] as Funcionario[];
    const alvo = progEquipe.trim().toLowerCase();
    return funcionarios.filter((f) => (f.equipe || "").trim().toLowerCase() === alvo);
  }, [funcionarios, progEquipe]);

  const equipamentosDaEquipe = useMemo(() => {
    if (!progEquipe) return [] as Frota[];
    const alvo = progEquipe.trim().toLowerCase();
    return frota.filter((f) => (f.setor || "").trim().toLowerCase() === alvo);
  }, [frota, progEquipe]);

  const funcMudancasPendentes = useMemo(
    () => Object.entries(funcDraft).filter(([id, draft]) => {
      const atual = funcionarios.find((f) => f.id === id);
      if (!atual) return false;
      return (draft.equipe || "") !== (atual.equipe || "") || (draft.status || "") !== (atual.status || "");
    }).length,
    [funcDraft, funcionarios]
  );

  const equipMudancasPendentes = useMemo(
    () => Object.entries(equipDraft).filter(([id, draft]) => {
      const atual = frota.find((f) => f.id === id);
      if (!atual) return false;
      return (draft.setor || "") !== (atual.setor || "") || (draft.status || "") !== (atual.status || "");
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
      nextFunc[f.id] = { equipe: f.equipe || "", status: f.status || "TRABALHOU" };
    }

    const nextEquip: Record<string, EquipDraftChange> = {};
    for (const eq of equipamentosDaEquipe) {
      nextEquip[eq.id] = { setor: eq.setor || "", status: eq.status || "OPERACIONAL" };
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

  const atualizarFuncDraft = (id: string, campo: keyof FuncDraftChange, valor: string) => {
    setValidationIssues([]);
    setForceIntegracaoOverride(false);
    setForceReason("");
    setFuncDraft((prev) => ({
      ...prev,
      [id]: {
        equipe: prev[id]?.equipe ?? funcionarios.find((f) => f.id === id)?.equipe ?? "",
        status: prev[id]?.status ?? funcionarios.find((f) => f.id === id)?.status ?? "TRABALHOU",
        [campo]: valor,
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
        status: prev[id]?.status ?? frota.find((f) => f.id === id)?.status ?? "OPERACIONAL",
        [campo]: valor,
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
        const baseStatus = next[id]?.status ?? funcionarios.find((f) => f.id === id)?.status ?? "TRABALHOU";
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
        const baseStatus = next[id]?.status ?? frota.find((f) => f.id === id)?.status ?? "OPERACIONAL";
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

    const dataRef = progData || new Date().toISOString().slice(0, 10);

    const funcFinal = funcionariosDaEquipe.map((f) => ({
      ...f,
      finalEquipe: funcDraft[f.id]?.equipe ?? f.equipe ?? "",
      finalStatus: funcDraft[f.id]?.status ?? f.status ?? "TRABALHOU",
    }));

    const equipFinal = equipamentosDaEquipe.map((e) => ({
      ...e,
      finalSetor: equipDraft[e.id]?.setor ?? e.setor ?? "",
      finalStatus: equipDraft[e.id]?.status ?? e.status ?? "OPERACIONAL",
    }));

    const { data: progsMesmoPeriodo } = await (supabase as any)
      .from("ci_programacoes")
      .select("id, equipe, ogs, periodo, data, status_programacao, equipamentos_designados")
      .eq("data", dataRef)
      .eq("periodo", progPeriodo);

    const progsAtivas = (progsMesmoPeriodo || []).filter((p: any) => (p.status_programacao || "CONFIRMADO") !== "CANCELADO");

    const jaExisteEquipeMesmoPeriodo = progsAtivas.some((p: any) => (p.equipe || "").trim().toLowerCase() === (progEquipe || "").trim().toLowerCase());
    if (jaExisteEquipeMesmoPeriodo) {
      issues.push({
        level: "aviso",
        scope: "programacao",
        label: "Equipe já programada no período",
        detail: `Já existe programação para ${progEquipe} em ${dataRef} (${progPeriodo}).`,
      });
    }

    const equipOperacionais = equipFinal.filter((e) => (e.finalStatus || "").toUpperCase() === "OPERACIONAL");
    for (const eq of equipOperacionais) {
      const conflito = progsAtivas.find((p: any) => {
        const arr: string[] = Array.isArray(p.equipamentos_designados) ? p.equipamentos_designados : [];
        return arr.includes(eq.frota) && (p.equipe || "").trim().toLowerCase() !== (progEquipe || "").trim().toLowerCase();
      });
      if (conflito) {
        issues.push({
          level: "erro",
          scope: "equipamento",
          label: `Conflito de equipamento: ${eq.frota}`,
          detail: `Já designado para equipe ${conflito.equipe} no mesmo período (${dataRef} ${progPeriodo}).`,
        });
      }
    }

    if (progOgs && progOgs !== "SEM_OGS" && funcFinal.length > 0) {
      let obraQuery: any = (supabase as any)
        .from("sst_obras_integracao")
        .select("id, nome_obra")
        .ilike("nome_obra", `%OGS ${progOgs}%`)
        .limit(1);
      if (companyId) obraQuery = obraQuery.eq("company_id", companyId);
      const { data: obrasInt } = await obraQuery;

      const obra = obrasInt?.[0];
      if (!obra) {
        issues.push({
          level: "aviso",
          scope: "programacao",
          label: "Obra sem vínculo SST",
          detail: `Não foi encontrada obra de integração SST para OGS ${progOgs}.`,
        });
      } else {
        const funcIds = funcFinal.map((f) => f.id);
        let integQuery: any = (supabase as any)
          .from("sst_funcionarios_integracao")
          .select("funcionario_id, status_integracao, data_vencimento")
          .eq("obra_id", obra.id)
          .in("funcionario_id", funcIds);
        if (companyId) integQuery = integQuery.eq("company_id", companyId);
        const { data: integracoes } = await integQuery;

        const map = new Map<string, { status_integracao: string; data_vencimento: string | null }>();
        for (const i of integracoes || []) map.set(i.funcionario_id, i);

        for (const f of funcFinal) {
          const statusFinal = (f.finalStatus || "").toUpperCase();
          if (statusFinal !== "TRABALHOU") continue;
          const integ = map.get(f.id);
          if (!integ) {
            issues.push({
              level: "erro",
              scope: "funcionario",
              label: `Sem integração: ${f.name}`,
              detail: `Funcionário sem registro de integração para OGS ${progOgs}.`,
            });
            continue;
          }
          if ((integ.status_integracao || "").toLowerCase() !== "integrado") {
            issues.push({
              level: "erro",
              scope: "funcionario",
              label: `Integração pendente: ${f.name}`,
              detail: `Status atual na obra: ${integ.status_integracao || "pendente"}.`,
            });
          }
          if (integ.data_vencimento && new Date(integ.data_vencimento) < new Date()) {
            issues.push({
              level: "erro",
              scope: "funcionario",
              label: `Integração vencida: ${f.name}`,
              detail: `Validade expirada em ${integ.data_vencimento}.`,
            });
          }
        }
      }
    }

    setValidationIssues(issues);
    setValidating(false);

    if (issues.some((i) => i.level === "erro")) {
      toast({ title: "Validação encontrou bloqueios", description: "Corrija os erros destacados ou force com justificativa quando permitido.", variant: "destructive" });
      return { ok: false, issues };
    }

    toast({
      title: "✅ Validação concluída",
      description: issues.length ? `${issues.length} aviso(s) encontrados.` : "Nenhuma pendência encontrada.",
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
        const mudouStatus = (draft.status || "") !== (atual.status || "");
        if (!mudouEquipe && !mudouStatus) return null;
        return { atual, draft, mudouEquipe, mudouStatus };
      })
      .filter(Boolean) as Array<{ atual: Funcionario; draft: FuncDraftChange; mudouEquipe: boolean; mudouStatus: boolean }>;

    const equipUpdates = Object.entries(equipDraft)
      .map(([id, draft]) => {
        const atual = frota.find((f) => f.id === id);
        if (!atual) return null;
        const mudouSetor = (draft.setor || "") !== (atual.setor || "");
        const mudouStatus = (draft.status || "") !== (atual.status || "");
        if (!mudouSetor && !mudouStatus) return null;
        return { atual, draft, mudouSetor, mudouStatus };
      })
      .filter(Boolean) as Array<{ atual: Frota; draft: EquipDraftChange; mudouSetor: boolean; mudouStatus: boolean }>;

    if (!funcUpdates.length && !equipUpdates.length) {
      toast({ title: "Sem alterações", description: "Nenhuma mudança pendente para salvar." });
      return;
    }

    setSaving(true);

    const erros: string[] = [];

    for (const u of funcUpdates) {
      let q: any = supabase.from("employees").update({ equipe: u.draft.equipe || null, status: u.draft.status || null }).eq("id", u.atual.id);
      if (companyId) q = q.eq("company_id", companyId);
      const { error } = await q;
      if (error) erros.push(`Funcionário ${u.atual.name}: ${error.message}`);
    }

    for (const u of equipUpdates) {
      let q: any = (supabase as any).from("equipamentos").update({ setor: u.draft.setor || null, status: u.draft.status || null }).eq("id", u.atual.id);
      if (companyId) q = q.eq("company_id", companyId);
      const { error } = await q;
      if (error) erros.push(`Frota ${u.atual.frota}: ${error.message}`);
    }

    if (erros.length) {
      toast({ title: "Erro ao salvar mudanças", description: erros[0], variant: "destructive" });
      setSaving(false);
      return;
    }

    const dataMov = progData || new Date().toISOString().slice(0, 10);
    const overrideTag = forcedRun ? ` [FORÇADO INTEGRAÇÃO: ${forceReason.trim()}]` : "";

    const auditoriaFuncs = funcUpdates.map((u) => {
      const tipo = u.mudouEquipe && u.mudouStatus ? "transferencia_status" : u.mudouEquipe ? "transferencia" : "status";
      return (supabase as any).from("ci_mov_funcionarios").insert({
        data: dataMov,
        tipo,
        funcionario_id: u.atual.id,
        funcionario_nome: u.atual.name,
        matricula: u.atual.matricula || null,
        equipe_origem: u.atual.equipe || null,
        equipe_destino: u.draft.equipe || null,
        status: u.draft.status || null,
        obs: `Movimentação via WF Programador (Equipe: ${progEquipe || "-"})${overrideTag}`,
      });
    });

    const auditoriaEquips = equipUpdates.map((u) => {
      const tipo = u.mudouSetor && u.mudouStatus ? "transferencia_status" : u.mudouSetor ? "transferencia" : "status";
      return (supabase as any).from("ci_mov_equipamentos").insert({
        data: dataMov,
        tipo,
        frota: u.atual.frota,
        tipo_equipamento: u.atual.tipo || null,
        equipe_origem: u.atual.setor || null,
        equipe_destino: u.draft.setor || null,
        status: u.draft.status || null,
        responsavel_destino: equipeResponsavel(u.draft.setor || ""),
        obs: `Movimentação via WF Programador (Equipe: ${progEquipe || "-"})${overrideTag}`,
      });
    });

    const auditoriaRes = await Promise.allSettled([...auditoriaFuncs, ...auditoriaEquips]);
    const auditFalhas = auditoriaRes.filter((r) => r.status === "fulfilled" && (r as any).value?.error).length
      + auditoriaRes.filter((r) => r.status === "rejected").length;

    const avisosCount = validacao.issues.filter((i) => i.level === "aviso").length;

    toast({
      title: forcedRun ? "⚠️ Movimentações aplicadas com override" : "✅ Movimentações aplicadas",
      description: `${funcUpdates.length} funcionário(s) e ${equipUpdates.length} equipamento(s) atualizados${auditFalhas ? ` • ${auditFalhas} falha(s) na auditoria` : ""}${avisosCount ? ` • ${avisosCount} aviso(s)` : ""}.`,
      variant: auditFalhas ? "destructive" : "default",
    });

    // recarrega dados mestres
    let funcionariosQuery: any = supabase.from("employees").select("id, name, matricula, role, equipe, status, company_id").order("name");
    if (companyId) funcionariosQuery = funcionariosQuery.eq("company_id", companyId);

    let frotaQuery: any = (supabase as any).from("equipamentos").select("id, frota, tipo, setor, status, company_id").order("tipo").order("frota");
    if (companyId) frotaQuery = frotaQuery.eq("company_id", companyId);

    const [funcRes, frotaRes] = await Promise.all([funcionariosQuery, frotaQuery]);
    if (funcRes?.data) setFuncionarios(funcRes.data as Funcionario[]);
    if (frotaRes?.data) setFrota(frotaRes.data);

    setLastApplySummary({
      when: new Date().toISOString(),
      funcionarios: funcUpdates.length,
      equipamentos: equipUpdates.length,
      avisos: avisosCount,
      forcaramIntegracao: forcedRun,
      motivo: forcedRun ? forceReason.trim() : undefined,
    });
    setForceIntegracaoOverride(false);
    setForceReason("");

    setSaving(false);
  };

  // SALVAR PROGRAMAÇÃO DE EQUIPE
  const salvarProgramacao = async () => {
    if (!progEquipe || !progData) return;
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
      const { error } = await (supabase as any).from("ci_mov_funcionarios").insert({
        data: novaAdmissao, tipo: "admissao",
        funcionario_nome: novoNome.toUpperCase(), matricula: novaMatricula,
        equipe_destino: novaEquipe, funcao: novaFuncao.toUpperCase(),
        data_admissao: novaAdmissao, obs: novaObs || null,
      });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✅ Admissão registrada!" }); setNovoNome(""); setNovaMatricula(""); setNovaFuncao(""); setNovaEquipe(""); setNovaObs(""); }
      setSaving(false);
      return;
    }
    if (!funcNome) return;
    setSaving(true);
    const payload: any = {
      data: funcData, tipo: modoFunc,
      funcionario_id: funcId || null, funcionario_nome: funcNome,
      matricula: funcMatricula || null,
    };
    if (modoFunc === "status") payload.status = funcStatus;
    if (modoFunc === "transferencia") { payload.equipe_origem = funcEquipeOrig; payload.equipe_destino = funcEquipeDest; }
    if (modoFunc === "demissao") payload.obs = funcObs || null;
    payload.obs = funcObs || null;
    const { error } = await (supabase as any).from("ci_mov_funcionarios").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      if (funcId && (modoFunc === "status" || modoFunc === "transferencia")) {
        const updatePayload: any = {};
        if (modoFunc === "status") updatePayload.status = funcStatus || null;
        if (modoFunc === "transferencia") updatePayload.equipe = funcEquipeDest || null;
        let q: any = supabase.from("employees").update(updatePayload).eq("id", funcId);
        if (companyId) q = q.eq("company_id", companyId);
        const { error: upErr } = await q;
        if (upErr) {
          toast({ title: "Movimentação registrada, mas sem sincronizar cadastro", description: upErr.message, variant: "destructive" });
        }
      }

      toast({ title: "✅ Movimentação registrada!" });
      setFuncId(""); setFuncNome(""); setFuncMatricula(""); setFuncStatus(""); setFuncEquipeOrig(""); setFuncEquipeDest(""); setFuncObs("");
    }
    setSaving(false);
  };

  // SALVAR MOVIMENTAÇÃO EQUIPAMENTO
  const salvarMovEquip = async () => {
    if (!equipFrota) return;
    setSaving(true);
    const frotaInfo = frota.find(f => f.frota === equipFrota);
    const payload: any = {
      data: equipData, tipo: modoEquip,
      frota: equipFrota, tipo_equipamento: frotaInfo?.tipo || null,
      obs: equipObs || null,
    };
    if (modoEquip === "status") payload.status = equipStatus;
    if (modoEquip === "transferencia") {
      payload.equipe_origem = equipEquipeOrig;
      payload.equipe_destino = equipEquipeDest;
      payload.responsavel_destino = equipeResponsavel(equipEquipeDest);
    }
    const { error } = await (supabase as any).from("ci_mov_equipamentos").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const updatePayload: any = {};
      if (modoEquip === "status") updatePayload.status = equipStatus || null;
      if (modoEquip === "transferencia") updatePayload.setor = equipEquipeDest || null;
      let q: any = (supabase as any).from("equipamentos").update(updatePayload).eq("frota", equipFrota);
      if (companyId) q = q.eq("company_id", companyId);
      const { error: upErr } = await q;
      if (upErr) {
        toast({ title: "Movimentação registrada, mas sem sincronizar cadastro", description: upErr.message, variant: "destructive" });
      }

      toast({ title: "✅ Movimentação registrada!" });
      setEquipFrota(""); setEquipStatus(""); setEquipEquipeOrig(""); setEquipEquipeDest(""); setEquipObs("");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <LogoHomeButton className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">WF Programador</h1>
            <p className="text-xs text-white/70">Equipes · Funcionários · Equipamentos</p>
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
      <div className="flex border-b border-border bg-card sticky top-[68px] z-40">
        {([
          { id: "equipes", label: "Equipes", icon: Calendar },
          { id: "funcionarios", label: "Funcionários", icon: Users },
          { id: "equipamentos", label: "Equipamentos", icon: Wrench },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-bold transition-colors border-b-2 ${
              aba === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-5 pb-10 space-y-4">

        {/* ── ABA EQUIPES ── */}
        {aba === "equipes" && (
          <div className="space-y-4">

            {/* Card destaque: Programação de Obras */}
            <button
              onClick={() => navigate(`/programador/programacao-noturna${origemQuery}`)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
            >
              <CalendarDays className="w-6 h-6 shrink-0" />
              <div className="text-left flex-1">
                <span className="text-sm font-bold block">Programação de Obras</span>
                <span className="text-xs opacity-80">Planejar equipes, equipamentos e carretas</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>

            <p className="text-xs text-muted-foreground">Programe uma equipe inteira de uma vez. Todos os funcionários da equipe receberão essa localização.</p>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data *</Label>
                  <Input type="date" value={progData} onChange={e => setProgData(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período</Label>
                  <Select value={progPeriodo} onValueChange={setProgPeriodo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PERIODOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Equipe *</Label>
                <Select value={progEquipe} onValueChange={setProgEquipe}>
                  <SelectTrigger><SelectValue placeholder="Selecione a equipe/setor" /></SelectTrigger>
                  <SelectContent>{equipesAtivas.map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                </Select>
                {progEquipe && equipeResponsavel(progEquipe) && (
                  <p className="text-xs text-muted-foreground pl-1">Responsável: {equipeResponsavel(progEquipe)}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Status da equipe</Label>
                <Select value={progStatus} onValueChange={setProgStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_FUNC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>OGS</Label>
                <Select value={progOgs} onValueChange={handleOgsChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione a OGS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEM_OGS">Sem OGS</SelectItem>
                    {ogsList.map(o => <SelectItem key={o.ogs_number} value={o.ogs_number}>OGS {o.ogs_number} — {o.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Rua específica se OGS tiver múltiplos endereços */}
              {progOgs && (() => {
                const o = ogsList.find(o => o.ogs_number === progOgs);
                const ruas = o ? splitRuas(o.location_address) : [];
                if (ruas.length <= 1) return progCliente ? <p className="text-xs text-muted-foreground">📍 {progLocal}</p> : null;
                return (
                  <div className="space-y-1.5">
                    <Label>Rua específica</Label>
                    <Select value={progRua} onValueChange={v => { setProgRua(v); setProgLocal(v); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione a rua" /></SelectTrigger>
                      <SelectContent>{ruas.map((r, i) => <SelectItem key={i} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={progObs} onChange={e => setProgObs(e.target.value)} placeholder="Opcional..." />
              </div>

              <Button onClick={salvarProgramacao} disabled={saving || !progEquipe || !progData}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : "✅ Salvar Programação"}
              </Button>
            </div>

            {/* Painel operacional por equipe (Pessoas + Equipamentos) */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Gestão da equipe selecionada</h3>
                  <p className="text-xs text-muted-foreground">Altere equipe e status de pessoas e equipamentos com aplicação imediata.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Pendências</p>
                  <p className="text-sm font-bold text-primary">{funcMudancasPendentes + equipMudancasPendentes}</p>
                </div>
              </div>

              {!progEquipe ? (
                <p className="text-xs text-muted-foreground">Selecione uma equipe acima para visualizar os membros e equipamentos vinculados.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {/* Funcionários */}
                    <div className="rounded-xl border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users2 className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold">Pessoas da equipe ({funcionariosDaEquipe.length})</h4>
                        </div>
                        <span className="text-xs text-muted-foreground">{funcMudancasPendentes} mudança(s)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Select value={bulkFuncEquipe} onValueChange={setBulkFuncEquipe}>
                          <SelectTrigger><SelectValue placeholder="Lote: nova equipe" /></SelectTrigger>
                          <SelectContent>{equipesAtivas.map(nome => <SelectItem key={`bf-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bulkFuncStatus} onValueChange={setBulkFuncStatus}>
                          <SelectTrigger><SelectValue placeholder="Lote: novo status" /></SelectTrigger>
                          <SelectContent>{STATUS_FUNC.map(s => <SelectItem key={`bfs-${s}`} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={aplicarLoteFuncionarios}>Aplicar lote (Pessoas)</Button>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-auto pr-1">
                        {funcionariosDaEquipe.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum funcionário vinculado a esta equipe.</p>
                        ) : funcionariosDaEquipe.map((f) => {
                          const draft = funcDraft[f.id] || { equipe: f.equipe || "", status: f.status || "TRABALHOU" };
                          const mudou = (draft.equipe || "") !== (f.equipe || "") || (draft.status || "") !== (f.status || "");
                          return (
                            <div key={f.id} className={`rounded-lg border p-2 ${mudou ? "border-primary bg-primary/5" : "border-border"}`}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-xs font-semibold truncate">{f.matricula ? `[${f.matricula}] ` : ""}{f.name}</p>
                                {mudou && <span className="text-[10px] font-bold text-primary">ALTERADO</span>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Select value={draft.equipe || ""} onValueChange={(v) => atualizarFuncDraft(f.id, "equipe", v)}>
                                  <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
                                  <SelectContent>{equipeOptionsComFallback(draft.equipe).map(nome => <SelectItem key={`${f.id}-eq-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={draft.status || ""} onValueChange={(v) => atualizarFuncDraft(f.id, "status", v)}>
                                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                  <SelectContent>{statusFuncOptionsComFallback(draft.status).map(s => <SelectItem key={`${f.id}-st-${s}`} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Equipamentos */}
                    <div className="rounded-xl border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold">Equipamentos da equipe ({equipamentosDaEquipe.length})</h4>
                        </div>
                        <span className="text-xs text-muted-foreground">{equipMudancasPendentes} mudança(s)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Select value={bulkEquipEquipe} onValueChange={setBulkEquipEquipe}>
                          <SelectTrigger><SelectValue placeholder="Lote: nova equipe" /></SelectTrigger>
                          <SelectContent>{equipesAtivas.map(nome => <SelectItem key={`be-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={bulkEquipStatus} onValueChange={setBulkEquipStatus}>
                          <SelectTrigger><SelectValue placeholder="Lote: novo status" /></SelectTrigger>
                          <SelectContent>{STATUS_EQUIP.map(s => <SelectItem key={`bes-${s}`} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={aplicarLoteEquipamentos}>Aplicar lote (Equip.)</Button>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-auto pr-1">
                        {equipamentosDaEquipe.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum equipamento vinculado a esta equipe.</p>
                        ) : equipamentosDaEquipe.map((eq) => {
                          const draft = equipDraft[eq.id] || { setor: eq.setor || "", status: eq.status || "OPERACIONAL" };
                          const mudou = (draft.setor || "") !== (eq.setor || "") || (draft.status || "") !== (eq.status || "");
                          return (
                            <div key={eq.id} className={`rounded-lg border p-2 ${mudou ? "border-primary bg-primary/5" : "border-border"}`}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-xs font-semibold truncate">{eq.frota} — {eq.tipo}</p>
                                {mudou && <span className="text-[10px] font-bold text-primary">ALTERADO</span>}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Select value={draft.setor || ""} onValueChange={(v) => atualizarEquipDraft(eq.id, "setor", v)}>
                                  <SelectTrigger><SelectValue placeholder="Equipe/Setor" /></SelectTrigger>
                                  <SelectContent>{equipeOptionsComFallback(draft.setor).map(nome => <SelectItem key={`${eq.id}-eq-${nome}`} value={nome}>{nome}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={draft.status || ""} onValueChange={(v) => atualizarEquipDraft(eq.id, "status", v)}>
                                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                  <SelectContent>{statusEquipOptionsComFallback(draft.status).map(s => <SelectItem key={`${eq.id}-st-${s}`} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={validarMudancasEquipe} disabled={validating || saving || (!funcMudancasPendentes && !equipMudancasPendentes)}>
                      {validating ? "Validando..." : "Validar alterações"}
                    </Button>
                    <Button
                      onClick={salvarMudancasEquipe}
                      disabled={
                        saving
                        || validating
                        || (!funcMudancasPendentes && !equipMudancasPendentes)
                        || (hasBlockingIssues && (!canForceCurrentBlocking || !forceIntegracaoOverride || !forceReasonValid))
                      }
                      className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90 gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Aplicando mudanças..." : `Validar e aplicar (${funcMudancasPendentes + equipMudancasPendentes})`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ABA FUNCIONÁRIOS ── */}
        {aba === "funcionarios" && (
          <div className="space-y-4">
            {/* Tipo de movimentação */}
            <div className="flex gap-2 flex-wrap">
              {([
                { id: "status", label: "Mudar Status" },
                { id: "transferencia", label: "Transferir" },
                { id: "admissao", label: "Admissão" },
                { id: "demissao", label: "Demissão" },
              ] as const).map(m => (
                <button key={m.id} onClick={() => setModoFunc(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    modoFunc === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">

              {/* ADMISSÃO — campos diferentes */}
              {modoFunc === "admissao" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome completo *</Label>
                    <Input placeholder="NOME DO FUNCIONÁRIO" value={novoNome} onChange={e => setNovoNome(e.target.value)} className="uppercase" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Matrícula *</Label>
                      <Input placeholder="000000" value={novaMatricula} onChange={e => setNovaMatricula(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de admissão *</Label>
                      <Input type="date" value={novaAdmissao} onChange={e => setNovaAdmissao(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Função *</Label>
                    <Input placeholder="FUNÇÃO" value={novaFuncao} onChange={e => setNovaFuncao(e.target.value)} className="uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Equipe *</Label>
                    <Select value={novaEquipe} onValueChange={setNovaEquipe}>
                      <SelectTrigger><SelectValue placeholder="Selecione a equipe/setor" /></SelectTrigger>
                      <SelectContent>{equipesAtivas.map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Opcional..." />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input type="date" value={funcData} onChange={e => setFuncData(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Funcionário *</Label>
                    <Select value={funcId} onValueChange={handleFuncSelect}>
                      <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                      <SelectContent>
                        {funcionarios.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.matricula ? `[${f.matricula}] ` : ""}{f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {modoFunc === "status" && (
                    <div className="space-y-1.5">
                      <Label>Novo status *</Label>
                      <Select value={funcStatus} onValueChange={setFuncStatus}>
                        <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                        <SelectContent>{STATUS_FUNC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {modoFunc === "transferencia" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>De</Label>
                        <Select value={funcEquipeOrig} onValueChange={setFuncEquipeOrig}>
                          <SelectTrigger><SelectValue placeholder="Equipe/Setor atual" /></SelectTrigger>
                          <SelectContent>{equipeOptionsComFallback(funcEquipeOrig).map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Para</Label>
                        <Select value={funcEquipeDest} onValueChange={setFuncEquipeDest}>
                          <SelectTrigger><SelectValue placeholder="Nova equipe/setor" /></SelectTrigger>
                          <SelectContent>{equipesAtivas.map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {modoFunc === "demissao" && (
                    <p className="text-xs text-destructive font-medium">⚠️ Registrará demissão para {funcNome || "o funcionário selecionado"}</p>
                  )}

                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={funcObs} onChange={e => setFuncObs(e.target.value)} placeholder="Opcional..." />
                  </div>
                </>
              )}

              <Button onClick={salvarMovFunc}
                disabled={saving || (modoFunc === "admissao" ? (!novoNome || !novaMatricula || !novaFuncao || !novaEquipe) : !funcNome)}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : `✅ Registrar ${modoFunc === "admissao" ? "Admissão" : modoFunc === "demissao" ? "Demissão" : "Movimentação"}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── ABA EQUIPAMENTOS ── */}
        {aba === "equipamentos" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {([
                { id: "transferencia", label: "Transferir" },
                { id: "status", label: "Mudar Status" },
              ] as const).map(m => (
                <button key={m.id} onClick={() => setModoEquip(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    modoEquip === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={equipData} onChange={e => setEquipData(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Equipamento (Frota) *</Label>
                <Select value={equipFrota} onValueChange={handleEquipSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    {frota.map(f => <SelectItem key={f.id} value={f.frota}>{f.frota} — {f.tipo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {modoEquip === "status" && (
                <div className="space-y-1.5">
                  <Label>Novo status *</Label>
                  <Select value={equipStatus} onValueChange={setEquipStatus}>
                    <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                    <SelectContent>{STATUS_EQUIP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {modoEquip === "transferencia" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>De</Label>
                    <Select value={equipEquipeOrig} onValueChange={setEquipEquipeOrig}>
                      <SelectTrigger><SelectValue placeholder="Equipe/Setor atual" /></SelectTrigger>
                      <SelectContent>{equipeOptionsComFallback(equipEquipeOrig).map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Para</Label>
                    <Select value={equipEquipeDest} onValueChange={setEquipEquipeDest}>
                      <SelectTrigger><SelectValue placeholder="Nova equipe/setor" /></SelectTrigger>
                      <SelectContent>{equipesAtivas.map(nome => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {equipEquipeDest && equipeResponsavel(equipEquipeDest) && (
                <p className="text-xs text-muted-foreground pl-1">Responsável destino: {equipeResponsavel(equipEquipeDest)}</p>
              )}

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={equipObs} onChange={e => setEquipObs(e.target.value)} placeholder="Opcional..." />
              </div>

              <Button onClick={salvarMovEquip} disabled={saving || !equipFrota}
                className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90">
                {saving ? "Salvando..." : "✅ Registrar Movimentação"}
              </Button>
            </div>
          </div>
        )}

        <IntegracaoObrasCard />
      </div>
    </div>
  );
}

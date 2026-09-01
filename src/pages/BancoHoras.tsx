/**
 * BancoHoras — Saldo por funcionário
 *
 * Modo A (preferencial): resumo importado de jornada (ponto_he_resumo_mensal)
 * Modo B (fallback): cálculo a partir de ponto_registros
 */
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Search, FileSpreadsheet, Lock, Unlock, ChevronLeft, ChevronRight, RotateCcw, X, Printer, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Funcionario { id: string; nome: string; funcao: string; matricula: string; }
interface Registro {
  id?: string;
  staff_id: string;
  data: string;
  hora: string;
  tipo: string;
  turno: string | null;
  metodo?: string | null;
}

interface SaldoFuncionario {
  funcionario: Funcionario;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
  diasTrabalhados: number;
}

interface AjusteSnapshot {
  he_70_horas: number;
  he_100_horas: number;
  total_horas_extras_horas: number;
  credito_horas: number;
  debito_horas: number;
  at: string;
  by?: string | null;
  motivo?: string | null;
}

interface AjusteDiario {
  data: string;
  he70_reducao: number;
  he100_reducao: number;
  motivo: string;
  at: string;
  by?: string | null;
  entrada1_antes?: string;
  saida1_antes?: string;
  entrada2_antes?: string;
  saida2_antes?: string;
  entrada1_depois?: string;
  saida1_depois?: string;
  entrada2_depois?: string;
  saida2_depois?: string;
  he_dia_antes?: number;
  he_dia_depois?: number;
}

interface LinhaHistoricoDiario {
  data: string;
  entrada1Id?: string | null;
  saida1Id?: string | null;
  entrada2Id?: string | null;
  saida2Id?: string | null;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  entrada1Original: string;
  saida1Original: string;
  entrada2Original: string;
  saida2Original: string;
  horasOriginais: number;
  horasTrabalhadas: number;
  saldoEstimado: number;
  motivo: string;
}

interface ResumoImportado {
  id: string;
  employee_id?: string | null;
  colaborador_nome: string;
  equipe_nome: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  credito_horas: number;
  debito_horas: number;
  horas_normais: number;
  he_70_horas: number;
  he_100_horas: number;
  adicional_noturno_horas: number;
  total_horas_extras_horas: number;
  payload?: {
    he_manual?: {
      initial?: AjusteSnapshot;
      last?: AjusteSnapshot;
      history?: AjusteSnapshot[];
      daily_adjustments?: AjusteDiario[];
    };
    he_before?: {
      he_70_horas?: number;
      he_100_horas?: number;
      total_horas_extras_horas?: number;
      credito_horas?: number;
      debito_horas?: number;
      at?: string;
      source?: string;
    };
    [key: string]: any;
  } | null;
}

interface CompetenciaStatus {
  status: "aberto" | "fechado";
  observacao: string | null;
  fechado_em: string | null;
  reaberto_em: string | null;
}

type FiltroSaldo = "TODOS" | "POSITIVOS" | "NEGATIVOS";
interface ResumoImportadoEnriquecido extends ResumoImportado {
  equipe_label: string;
  funcao_label: string;
  saldo: number;
}

interface ComparativoAjuste {
  colaborador: string;
  equipe: string;
  funcao: string;
  he70_antes: number;
  he70_depois: number;
  he100_antes: number;
  he100_depois: number;
  total_antes: number;
  total_depois: number;
  reducao_total: number;
  credito_antes: number;
  credito_depois: number;
  debito_antes: number;
  debito_depois: number;
  atualizado_em: string;
  motivo: string;
}

function fmtHoras(h: number): string {
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  const sinal = h < 0 ? "-" : h > 0 ? "+" : "";
  return `${sinal}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function fmtDec(v: number): string {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtDateTime(dt: string | null): string {
  if (!dt) return "";
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeText(v: string): string {
  return (v || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function parseHorasInput(v: string): number {
  const raw = String(v || "").trim();
  if (!raw) return NaN;

  const clean = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/\s+/g, "");

  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
}

function eachDateIso(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function fmtHoraCurta(hora: string | null | undefined): string {
  if (!hora) return "-";
  const [h, m] = hora.split(":");
  if (h == null || m == null) return "-";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function normalizarHoraInput(v: string): string | null {
  const raw = String(v || "").trim();
  if (!raw || raw === "-") return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function horaOuTraco(v?: string | null): string {
  if (!v || v === "-") return "-";
  return normalizarHoraInput(v) || "-";
}

function calcHorasPorBatidasDiretas(entrada1: string, saida1: string, entrada2: string, saida2: string): number {
  const pares: Array<[string, string]> = [];
  const p1e = normalizarHoraInput(entrada1);
  const p1s = normalizarHoraInput(saida1);
  const p2e = normalizarHoraInput(entrada2);
  const p2s = normalizarHoraInput(saida2);
  if (p1e && p1s) pares.push([p1e, p1s]);
  if (p2e && p2s) pares.push([p2e, p2s]);
  if (pares.length === 0) return 0;

  let totalMin = 0;
  for (const [ent, sai] of pares) {
    let diff = toMin(sai) - toMin(ent);
    if (diff < 0) diff += 24 * 60;
    totalMin += diff;
  }
  return Number((totalMin / 60).toFixed(2));
}

function calcHorasTrabalhadasPorDia(regs: Registro[]): number {
  const entradas = regs.filter((r) => r.tipo === "entrada").sort((a, b) => a.hora.localeCompare(b.hora));
  const saidas = regs.filter((r) => r.tipo === "saida").sort((a, b) => a.hora.localeCompare(b.hora));
  return calcHorasPorBatidasDiretas(
    entradas[0]?.hora || "",
    saidas[0]?.hora || "",
    entradas[1]?.hora || "",
    saidas[1]?.hora || "",
  );
}

function extrairBatidasPorDia(regs: Registro[]): {
  entrada1Id?: string | null;
  saida1Id?: string | null;
  entrada2Id?: string | null;
  saida2Id?: string | null;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
} {
  const entradas = regs.filter((r) => r.tipo === "entrada").sort((a, b) => a.hora.localeCompare(b.hora));
  const saidas = regs.filter((r) => r.tipo === "saida").sort((a, b) => a.hora.localeCompare(b.hora));
  return {
    entrada1Id: entradas[0]?.id || null,
    saida1Id: saidas[0]?.id || null,
    entrada2Id: entradas[1]?.id || null,
    saida2Id: saidas[1]?.id || null,
    entrada1: fmtHoraCurta(entradas[0]?.hora),
    saida1: fmtHoraCurta(saidas[0]?.hora),
    entrada2: fmtHoraCurta(entradas[1]?.hora),
    saida2: fmtHoraCurta(saidas[1]?.hora),
  };
}

export default function BancoHoras() {
  const goBack = useSmartBack("/rh");
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [resumosImportados, setResumosImportados] = useState<ResumoImportado[]>([]);
  const [competenciaStatus, setCompetenciaStatus] = useState<CompetenciaStatus>({ status: "aberto", observacao: null, fechado_em: null, reaberto_em: null });

  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const competenciaAtual = `${mes}-01`;

  const [jornadaPadrao, setJornadaPadrao] = useState(8);
  const [busca, setBusca] = useState("");
  const [equipeFiltro, setEquipeFiltro] = useState<string>("TODAS");
  const [funcaoFiltro, setFuncaoFiltro] = useState<string>("TODAS");
  const [saldoFiltro, setSaldoFiltro] = useState<FiltroSaldo>("TODOS");
  const [loading, setLoading] = useState(false);
  const [loadingFechamento, setLoadingFechamento] = useState(false);
  const [rolePerfil, setRolePerfil] = useState<{ role: string | null; perfil: string | null }>({ role: null, perfil: null });
  const [salvandoAjusteId, setSalvandoAjusteId] = useState<string | null>(null);
  const [historicoAbertoId, setHistoricoAbertoId] = useState<string | null>(null);
  const [historicoDias, setHistoricoDias] = useState<LinhaHistoricoDiario[]>([]);
  const [loadingHistoricoId, setLoadingHistoricoId] = useState<string | null>(null);

  useEffect(() => {
    const loadAcl = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;

      const { data } = await (supabase as any)
        .from("profiles")
        .select("role, perfil")
        .eq("user_id", uid)
        .maybeSingle();

      if (data) {
        setRolePerfil({ role: data.role ?? null, perfil: data.perfil ?? null });
      }
    };
    loadAcl();
  }, []);

  const canManageFechamento = useMemo(() => {
    const role = (rolePerfil.role || "").toLowerCase();
    const perfil = rolePerfil.perfil || "";
    if (role === "superadmin" || role === "admin") return true;
    return ["Administrador", "Gerente", "RH", "Gestão de Pessoas"].includes(perfil);
  }, [rolePerfil]);

  const canManageAjustes = canManageFechamento;

  const labelCompetencia = useMemo(() => {
    const [ano, mesNum] = mes.split("-").map(Number);
    const dt = new Date(ano, (mesNum || 1) - 1, 1);
    return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [mes]);

  const irMesAtual = () => {
    const now = new Date();
    setMes(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  };

  const navegarMes = (delta: number) => {
    const [ano, mesNum] = mes.split("-").map(Number);
    const dt = new Date(ano, (mesNum || 1) - 1 + delta, 1);
    setMes(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };

  const carregarDados = async () => {
    if (!mes || !profile?.company_id) return;
    setLoading(true);

    const [y, m] = mes.split("-");
    const ini = `${y}-${m}-01`;
    const fim = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;

    // 1) Tenta resumo importado (PDF)
    const { data: imported } = await (supabase as any)
      .from("ponto_he_resumo_mensal")
      .select("id, employee_id, colaborador_nome, equipe_nome, periodo_inicio, periodo_fim, credito_horas, debito_horas, horas_normais, he_70_horas, he_100_horas, adicional_noturno_horas, total_horas_extras_horas, payload")
      .eq("company_id", profile.company_id)
      .eq("competencia", ini)
      .order("colaborador_nome", { ascending: true });

    setResumosImportados((imported || []) as ResumoImportado[]);

    // 2) Status da competência (aberto/fechado)
    const { data: statusData } = await (supabase as any)
      .from("ponto_he_competencias")
      .select("status, observacao, fechado_em, reaberto_em")
      .eq("company_id", profile.company_id)
      .eq("competencia", ini)
      .maybeSingle();

    if (statusData?.status) {
      setCompetenciaStatus({
        status: statusData.status,
        observacao: statusData.observacao || null,
        fechado_em: statusData.fechado_em || null,
        reaberto_em: statusData.reaberto_em || null,
      });
    } else {
      setCompetenciaStatus({ status: "aberto", observacao: null, fechado_em: null, reaberto_em: null });
    }

    // 3) Fallback para cálculo no ponto bruto
    const { data: regs } = await (supabase as any)
      .from("ponto_registros")
      .select("id, staff_id, data, hora, tipo, turno, metodo")
      .eq("company_id", profile.company_id)
      .gte("data", ini)
      .lte("data", fim)
      .order("data")
      .order("hora");

    if (regs) setRegistros(regs);
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.company_id) return;
    (supabase as any)
      .from("employees")
      .select("id, name, role, matricula, status")
      .eq("company_id", profile.company_id)
      .eq("status", "ativo")
      .order("name")
      .then(({ data }: any) => {
        if (data) {
          setFuncionarios(
            data.map((f: any) => ({ id: f.id, nome: f.name, funcao: f.role ?? "", matricula: f.matricula ?? "" }))
          );
        }
      });
  }, [profile?.company_id]);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, profile?.company_id]);

  const fecharCompetencia = async () => {
    if (!profile?.company_id) return;
    if (!window.confirm(`Confirmar FECHAMENTO da competência ${mes}?`)) return;

    setLoadingFechamento(true);
    const { error } = await (supabase as any).rpc("fn_ponto_he_fechar_competencia", {
      p_company_id: profile.company_id,
      p_competencia: competenciaAtual,
      p_observacao: `Fechado via UI em ${new Date().toISOString()}`,
    });

    if (error) {
      toast({ title: "Erro ao fechar competência", description: error.message, variant: "destructive" });
      setLoadingFechamento(false);
      return;
    }

    toast({ title: "✅ Competência fechada com sucesso" });
    await carregarDados();
    setLoadingFechamento(false);
  };

  const reabrirCompetencia = async () => {
    if (!profile?.company_id) return;
    if (!window.confirm(`Confirmar REABERTURA da competência ${mes}?`)) return;

    setLoadingFechamento(true);
    const { error } = await (supabase as any).rpc("fn_ponto_he_reabrir_competencia", {
      p_company_id: profile.company_id,
      p_competencia: competenciaAtual,
      p_observacao: `Reaberto via UI em ${new Date().toISOString()}`,
    });

    if (error) {
      toast({ title: "Erro ao reabrir competência", description: error.message, variant: "destructive" });
      setLoadingFechamento(false);
      return;
    }

    toast({ title: "✅ Competência reaberta com sucesso" });
    await carregarDados();
    setLoadingFechamento(false);
  };

  const saldosCalculados = useMemo((): SaldoFuncionario[] => {
    const byFunc = new Map<string, Map<string, Registro[]>>();
    for (const r of registros) {
      if (!byFunc.has(r.staff_id)) byFunc.set(r.staff_id, new Map());
      const byData = byFunc.get(r.staff_id)!;
      if (!byData.has(r.data)) byData.set(r.data, []);
      byData.get(r.data)!.push(r);
    }

    return funcionarios
      .map((func) => {
        const byData = byFunc.get(func.id);
        if (!byData) return { funcionario: func, horasTrabalhadas: 0, horasPrevistas: 0, saldo: 0, diasTrabalhados: 0 };

        let totalMin = 0;
        let diasTrabalhados = 0;

        for (const [, regs] of byData) {
          const entradas = regs.filter((r) => r.tipo === "entrada").sort((a, b) => a.hora.localeCompare(b.hora));
          const saidas = regs.filter((r) => r.tipo === "saida").sort((a, b) => a.hora.localeCompare(b.hora));
          const pairs = Math.min(entradas.length, saidas.length);
          if (pairs === 0) continue;
          diasTrabalhados++;
          for (let i = 0; i < pairs; i++) {
            let diff = toMin(saidas[i].hora) - toMin(entradas[i].hora);
            if (diff < 0) diff += 24 * 60;
            totalMin += diff;
          }
        }

        const horasTrabalhadas = totalMin / 60;
        const horasPrevistas = diasTrabalhados * jornadaPadrao;
        const saldo = horasTrabalhadas - horasPrevistas;
        return { funcionario: func, horasTrabalhadas, horasPrevistas, saldo, diasTrabalhados };
      })
      .filter((s) => s.diasTrabalhados > 0 || busca);
  }, [funcionarios, registros, jornadaPadrao, busca]);

  const temImportado = resumosImportados.length > 0;

  const funcaoByNome = useMemo(() => {
    return new Map(funcionarios.map((f) => [normalizeText(f.nome), f.funcao || "Sem função"]));
  }, [funcionarios]);

  const resumosEnriquecidos = useMemo<ResumoImportadoEnriquecido[]>(() => {
    return resumosImportados.map((r) => {
      const equipe = (r.equipe_nome || "Sem equipe").trim();
      const funcao = funcaoByNome.get(normalizeText(r.colaborador_nome)) || "Sem função";
      const saldo = Number(r.credito_horas || 0) - Number(r.debito_horas || 0);
      return {
        ...r,
        equipe_label: equipe,
        funcao_label: funcao,
        saldo,
      };
    });
  }, [resumosImportados, funcaoByNome]);

  const employeeIdByNome = useMemo(() => {
    return new Map(funcionarios.map((f) => [normalizeText(f.nome), f.id]));
  }, [funcionarios]);

  const aliasColaboradorParaEmployee = useMemo(() => new Map<string, string>([
    [normalizeText("RAFAEL DAVID MATOS DOS SANTOS"), normalizeText("RAFAEL DAVID M DOS SANTOS")],
  ]), []);

  const resolverEmployeeId = (r: ResumoImportadoEnriquecido): string | undefined => {
    if (r.employee_id) return r.employee_id;
    const direto = employeeIdByNome.get(normalizeText(r.colaborador_nome));
    if (direto) return direto;
    const alias = aliasColaboradorParaEmployee.get(normalizeText(r.colaborador_nome));
    if (!alias) return undefined;
    return employeeIdByNome.get(alias);
  };

  const abrirHistoricoDiario = async (r: ResumoImportadoEnriquecido) => {
    if (!profile?.company_id) return;

    const employeeId = resolverEmployeeId(r);
    if (!employeeId) {
      toast({ title: "Funcionário sem vínculo", description: "Não foi possível localizar o employee_id para este colaborador.", variant: "destructive" });
      return;
    }

    const inicio = r.periodo_inicio || `${mes}-01`;
    const fim = r.periodo_fim || `${mes}-${new Date(Number(mes.split("-")[0]), Number(mes.split("-")[1]), 0).getDate()}`;

    setLoadingHistoricoId(r.id);

    const { data, error } = await (supabase as any)
      .from("ponto_registros")
      .select("id, staff_id, data, hora, tipo, turno, metodo")
      .eq("company_id", profile.company_id)
      .eq("staff_id", employeeId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data")
      .order("hora");

    if (error) {
      toast({ title: "Erro ao abrir histórico", description: error.message, variant: "destructive" });
      setLoadingHistoricoId(null);
      return;
    }

    const regs = (data || []) as Registro[];
    const byDate = new Map<string, Registro[]>();
    for (const reg of regs) {
      const arr = byDate.get(reg.data) || [];
      arr.push(reg);
      byDate.set(reg.data, arr);
    }

    const ajustesExistentes = (r.payload?.he_manual?.daily_adjustments || []) as AjusteDiario[];
    const ajusteMap = new Map(ajustesExistentes.map((a) => [a.data, a]));

    const linhas = eachDateIso(inicio, fim).map((dataIso) => {
      const regsDia = byDate.get(dataIso) || [];
      const horasDia = calcHorasTrabalhadasPorDia(regsDia);
      const saldoEstimado = Number((horasDia - jornadaPadrao).toFixed(2));
      const ajuste = ajusteMap.get(dataIso);
      const batidas = extrairBatidasPorDia(regsDia);
      return {
        data: dataIso,
        entrada1Id: batidas.entrada1Id,
        saida1Id: batidas.saida1Id,
        entrada2Id: batidas.entrada2Id,
        saida2Id: batidas.saida2Id,
        entrada1: batidas.entrada1,
        saida1: batidas.saida1,
        entrada2: batidas.entrada2,
        saida2: batidas.saida2,
        entrada1Original: batidas.entrada1,
        saida1Original: batidas.saida1,
        entrada2Original: batidas.entrada2,
        saida2Original: batidas.saida2,
        horasOriginais: horasDia,
        horasTrabalhadas: horasDia,
        saldoEstimado,
        motivo: ajuste?.motivo || "",
      };
    });

    setHistoricoDias(linhas);
    setHistoricoAbertoId(r.id);
    setLoadingHistoricoId(null);
  };

  const salvarAjustePorDia = async (r: ResumoImportadoEnriquecido) => {
    if (!profile?.company_id) return;
    if (!canManageAjustes) {
      toast({ title: "Sem permissão para ajustar H.E.", variant: "destructive" });
      return;
    }
    if (competenciaStatus.status === "fechado") {
      toast({ title: "Competência fechada", description: "Reabra a competência para ajustar horas.", variant: "destructive" });
      return;
    }

    const employeeId = resolverEmployeeId(r);
    if (!employeeId) {
      toast({ title: "Funcionário sem vínculo", description: "Não foi possível localizar o employee_id para este colaborador.", variant: "destructive" });
      return;
    }

    setSalvandoAjusteId(r.id);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || null;
      const nowIso = new Date().toISOString();

      const payloadAtual = (r.payload || {}) as Record<string, any>;
      const manualAtual = (payloadAtual.he_manual || {}) as {
        initial?: AjusteSnapshot;
        history?: AjusteSnapshot[];
        daily_adjustments?: AjusteDiario[];
      };

      const initial: AjusteSnapshot = manualAtual.initial || {
        he_70_horas: Number(r.he_70_horas || 0),
        he_100_horas: Number(r.he_100_horas || 0),
        total_horas_extras_horas: Number(r.total_horas_extras_horas || 0),
        credito_horas: Number(r.credito_horas || 0),
        debito_horas: Number(r.debito_horas || 0),
        at: nowIso,
        motivo: "Snapshot inicial para ajuste por batidas",
      };

      let heAntesTotal = 0;
      let heDepoisTotal = 0;
      let diasAlterados = 0;
      const ajustesLimpos: AjusteDiario[] = [];

      for (const linha of historicoDias) {
        const nEntrada1 = normalizarHoraInput(linha.entrada1);
        const nSaida1 = normalizarHoraInput(linha.saida1);
        const nEntrada2 = normalizarHoraInput(linha.entrada2);
        const nSaida2 = normalizarHoraInput(linha.saida2);

        for (const [label, valor] of [["1ª Entrada", linha.entrada1], ["1ª Saída", linha.saida1], ["2ª Entrada", linha.entrada2], ["2ª Saída", linha.saida2]] as Array<[string, string]>) {
          const raw = String(valor || "").trim();
          if (raw && raw !== "-" && !normalizarHoraInput(raw)) {
            toast({ title: "Hora inválida", description: `${fmtDate(linha.data)} · ${label} inválida. Use HH:MM.`, variant: "destructive" });
            return;
          }
        }

        if ((Boolean(nEntrada1) !== Boolean(nSaida1)) || (Boolean(nEntrada2) !== Boolean(nSaida2))) {
          toast({ title: "Par incompleto", description: `${fmtDate(linha.data)} deve ter entrada e saída no mesmo par.`, variant: "destructive" });
          return;
        }

        const novaHoraDia = calcHorasPorBatidasDiretas(nEntrada1 || "", nSaida1 || "", nEntrada2 || "", nSaida2 || "");

        const antesE1 = normalizarHoraInput(linha.entrada1Original);
        const antesS1 = normalizarHoraInput(linha.saida1Original);
        const antesE2 = normalizarHoraInput(linha.entrada2Original);
        const antesS2 = normalizarHoraInput(linha.saida2Original);

        const mudou = (antesE1 || "") !== (nEntrada1 || "")
          || (antesS1 || "") !== (nSaida1 || "")
          || (antesE2 || "") !== (nEntrada2 || "")
          || (antesS2 || "") !== (nSaida2 || "");

        heAntesTotal += Math.max(Number(linha.horasOriginais || 0) - jornadaPadrao, 0);
        heDepoisTotal += Math.max(novaHoraDia - jornadaPadrao, 0);

        if (!mudou) continue;

        const motivo = (linha.motivo || "").trim();
        if (motivo.length < 3) {
          toast({ title: "Motivo obrigatório", description: `Preencha motivo na data ${fmtDate(linha.data)}.`, variant: "destructive" });
          return;
        }

        const aplicarBatidas = async (tipo: "entrada" | "saida", ids: Array<string | null | undefined>, novas: Array<string | null>) => {
          const atuais = ids.filter((v): v is string => Boolean(v));
          const alvo = novas.filter((v): v is string => Boolean(v));
          const totalOps = Math.max(atuais.length, alvo.length);

          for (let i = 0; i < totalOps; i += 1) {
            const idAtual = atuais[i];
            const horaAlvo = alvo[i];

            if (idAtual && horaAlvo) {
              const { error: errUpd } = await (supabase as any)
                .from("ponto_registros")
                .update({ hora: `${horaAlvo}:00`, metodo: "ajuste_manual_banco_horas" })
                .eq("id", idAtual)
                .eq("company_id", profile.company_id);
              if (errUpd) throw new Error(errUpd.message);
            } else if (idAtual && !horaAlvo) {
              const { error: errDel } = await (supabase as any)
                .from("ponto_registros")
                .delete()
                .eq("id", idAtual)
                .eq("company_id", profile.company_id);
              if (errDel) throw new Error(errDel.message);
            } else if (!idAtual && horaAlvo) {
              const { error: errIns } = await (supabase as any)
                .from("ponto_registros")
                .insert({
                  staff_id: employeeId,
                  tipo,
                  data: linha.data,
                  hora: `${horaAlvo}:00`,
                  turno: null,
                  company_id: profile.company_id,
                  metodo: "ajuste_manual_banco_horas",
                });
              if (errIns) throw new Error(errIns.message);
            }
          }
        };

        await aplicarBatidas("entrada", [linha.entrada1Id, linha.entrada2Id], [nEntrada1, nEntrada2]);
        await aplicarBatidas("saida", [linha.saida1Id, linha.saida2Id], [nSaida1, nSaida2]);

        const heAntesDia = Math.max(Number(linha.horasOriginais || 0) - jornadaPadrao, 0);
        const heDepoisDia = Math.max(novaHoraDia - jornadaPadrao, 0);

        ajustesLimpos.push({
          data: linha.data,
          he70_reducao: 0,
          he100_reducao: 0,
          motivo,
          at: nowIso,
          by: uid,
          entrada1_antes: horaOuTraco(linha.entrada1Original),
          saida1_antes: horaOuTraco(linha.saida1Original),
          entrada2_antes: horaOuTraco(linha.entrada2Original),
          saida2_antes: horaOuTraco(linha.saida2Original),
          entrada1_depois: horaOuTraco(nEntrada1),
          saida1_depois: horaOuTraco(nSaida1),
          entrada2_depois: horaOuTraco(nEntrada2),
          saida2_depois: horaOuTraco(nSaida2),
          he_dia_antes: Number(heAntesDia.toFixed(2)),
          he_dia_depois: Number(heDepoisDia.toFixed(2)),
        });

        diasAlterados += 1;
      }

      if (diasAlterados === 0) {
        toast({ title: "Sem alterações", description: "Nenhuma batida foi alterada." });
        setSalvandoAjusteId(null);
        return;
      }

      const heBase70 = Number(initial.he_70_horas || 0);
      const heBase100 = Number(initial.he_100_horas || 0);
      const heBaseTotal = Number((heBase70 + heBase100).toFixed(2));
      const share70 = heBaseTotal > 0 ? heBase70 / heBaseTotal : 0.5;

      const deltaHeTotal = Number((heDepoisTotal - heAntesTotal).toFixed(2));
      const delta70 = Number((deltaHeTotal * share70).toFixed(2));
      const delta100 = Number((deltaHeTotal - delta70).toFixed(2));

      const he70Novo = Number((heBase70 + delta70).toFixed(2));
      const he100Novo = Number((heBase100 + delta100).toFixed(2));

      if (he70Novo < 0 || he100Novo < 0) {
        toast({
          title: "Ajuste inválido",
          description: "As alterações de batida reduziram H.E. abaixo de zero. Revise os horários editados.",
          variant: "destructive",
        });
        return;
      }

      const totalNovo = Number((he70Novo + he100Novo).toFixed(2));
      const last: AjusteSnapshot = {
        he_70_horas: he70Novo,
        he_100_horas: he100Novo,
        total_horas_extras_horas: totalNovo,
        credito_horas: Number(r.credito_horas || 0),
        debito_horas: Number(r.debito_horas || 0),
        at: nowIso,
        by: uid,
        motivo: `Ajuste por batidas (${diasAlterados} dias alterados)` ,
      };

      const payloadNovo = {
        ...payloadAtual,
        he_manual: {
          ...manualAtual,
          initial,
          last,
          history: [...(Array.isArray(manualAtual.history) ? manualAtual.history : []), last],
          daily_adjustments: ajustesLimpos,
        },
      };

      const { error } = await (supabase as any)
        .from("ponto_he_resumo_mensal")
        .update({
          he_70_horas: he70Novo,
          he_100_horas: he100Novo,
          total_horas_extras_horas: totalNovo,
          payload: payloadNovo,
        })
        .eq("id", r.id)
        .eq("company_id", profile.company_id);

      if (error) throw new Error(error.message);

      const variacao = Number((totalNovo - Number(initial.total_horas_extras_horas || 0)).toFixed(2));
      toast({
        title: "✅ Histórico salvo",
        description: `${r.colaborador_nome}: H.E. total ${variacao >= 0 ? "aumentou" : "reduziu"} ${fmtDec(Math.abs(variacao))} h após edição das batidas.`,
      });

      setHistoricoAbertoId(null);
      setHistoricoDias([]);
      await carregarDados();
    } catch (e: any) {
      toast({ title: "Erro ao salvar histórico", description: e?.message || "Falha ao aplicar ajustes de batida.", variant: "destructive" });
    } finally {
      setSalvandoAjusteId(null);
    }
  };

  const equipesDisponiveis = useMemo(() => {
    return Array.from(new Set(resumosEnriquecidos.map((r) => r.equipe_label))).sort();
  }, [resumosEnriquecidos]);

  const funcoesDisponiveis = useMemo(() => {
    const base = equipeFiltro === "TODAS"
      ? resumosEnriquecidos
      : resumosEnriquecidos.filter((r) => r.equipe_label === equipeFiltro);
    return Array.from(new Set(base.map((r) => r.funcao_label))).sort();
  }, [resumosEnriquecidos, equipeFiltro]);

  useEffect(() => {
    if (equipeFiltro !== "TODAS" && !equipesDisponiveis.includes(equipeFiltro)) {
      setEquipeFiltro("TODAS");
    }
  }, [equipesDisponiveis, equipeFiltro]);

  useEffect(() => {
    if (funcaoFiltro !== "TODAS" && !funcoesDisponiveis.includes(funcaoFiltro)) {
      setFuncaoFiltro("TODAS");
    }
  }, [funcoesDisponiveis, funcaoFiltro]);

  const importadosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return resumosEnriquecidos.filter((r) => {
      const matchEquipe = equipeFiltro === "TODAS" || r.equipe_label === equipeFiltro;
      const matchFuncao = funcaoFiltro === "TODAS" || r.funcao_label === funcaoFiltro;
      const matchSaldo = saldoFiltro === "TODOS"
        ? true
        : saldoFiltro === "POSITIVOS"
          ? r.saldo > 0
          : r.saldo < 0;

      if (!matchEquipe || !matchFuncao || !matchSaldo) return false;
      if (!q) return true;

      return [r.colaborador_nome, r.equipe_label, r.funcao_label].join(" ").toLowerCase().includes(q);
    });
  }, [resumosEnriquecidos, busca, equipeFiltro, funcaoFiltro, saldoFiltro]);

  const totalCredito = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.credito_horas || 0), 0), [importadosFiltrados]);
  const totalDebito = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.debito_horas || 0), 0), [importadosFiltrados]);
  const totalHE = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.total_horas_extras_horas || 0), 0), [importadosFiltrados]);

  const filtradosCalc = busca.trim()
    ? saldosCalculados.filter((s) => {
      const matchBusca = s.funcionario.nome.toLowerCase().includes(busca.toLowerCase()) || s.funcionario.matricula?.includes(busca);
      const matchSaldo = saldoFiltro === "TODOS"
        ? true
        : saldoFiltro === "POSITIVOS"
          ? s.saldo > 0
          : s.saldo < 0;
      return matchBusca && matchSaldo;
    })
    : saldosCalculados.filter((s) => {
      if (saldoFiltro === "TODOS") return true;
      if (saldoFiltro === "POSITIVOS") return s.saldo > 0;
      return s.saldo < 0;
    });

  const totalPositivo = saldosCalculados.filter((s) => s.saldo > 0).reduce((acc, s) => acc + s.saldo, 0);
  const totalNegativo = saldosCalculados.filter((s) => s.saldo < 0).reduce((acc, s) => acc + s.saldo, 0);

  const totalBaseAtual = temImportado ? resumosImportados.length : saldosCalculados.length;
  const totalFiltradoAtual = temImportado ? importadosFiltrados.length : filtradosCalc.length;
  const equipeSelecionada = equipeFiltro !== "TODAS";

  const comparativoAjustes = useMemo<ComparativoAjuste[]>(() => {
    return resumosEnriquecidos
      .map((r) => {
        const initial = r.payload?.he_manual?.initial;
        const last = r.payload?.he_manual?.last;
        if (!initial || !last) return null;

        const totalAntes = Number(initial.total_horas_extras_horas || 0);
        const totalDepois = Number(last.total_horas_extras_horas || 0);
        const reducao = Number((totalAntes - totalDepois).toFixed(2));
        if (reducao <= 0) return null;

        return {
          colaborador: r.colaborador_nome,
          equipe: r.equipe_label,
          funcao: r.funcao_label,
          he70_antes: Number(initial.he_70_horas || 0),
          he70_depois: Number(last.he_70_horas || 0),
          he100_antes: Number(initial.he_100_horas || 0),
          he100_depois: Number(last.he_100_horas || 0),
          total_antes: totalAntes,
          total_depois: totalDepois,
          reducao_total: reducao,
          credito_antes: Number(initial.credito_horas || 0),
          credito_depois: Number(last.credito_horas || 0),
          debito_antes: Number(initial.debito_horas || 0),
          debito_depois: Number(last.debito_horas || 0),
          atualizado_em: last.at || "",
          motivo: last.motivo || "Ajuste manual de H.E.",
        };
      })
      .filter((v): v is ComparativoAjuste => Boolean(v))
      .sort((a, b) => a.colaborador.localeCompare(b.colaborador));
  }, [resumosEnriquecidos]);

  const exportarComparativoExcel = async () => {
    if (!profile?.company_id || importadosFiltrados.length === 0) return;

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const selecionados = importadosFiltrados
      .map((r) => ({ r, staff_id: resolverEmployeeId(r) }))
      .filter((x) => Boolean(x.staff_id));

    if (selecionados.length === 0) {
      toast({ title: "Sem vínculo de funcionário", description: "Não foi possível vincular os colaboradores filtrados ao cadastro de funcionários.", variant: "destructive" });
      return;
    }

    const staffIds = Array.from(new Set(selecionados.map((x) => x.staff_id as string)));
    const ini = selecionados
      .map((x) => x.r.periodo_inicio || `${mes}-01`)
      .sort()[0];
    const fim = selecionados
      .map((x) => x.r.periodo_fim || competenciaAtual)
      .sort()
      .reverse()[0];

    const { data: regsData, error: regsError } = await (supabase as any)
      .from("ponto_registros")
      .select("staff_id, data, hora, tipo")
      .eq("company_id", profile.company_id)
      .in("staff_id", staffIds)
      .gte("data", ini)
      .lte("data", fim)
      .order("staff_id")
      .order("data")
      .order("hora");

    if (regsError) {
      toast({ title: "Erro ao gerar relatório", description: regsError.message, variant: "destructive" });
      return;
    }

    const regs = (regsData || []) as Registro[];
    const byStaffDate = new Map<string, Registro[]>();
    for (const rg of regs) {
      const key = `${rg.staff_id}|${rg.data}`;
      const arr = byStaffDate.get(key) || [];
      arr.push(rg);
      byStaffDate.set(key, arr);
    }

    const jornada = jornadaPadrao;
    const detalheRows: Array<Record<string, any>> = [];
    const resumoRows: Array<Record<string, any>> = [];

    for (const { r, staff_id } of selecionados) {
      const inicio = r.periodo_inicio || `${mes}-01`;
      const fimColab = r.periodo_fim || competenciaAtual;
      const datas = eachDateIso(inicio, fimColab);
      const freqTurno = new Map<string, number>();
      const ajustesDiarios = Array.isArray(r.payload?.he_manual?.daily_adjustments)
        ? (r.payload?.he_manual?.daily_adjustments as AjusteDiario[])
        : [];
      const ajustePorData = new Map(ajustesDiarios.map((a) => [a.data, a]));

      const initial = r.payload?.he_manual?.initial;
      const heBefore = r.payload?.he_before;
      const he70Antes = Number(initial?.he_70_horas ?? heBefore?.he_70_horas ?? r.he_70_horas);
      const he100Antes = Number(initial?.he_100_horas ?? heBefore?.he_100_horas ?? r.he_100_horas);
      const heTotalAntes = Number(initial?.total_horas_extras_horas ?? heBefore?.total_horas_extras_horas ?? (he70Antes + he100Antes));
      const he70Atual = Number(Number(r.he_70_horas || 0).toFixed(2));
      const he100Atual = Number(Number(r.he_100_horas || 0).toFixed(2));
      const heTotalAtual = Number(Number(r.total_horas_extras_horas || 0).toFixed(2));
      const fatorAproxAntes = heTotalAtual > 0 ? Number((heTotalAntes / heTotalAtual).toFixed(4)) : 1;

      for (const dataIso of datas) {
        const diaRegs = byStaffDate.get(`${staff_id}|${dataIso}`) || [];
        const batidas = extrairBatidasPorDia(diaRegs);
        const horas = calcHorasTrabalhadasPorDia(diaRegs);
        const heDia = Number(Math.max(horas - jornada, 0).toFixed(2));

        const ajusteDia = ajustePorData.get(dataIso);
        const possuiAntesReal = Boolean(
          ajusteDia && (
            ajusteDia.entrada1_antes ||
            ajusteDia.saida1_antes ||
            ajusteDia.entrada2_antes ||
            ajusteDia.saida2_antes ||
            ajusteDia.he_dia_antes !== undefined
          )
        );

        const heDiaAntesAprox = Number((heDia * fatorAproxAntes).toFixed(2));
        const usarAprox = !possuiAntesReal && heTotalAntes > 0;

        const entradaAntes = possuiAntesReal
          ? horaOuTraco(ajusteDia?.entrada1_antes)
          : usarAprox
            ? batidas.entrada1
            : "sem snapshot";
        const saidaAntes = possuiAntesReal
          ? horaOuTraco(ajusteDia?.saida1_antes)
          : usarAprox
            ? batidas.saida1
            : "sem snapshot";
        const entrada2Antes = possuiAntesReal
          ? horaOuTraco(ajusteDia?.entrada2_antes)
          : usarAprox
            ? batidas.entrada2
            : "sem snapshot";
        const saida2Antes = possuiAntesReal
          ? horaOuTraco(ajusteDia?.saida2_antes)
          : usarAprox
            ? batidas.saida2
            : "sem snapshot";
        const heDiaAntes = possuiAntesReal
          ? Number(Number(ajusteDia?.he_dia_antes || 0).toFixed(2))
          : usarAprox
            ? heDiaAntesAprox
            : "sem snapshot";

        const entradaRef = batidas.entrada1 === "-" ? "" : batidas.entrada1;
        const saidaRef = batidas.saida1 === "-" ? "" : batidas.saida1;
        if (entradaRef || saidaRef) {
          const chaveTurno = `${entradaRef}-${saidaRef}`;
          freqTurno.set(chaveTurno, (freqTurno.get(chaveTurno) || 0) + 1);
        }

        detalheRows.push({
          Colaborador: r.colaborador_nome,
          Equipe: r.equipe_label,
          Data: fmtDate(dataIso),
          "Entrada antes": entradaAntes,
          "Saída antes": saidaAntes,
          "2ª Entrada antes": entrada2Antes,
          "2ª Saída antes": saida2Antes,
          "H.E. dia antes": heDiaAntes,
          "Entrada atualizada": batidas.entrada1,
          "Saída atualizada": batidas.saida1,
          "2ª Entrada": batidas.entrada2,
          "2ª Saída": batidas.saida2,
          "Horas trabalhadas (dia)": Number(horas.toFixed(2)),
          "H.E. dia": heDia,
          "Antes disponível": possuiAntesReal ? "SIM" : usarAprox ? "APROX" : "NÃO",
        });
      }

      const turnoMaisFrequente = Array.from(freqTurno.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      const [entradaPadrao, saidaPadrao] = turnoMaisFrequente.includes("-") ? turnoMaisFrequente.split("-") : ["-", "-"];

      resumoRows.push({
        Colaborador: r.colaborador_nome,
        Equipe: r.equipe_label,
        Função: r.funcao_label,
        "HE total antes (70%+100%)": Number(heTotalAntes.toFixed(2)),
        "HE 70% antes": Number(he70Antes.toFixed(2)),
        "HE 100% antes": Number(he100Antes.toFixed(2)),
        "HE 70% atualizada": he70Atual,
        "HE 100% atualizada": he100Atual,
        "HE total atualizada (70%+100%)": heTotalAtual,
        "Diferença HE total (atual - antes)": Number((heTotalAtual - heTotalAntes).toFixed(2)),
        "Entrada padrão atualizada": entradaPadrao || "-",
        "Saída padrão atualizada": saidaPadrao || "-",
        "Fonte horas antes": initial ? "payload.he_manual.initial" : heBefore ? "payload.he_before" : "sem_snapshot",
      });
    }

    const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
    wsResumo["!cols"] = Object.keys(resumoRows[0] || {}).map((k) => ({ wch: Math.max(18, k.length + 2) }));
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Nome a Nome");

    const wsDetalhe = XLSX.utils.json_to_sheet(detalheRows);
    wsDetalhe["!cols"] = Object.keys(detalheRows[0] || {}).map((k) => ({ wch: Math.max(16, k.length + 2) }));
    XLSX.utils.book_append_sheet(wb, wsDetalhe, "Batidas Atualizadas");

    XLSX.writeFile(wb, `WF_BancoHoras_Relatorio_Ajustado_${mes}.xlsx`);
  };

  const exportarComparativoPdf = () => {
    if (comparativoAjustes.length === 0) return;

    const totalAntes = Number(comparativoAjustes.reduce((a, b) => a + b.total_antes, 0).toFixed(2));
    const totalDepois = Number(comparativoAjustes.reduce((a, b) => a + b.total_depois, 0).toFixed(2));
    const reducaoTotal = Number(comparativoAjustes.reduce((a, b) => a + b.reducao_total, 0).toFixed(2));

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas - Antes/Depois ${mes}</title><style>
      body{font-family:Arial,sans-serif;padding:16px;color:#111827;font-size:12px}
      h1{font-size:18px;color:#1d4ed8;margin:0 0 6px 0}
      p{margin:2px 0 10px 0;color:#374151}
      .kpi{display:flex;gap:8px;margin:10px 0 12px 0}
      .kpi div{border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;min-width:150px}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}
      th{background:#f3f4f6}
      td.num{text-align:right}
      @media print{body{padding:8px}}
    </style></head><body>`;

    html += `<h1>Banco de Horas — Comparativo Antes/Depois</h1>`;
    html += `<p><strong>Competência:</strong> ${mes} (${fmtDate(competenciaAtual)})</p>`;
    html += `<div class="kpi">
      <div><strong>Colaboradores ajustados</strong><br/>${comparativoAjustes.length}</div>
      <div><strong>HE Antes</strong><br/>${fmtDec(totalAntes)} h</div>
      <div><strong>HE Depois</strong><br/>${fmtDec(totalDepois)} h</div>
      <div><strong>Redução Total</strong><br/>${fmtDec(reducaoTotal)} h</div>
    </div>`;

    html += `<table><tr>
      <th>Colaborador</th><th>Equipe/Função</th>
      <th>HE 70 Antes</th><th>HE 70 Depois</th>
      <th>HE 100 Antes</th><th>HE 100 Depois</th>
      <th>Total Antes</th><th>Total Depois</th><th>Redução</th><th>Motivo</th><th>Ajustado em</th>
    </tr>`;

    comparativoAjustes.forEach((r) => {
      html += `<tr>
        <td>${r.colaborador}</td>
        <td>${r.equipe} · ${r.funcao}</td>
        <td class="num">${fmtDec(r.he70_antes)}</td>
        <td class="num">${fmtDec(r.he70_depois)}</td>
        <td class="num">${fmtDec(r.he100_antes)}</td>
        <td class="num">${fmtDec(r.he100_depois)}</td>
        <td class="num">${fmtDec(r.total_antes)}</td>
        <td class="num">${fmtDec(r.total_depois)}</td>
        <td class="num">${fmtDec(r.reducao_total)}</td>
        <td>${r.motivo}</td>
        <td>${fmtDateTime(r.atualizado_em)}</td>
      </tr>`;
    });

    html += `</table></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Banco de Horas</h1>
          <p className="text-[10px] text-primary-foreground/70">
            {temImportado ? "Resumo importado da Jornada (Pontomais)" : "Saldo mensal por funcionário"}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-10">
        <div className="sticky top-[58px] z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-2 space-y-3 border-b border-border/40">
          {/* Navegação de competência mais intuitiva */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
            <button
              type="button"
              onClick={() => navegarMes(-1)}
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-secondary hover:bg-muted flex items-center justify-center"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <label className="flex-1 h-9 rounded-lg border border-border bg-secondary px-3 flex items-center justify-center text-sm font-semibold capitalize cursor-pointer">
              {labelCompetencia}
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={() => navegarMes(1)}
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-secondary hover:bg-muted flex items-center justify-center"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={irMesAtual}
              className="h-9 px-3 shrink-0 rounded-lg border border-border bg-secondary hover:bg-muted text-xs font-semibold flex items-center gap-1"
              aria-label="Ir para mês atual"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Atual
            </button>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={temImportado ? "Buscar colaborador/equipe..." : "Buscar funcionário..."}
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2 top-2 h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filtros suspensos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Equipe</label>
              <select
                value={equipeFiltro}
                onChange={(e) => {
                  const valor = e.target.value;
                  setEquipeFiltro(valor);
                  setFuncaoFiltro("TODAS");
                }}
                className="w-full mt-1 h-8 bg-transparent text-sm outline-none"
              >
                <option value="TODAS">Todas as equipes</option>
                {equipesDisponiveis.map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Função</label>
              <select
                value={funcaoFiltro}
                onChange={(e) => setFuncaoFiltro(e.target.value)}
                disabled={!equipeSelecionada}
                className="w-full mt-1 h-8 bg-transparent text-sm outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="TODAS">
                  {equipeSelecionada ? "Todas as funções" : "Selecione uma equipe primeiro"}
                </option>
                {equipeSelecionada && funcoesDisponiveis.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {!equipeSelecionada && (
                <p className="text-[10px] text-muted-foreground mt-1">Escolha a equipe para liberar as funções.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Saldo</label>
              <select
                value={saldoFiltro}
                onChange={(e) => setSaldoFiltro(e.target.value as FiltroSaldo)}
                className="w-full mt-1 h-8 bg-transparent text-sm outline-none"
              >
                <option value="TODOS">Todos</option>
                <option value="POSITIVOS">Somente positivos</option>
                <option value="NEGATIVOS">Somente negativos</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Mostrando <b>{totalFiltradoAtual}</b> de <b>{totalBaseAtual}</b></span>
            <button
              type="button"
              onClick={() => {
                setEquipeFiltro("TODAS");
                setFuncaoFiltro("TODAS");
                setSaldoFiltro("TODOS");
                setBusca("");
              }}
              className="underline underline-offset-2"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Fechamento da competência */}
        <div className={`rounded-xl border p-3 ${competenciaStatus.status === "fechado" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                {competenciaStatus.status === "fechado" ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-green-600" />}
                Competência {mes} — {competenciaStatus.status === "fechado" ? "FECHADA" : "ABERTA"}
              </p>
              <p className="text-xs text-muted-foreground">
                {competenciaStatus.status === "fechado"
                  ? `Fechada em ${fmtDateTime(competenciaStatus.fechado_em)}`
                  : competenciaStatus.reaberto_em
                    ? `Reaberta em ${fmtDateTime(competenciaStatus.reaberto_em)}`
                    : "Ainda sem fechamento"}
              </p>
            </div>

            {canManageFechamento && (
              <div>
                {competenciaStatus.status === "aberto" ? (
                  <Button size="sm" onClick={fecharCompetencia} disabled={loadingFechamento} className="bg-red-600 hover:bg-red-700">
                    <Lock className="w-3.5 h-3.5 mr-1" /> Fechar Competência
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={reabrirCompetencia} disabled={loadingFechamento}>
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Reabrir Competência
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {temImportado ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <p className="text-base font-bold text-green-700">{fmtDec(totalCredito)} h</p>
                <p className="text-[10px] text-green-600">Crédito total</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-base font-bold text-red-600">{fmtDec(totalDebito)} h</p>
                <p className="text-[10px] text-red-500">Débito total</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <p className="text-base font-bold text-blue-700">{fmtDec(totalHE)} h</p>
                <p className="text-[10px] text-blue-600">H.E. total (70%+100%)</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Ajuste individual de H.E.</p>
                <p className="text-xs text-muted-foreground">
                  Edite colaborador por colaborador, registrando motivo. Depois exporte comparativo de antes/depois.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportarComparativoExcel} disabled={importadosFiltrados.length === 0}>
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel nome a nome
                </Button>
                <Button variant="outline" size="sm" onClick={exportarComparativoPdf} disabled={comparativoAjustes.length === 0}>
                  <Printer className="w-3.5 h-3.5 mr-1" /> PDF antes/depois
                </Button>
              </div>
            </div>

            {!loading && importadosFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum resumo importado para o mês selecionado.</p>
            )}

            <div className="space-y-2">
              {importadosFiltrados.map((r) => {
                return (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{r.colaborador_nome}</p>
                        <p className="text-xs text-muted-foreground">{r.equipe_label} · {r.funcao_label}</p>
                      </div>
                      <span className={`text-xs font-bold ${r.saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Saldo {r.saldo >= 0 ? "+" : ""}{fmtDec(r.saldo)} h
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 p-2"><b>Crédito</b><br />{fmtDec(r.credito_horas)} h</div>
                      <div className="rounded-lg bg-muted/40 p-2"><b>Débito</b><br />{fmtDec(r.debito_horas)} h</div>
                      <div className="rounded-lg bg-muted/40 p-2"><b>H.E. 70%</b><br />{fmtDec(r.he_70_horas)} h</div>
                      <div className="rounded-lg bg-muted/40 p-2"><b>H.E. 100%</b><br />{fmtDec(r.he_100_horas)} h</div>
                      <div className="rounded-lg bg-muted/40 p-2"><b>Ad. Noturno</b><br />{fmtDec(r.adicional_noturno_horas)} h</div>
                      <div className="rounded-lg bg-muted/40 p-2"><b>Horas Normais</b><br />{fmtDec(r.horas_normais)} h</div>
                    </div>

                    {canManageAjustes && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {competenciaStatus.status === "fechado"
                              ? "Competência fechada: reabra para editar H.E."
                              : "Clique em Histórico diário para editar entrada/saída e recalcular H.E."}
                          </p>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={historicoAbertoId === r.id ? "secondary" : "outline"}
                              onClick={() => {
                                if (historicoAbertoId === r.id) {
                                  setHistoricoAbertoId(null);
                                  setHistoricoDias([]);
                                  return;
                                }
                                abrirHistoricoDiario(r);
                              }}
                              disabled={competenciaStatus.status === "fechado" || loadingHistoricoId === r.id}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                              {loadingHistoricoId === r.id ? "Carregando..." : historicoAbertoId === r.id ? "Fechar histórico" : "Histórico diário"}
                            </Button>
                          </div>
                        </div>

                        {historicoAbertoId === r.id && (
                          <div className="rounded-lg bg-muted/30 p-3 border border-border/60">
                            <p className="text-xs text-muted-foreground mb-2">
                              Período: {fmtDate(r.periodo_inicio || `${mes}-01`)} a {fmtDate(r.periodo_fim || competenciaAtual)} · Jornada padrão {jornadaPadrao}h
                            </p>

                            <div className="overflow-auto max-h-[420px] border rounded-md bg-background">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-muted">
                                  <tr>
                                    <th className="text-left p-2">Data</th>
                                    <th className="text-center p-2">1ª Entrada</th>
                                    <th className="text-center p-2">1ª Saída</th>
                                    <th className="text-center p-2">2ª Entrada</th>
                                    <th className="text-center p-2">2ª Saída</th>
                                    <th className="text-right p-2">Trab. (h)</th>
                                    <th className="text-right p-2">Saldo estimado</th>
                                    <th className="text-left p-2">Motivo da alteração</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historicoDias.map((linha, idx) => (
                                    <tr key={linha.data} className="border-t">
                                      <td className="p-2 whitespace-nowrap">{fmtDate(linha.data)}</td>
                                      <td className="p-2">
                                        <input
                                          type="time"
                                          step={60}
                                          value={linha.entrada1 === "-" ? "" : linha.entrada1}
                                          onChange={(e) => {
                                            const val = e.target.value || "-";
                                            setHistoricoDias((prev) => prev.map((d, i) => {
                                              if (i !== idx) return d;
                                              const next = { ...d, entrada1: val };
                                              const horas = calcHorasPorBatidasDiretas(next.entrada1, next.saida1, next.entrada2, next.saida2);
                                              return { ...next, horasTrabalhadas: horas, saldoEstimado: Number((horas - jornadaPadrao).toFixed(2)) };
                                            }));
                                          }}
                                          className="w-28 h-8 rounded border px-2"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="time"
                                          step={60}
                                          value={linha.saida1 === "-" ? "" : linha.saida1}
                                          onChange={(e) => {
                                            const val = e.target.value || "-";
                                            setHistoricoDias((prev) => prev.map((d, i) => {
                                              if (i !== idx) return d;
                                              const next = { ...d, saida1: val };
                                              const horas = calcHorasPorBatidasDiretas(next.entrada1, next.saida1, next.entrada2, next.saida2);
                                              return { ...next, horasTrabalhadas: horas, saldoEstimado: Number((horas - jornadaPadrao).toFixed(2)) };
                                            }));
                                          }}
                                          className="w-28 h-8 rounded border px-2"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="time"
                                          step={60}
                                          value={linha.entrada2 === "-" ? "" : linha.entrada2}
                                          onChange={(e) => {
                                            const val = e.target.value || "-";
                                            setHistoricoDias((prev) => prev.map((d, i) => {
                                              if (i !== idx) return d;
                                              const next = { ...d, entrada2: val };
                                              const horas = calcHorasPorBatidasDiretas(next.entrada1, next.saida1, next.entrada2, next.saida2);
                                              return { ...next, horasTrabalhadas: horas, saldoEstimado: Number((horas - jornadaPadrao).toFixed(2)) };
                                            }));
                                          }}
                                          className="w-28 h-8 rounded border px-2"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="time"
                                          step={60}
                                          value={linha.saida2 === "-" ? "" : linha.saida2}
                                          onChange={(e) => {
                                            const val = e.target.value || "-";
                                            setHistoricoDias((prev) => prev.map((d, i) => {
                                              if (i !== idx) return d;
                                              const next = { ...d, saida2: val };
                                              const horas = calcHorasPorBatidasDiretas(next.entrada1, next.saida1, next.entrada2, next.saida2);
                                              return { ...next, horasTrabalhadas: horas, saldoEstimado: Number((horas - jornadaPadrao).toFixed(2)) };
                                            }));
                                          }}
                                          className="w-28 h-8 rounded border px-2"
                                        />
                                      </td>
                                      <td className="p-2 text-right">{fmtDec(linha.horasTrabalhadas)}</td>
                                      <td className={`p-2 text-right ${linha.saldoEstimado >= 0 ? "text-green-700" : "text-red-700"}`}>
                                        {linha.saldoEstimado >= 0 ? "+" : ""}{fmtDec(linha.saldoEstimado)}
                                      </td>
                                      <td className="p-2">
                                        <input
                                          value={linha.motivo}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setHistoricoDias((prev) => prev.map((d, i) => (i === idx ? { ...d, motivo: val } : d)));
                                          }}
                                          className="w-full min-w-[220px] h-8 rounded border px-2"
                                          placeholder="obrigatório quando alterar batida"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => { setHistoricoAbertoId(null); setHistoricoDias([]); }}>
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => salvarAjustePorDia(r)}
                                disabled={salvandoAjusteId === r.id || competenciaStatus.status === "fechado"}
                              >
                                {salvandoAjusteId === r.id ? "Salvando..." : "Salvar batidas do histórico"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-secondary rounded-xl border border-border px-3 py-2.5 max-w-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Jornada padrão</span>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => setJornadaPadrao((j) => Math.max(4, j - 0.5))} className="w-6 h-6 rounded-full text-sm font-bold hover:bg-muted flex items-center justify-center">−</button>
                <span className="text-sm font-bold w-8 text-center">{jornadaPadrao}h</span>
                <button onClick={() => setJornadaPadrao((j) => Math.min(12, j + 0.5))} className="w-6 h-6 rounded-full text-sm font-bold hover:bg-muted flex items-center justify-center">+</button>
              </div>
            </div>

            {!loading && saldosCalculados.length > 0 && (
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                  <p className="text-base font-bold text-green-700">{fmtHoras(totalPositivo)}</p>
                  <p className="text-[10px] text-green-600">Horas positivas</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                  <p className="text-base font-bold text-red-600">{fmtHoras(totalNegativo)}</p>
                  <p className="text-[10px] text-red-500">Horas negativas</p>
                </div>
              </div>
            )}

            {loading && <p className="text-center text-sm text-muted-foreground py-6">Calculando saldos...</p>}
            {!loading && filtradosCalc.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro encontrado para este mês.</p>
            )}

            {!loading && filtradosCalc.map((s) => (
              <div
                key={s.funcionario.id}
                className={`bg-card rounded-xl border p-3 flex items-center gap-3 ${
                  s.saldo > 0 ? "border-green-200" : s.saldo < 0 ? "border-red-200" : "border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.funcionario.nome}</p>
                  <p className="text-xs text-muted-foreground">{s.funcionario.funcao} · {s.diasTrabalhados} dias</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-base font-bold ${s.saldo > 0 ? "text-green-600" : s.saldo < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {fmtHoras(s.saldo)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtHoras(s.horasTrabalhadas).replace("+", "")} / {fmtHoras(s.horasPrevistas).replace("+", "")}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

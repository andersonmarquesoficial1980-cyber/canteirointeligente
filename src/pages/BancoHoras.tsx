/**
 * BancoHoras — Saldo por funcionário
 *
 * Modo A (preferencial): resumo importado de jornada (ponto_he_resumo_mensal)
 * Modo B (fallback): cálculo a partir de ponto_registros
 */
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Search, FileSpreadsheet, Lock, Unlock, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Funcionario { id: string; nome: string; funcao: string; matricula: string; }
interface Registro { staff_id: string; data: string; hora: string; tipo: string; turno: string | null; }

interface SaldoFuncionario {
  funcionario: Funcionario;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
  diasTrabalhados: number;
}

interface ResumoImportado {
  id: string;
  colaborador_nome: string;
  equipe_nome: string | null;
  credito_horas: number;
  debito_horas: number;
  horas_normais: number;
  he_70_horas: number;
  he_100_horas: number;
  adicional_noturno_horas: number;
  total_horas_extras_horas: number;
}

interface CompetenciaStatus {
  status: "aberto" | "fechado";
  observacao: string | null;
  fechado_em: string | null;
  reaberto_em: string | null;
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
  const [loading, setLoading] = useState(false);
  const [loadingFechamento, setLoadingFechamento] = useState(false);
  const [rolePerfil, setRolePerfil] = useState<{ role: string | null; perfil: string | null }>({ role: null, perfil: null });

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
      .select("id, colaborador_nome, equipe_nome, credito_horas, debito_horas, horas_normais, he_70_horas, he_100_horas, adicional_noturno_horas, total_horas_extras_horas")
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
      .select("staff_id, data, hora, tipo, turno")
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

  const equipesDisponiveis = useMemo(() => {
    return Array.from(new Set(resumosImportados.map((r) => (r.equipe_nome || "Sem equipe").trim()))).sort();
  }, [resumosImportados]);

  useEffect(() => {
    if (equipeFiltro !== "TODAS" && !equipesDisponiveis.includes(equipeFiltro)) {
      setEquipeFiltro("TODAS");
    }
  }, [equipesDisponiveis, equipeFiltro]);

  const importadosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return resumosImportados.filter((r) => {
      const equipe = (r.equipe_nome || "Sem equipe").trim();
      const matchEquipe = equipeFiltro === "TODAS" || equipe === equipeFiltro;
      if (!matchEquipe) return false;
      if (!q) return true;
      return [r.colaborador_nome, equipe].join(" ").toLowerCase().includes(q);
    });
  }, [resumosImportados, busca, equipeFiltro]);

  const totalCredito = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.credito_horas || 0), 0), [importadosFiltrados]);
  const totalDebito = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.debito_horas || 0), 0), [importadosFiltrados]);
  const totalHE = useMemo(() => importadosFiltrados.reduce((a, b) => a + Number(b.total_horas_extras_horas || 0), 0), [importadosFiltrados]);

  const filtradosCalc = busca.trim()
    ? saldosCalculados.filter((s) => s.funcionario.nome.toLowerCase().includes(busca.toLowerCase()) || s.funcionario.matricula?.includes(busca))
    : saldosCalculados;

  const totalPositivo = saldosCalculados.filter((s) => s.saldo > 0).reduce((acc, s) => acc + s.saldo, 0);
  const totalNegativo = saldosCalculados.filter((s) => s.saldo < 0).reduce((acc, s) => acc + s.saldo, 0);

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
        <div className="space-y-3">
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

          {/* Filtros por equipe (quando importado) */}
          {temImportado && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEquipeFiltro("TODAS")}
                className={`h-8 px-3 rounded-full text-xs font-semibold border transition ${
                  equipeFiltro === "TODAS"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border text-foreground hover:bg-muted"
                }`}
              >
                Todas as equipes
              </button>
              {equipesDisponiveis.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setEquipeFiltro(eq)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border transition ${
                    equipeFiltro === eq
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          )}
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

            {!loading && importadosFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum resumo importado para o mês selecionado.</p>
            )}

            <div className="space-y-2">
              {importadosFiltrados.map((r) => {
                const saldo = Number(r.credito_horas || 0) - Number(r.debito_horas || 0);
                return (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{r.colaborador_nome}</p>
                        <p className="text-xs text-muted-foreground">{r.equipe_nome || "Sem equipe"}</p>
                      </div>
                      <span className={`text-xs font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Saldo {saldo >= 0 ? "+" : ""}{fmtDec(saldo)} h
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

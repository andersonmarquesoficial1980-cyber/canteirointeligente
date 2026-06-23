// RelatorioProgramacoes — Fase 5 — Histórico e Relatório de Programações
// Visão gerencial: obras por equipe, por OGS, por período
// Cruzamento programado vs executado (diários de equipamento)

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, BarChart3, CheckCircle2, XCircle, Clock, AlertCircle,
  Download, RefreshCw, TrendingUp, Hammer, CalendarRange, Search,
} from "lucide-react";

// ───── types ─────────────────────────────────────────────────────────────────
interface Programacao {
  id: string;
  data: string;
  equipe: string;
  responsavel: string | null;
  ogs: string | null;
  cliente: string | null;
  local: string | null;
  periodo: string | null;
  status_programacao: string;
  tipo_servico: string | null;
  equipamentos_designados: string[] | null;
  engenheiro_responsavel: string | null;
  confirmado_manutencao: boolean;
  confirmado_por: string | null;
  obs: string | null;
  created_at: string;
}

interface DiarioResumo {
  ogs_number: string | null;
  date: string | null;
  equipment_fleet: string | null;
  operator_name: string | null;
  work_status: string | null;
}

// ───── helpers ───────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function primeiroDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  RASCUNHO:              { label: "Rascunho",           color: "bg-gray-100 text-gray-600 border-gray-200",   icon: Clock },
  AGUARDANDO_MANUTENCAO: { label: "Ag. Manutenção",     color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  CONFIRMADO:            { label: "Confirmado",          color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  CANCELADO:             { label: "Cancelado",           color: "bg-red-50 text-red-700 border-red-200",       icon: XCircle },
};

// ───── componente ─────────────────────────────────────────────────────────────
export default function RelatorioProgramacoes() {
  const navigate = useNavigate();

  // filtros
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [filtroEquipe, setFiltroEquipe] = useState("__todas__");
  const [filtroStatus, setFiltroStatus] = useState("__todos__");
  const [filtroTipo, setFiltroTipo] = useState("__todos__");
  const [busca, setBusca] = useState("");

  // dados
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [diarios, setDiarios] = useState<DiarioResumo[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // ── buscar company_id do usuário logado ──────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.company_id) setCompanyId(data.company_id);
    });
  }, []);

  // ── buscar dados ─────────────────────────────────────────────────────────
  async function buscarDados() {
    if (!companyId) return;
    setLoading(true);
    try {
      // programações no período
      const { data: progs } = await (supabase as any)
        .from("ci_programacoes")
        .select("*")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: false });

      const lista: Programacao[] = progs || [];
      setProgramacoes(lista);

      // equipes únicas para filtro
      const eqs = [...new Set(lista.map((p: Programacao) => p.equipe))].sort();
      setEquipes(eqs);

      // OGSs programadas nesse período (para cruzar com diários)
      const ogsList = lista.map((p: Programacao) => p.ogs).filter(Boolean);
      const datasLista = lista.map((p: Programacao) => p.data);
      const dataMinima = datasLista.length ? [...datasLista].sort()[0] : dataInicio;
      const dataMaxima = datasLista.length ? [...datasLista].sort().reverse()[0] : dataFim;

      if (ogsList.length > 0) {
        const { data: diars } = await supabase
          .from("equipment_diaries")
          .select("ogs_number, date, equipment_fleet, operator_name, work_status")
          .eq("company_id", companyId)
          .gte("date", dataMinima)
          .lte("date", dataMaxima)
          .in("ogs_number", ogsList as string[]);
        setDiarios(diars || []);
      } else {
        setDiarios([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) buscarDados();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ── cruzamento: diários por OGS+data ─────────────────────────────────────
  const diarioMap = useMemo(() => {
    const map: Record<string, DiarioResumo[]> = {};
    for (const d of diarios) {
      if (!d.ogs_number || !d.date) continue;
      const key = `${d.date}_${d.ogs_number}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [diarios]);

  function getDiarios(prog: Programacao): DiarioResumo[] {
    if (!prog.ogs || !prog.data) return [];
    return diarioMap[`${prog.data}_${prog.ogs}`] || [];
  }

  // ── filtros aplicados ────────────────────────────────────────────────────
  const progsFiltradas = useMemo(() => {
    return programacoes.filter(p => {
      if (filtroEquipe !== "__todas__" && p.equipe !== filtroEquipe) return false;
      if (filtroStatus !== "__todos__" && p.status_programacao !== filtroStatus) return false;
      if (filtroTipo !== "__todos__" && p.tipo_servico !== filtroTipo) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          p.equipe?.toLowerCase().includes(b) ||
          p.ogs?.toLowerCase().includes(b) ||
          p.cliente?.toLowerCase().includes(b) ||
          p.local?.toLowerCase().includes(b) ||
          p.responsavel?.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [programacoes, filtroEquipe, filtroStatus, filtroTipo, busca]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = progsFiltradas.length;
    const confirmadas = progsFiltradas.filter(p => p.status_programacao === "CONFIRMADO").length;
    const canceladas = progsFiltradas.filter(p => p.status_programacao === "CANCELADO").length;
    const aguardando = progsFiltradas.filter(p => p.status_programacao === "AGUARDANDO_MANUTENCAO").length;
    const comDiario = progsFiltradas.filter(p => getDiarios(p).length > 0).length;
    const semDiario = progsFiltradas.filter(p =>
      p.status_programacao === "CONFIRMADO" && getDiarios(p).length === 0
    ).length;

    // por equipe
    const porEquipe: Record<string, number> = {};
    for (const p of progsFiltradas) {
      if (!p.equipe) continue;
      porEquipe[p.equipe] = (porEquipe[p.equipe] || 0) + 1;
    }

    // por tipo
    const porTipo: Record<string, number> = {};
    for (const p of progsFiltradas) {
      const t = p.tipo_servico || "Não informado";
      porTipo[t] = (porTipo[t] || 0) + 1;
    }

    return { total, confirmadas, canceladas, aguardando, comDiario, semDiario, porEquipe, porTipo };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progsFiltradas, diarios]);

  // ── exportar CSV ─────────────────────────────────────────────────────────
  function exportarCSV() {
    const header = "Data;Equipe;OGS;Cliente;Local;Tipo Serviço;Período;Status;Confirmado Manutenção;Diários Executados;Equipamentos";
    const rows = progsFiltradas.map(p => {
      const diarsP = getDiarios(p);
      return [
        fmtDate(p.data),
        p.equipe,
        p.ogs || "",
        p.cliente || "",
        p.local || "",
        p.tipo_servico || "",
        p.periodo || "",
        STATUS_CONFIG[p.status_programacao]?.label || p.status_programacao,
        p.confirmado_manutencao ? "Sim" : "Não",
        diarsP.length > 0 ? `${diarsP.length} diário(s)` : "Nenhum",
        (p.equipamentos_designados || []).join(" | "),
      ].join(";");
    });
    const csv = [header, ...rows].join("\n");
    try {
      navigator.clipboard.writeText(csv);
      alert("✅ CSV copiado! Cole no Excel (Ctrl+V).");
    } catch {
      // fallback: download direto
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `programacoes_${dataInicio}_${dataFim}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/programador/programacao-noturna")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Relatório de Programações
          </h1>
          <p className="text-sm text-muted-foreground">Visão gerencial — programado vs executado</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarCSV} className="gap-1.5">
          <Download className="w-4 h-4" /> CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
          <CalendarRange className="w-4 h-4" /> Filtros
        </div>

        {/* linha 1: datas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        {/* linha 2: selects */}
        <div className="grid grid-cols-3 gap-3">
          <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas as equipes</SelectItem>
              {equipes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos status</SelectItem>
              <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
              <SelectItem value="AGUARDANDO_MANUTENCAO">Ag. Manutenção</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos tipos</SelectItem>
              <SelectItem value="PAVIMENTAÇÃO">Pavimentação</SelectItem>
              <SelectItem value="RETRABALHO">Retrabalho</SelectItem>
              <SelectItem value="FRESAGEM">Fresagem</SelectItem>
              <SelectItem value="INFRA">Infra</SelectItem>
              <SelectItem value="BGS">BGS</SelectItem>
              <SelectItem value="OUTRO">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* linha 3: busca + botão */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe, OGS, cliente, local..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button size="sm" onClick={buscarDados} disabled={loading} className="gap-1.5 shrink-0">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {progsFiltradas.length > 0 && (
        <div className="space-y-4">
          {/* linha 1: totais */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{kpis.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total programadas</p>
            </div>
            <div className="bg-card border border-green-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{kpis.confirmadas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Confirmadas</p>
            </div>
            <div className="bg-card border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{kpis.aguardando}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ag. Manutenção</p>
            </div>
            <div className="bg-card border border-red-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{kpis.canceladas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Canceladas</p>
            </div>
          </div>

          {/* linha 2: programado vs executado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{kpis.comDiario}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com diário registrado ✅</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{kpis.semDiario}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Confirmadas sem diário ⚠️</p>
            </div>
          </div>

          {/* por equipe */}
          {Object.keys(kpis.porEquipe).length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Obras por equipe
              </p>
              <div className="space-y-2">
                {Object.entries(kpis.porEquipe)
                  .sort((a, b) => b[1] - a[1])
                  .map(([equipe, qtd]) => {
                    const pct = Math.round((qtd / kpis.total) * 100);
                    return (
                      <div key={equipe} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium truncate max-w-[60%]">{equipe}</span>
                          <span className="text-muted-foreground">{qtd} obra{qtd !== 1 ? "s" : ""} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* por tipo de serviço */}
          {Object.keys(kpis.porTipo).length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5" /> Obras por tipo de serviço
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(kpis.porTipo)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tipo, qtd]) => (
                    <div key={tipo} className="bg-muted rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5">
                      <span className="font-medium">{tipo}</span>
                      <span className="bg-background rounded-full px-1.5 py-0.5 text-[10px] font-bold text-primary">{qtd}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista detalhada */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">
            {loading ? "Carregando..." : `${progsFiltradas.length} programação${progsFiltradas.length !== 1 ? "ões" : ""}`}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && progsFiltradas.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-12 text-center text-muted-foreground text-sm">
            Nenhuma programação encontrada no período.
          </div>
        )}

        {!loading && progsFiltradas.map(prog => {
          const diarsP = getDiarios(prog);
          const cfg = STATUS_CONFIG[prog.status_programacao] || STATUS_CONFIG["RASCUNHO"];
          const StatusIcon = cfg.icon;
          const executado = diarsP.length > 0;
          const alertaSemDiario = prog.status_programacao === "CONFIRMADO" && !executado;

          return (
            <div key={prog.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              {/* topo: data + status + badge executado */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{fmtDate(prog.data)}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-sm font-semibold text-primary">{prog.equipe}</span>
                  {prog.periodo && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">
                      {prog.periodo}
                    </span>
                  )}
                  {prog.tipo_servico && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">
                      {prog.tipo_servico}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* detalhes */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {prog.ogs && (
                  <div><span className="text-muted-foreground">OGS: </span><span className="font-semibold">{prog.ogs}</span></div>
                )}
                {prog.cliente && (
                  <div className="truncate"><span className="text-muted-foreground">Cliente: </span>{prog.cliente}</div>
                )}
                {prog.local && (
                  <div className="col-span-2 truncate"><span className="text-muted-foreground">Local: </span>{prog.local}</div>
                )}
                {prog.responsavel && (
                  <div className="truncate"><span className="text-muted-foreground">Encarregado: </span>{prog.responsavel}</div>
                )}
                {prog.engenheiro_responsavel && (
                  <div className="truncate"><span className="text-muted-foreground">Eng.: </span>{prog.engenheiro_responsavel}</div>
                )}
              </div>

              {/* equipamentos */}
              {(prog.equipamentos_designados || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prog.equipamentos_designados!.map(eq => (
                    <span key={eq} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-medium">
                      {eq}
                    </span>
                  ))}
                </div>
              )}

              {/* cruzamento diários */}
              <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${
                executado
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : alertaSemDiario
                  ? "bg-orange-50 border border-orange-200 text-orange-700"
                  : "bg-muted border border-border text-muted-foreground"
              }`}>
                {executado ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">Executada — {diarsP.length} diário{diarsP.length !== 1 ? "s" : ""} lançado{diarsP.length !== 1 ? "s" : ""}</span>
                      <div className="mt-1 space-y-0.5">
                        {diarsP.map((d, i) => (
                          <div key={i} className="text-[10px] opacity-80">
                            {d.equipment_fleet && <span className="font-mono font-semibold mr-1">{d.equipment_fleet}</span>}
                            {d.operator_name && <span>{d.operator_name}</span>}
                            {d.work_status && <span className="ml-1 opacity-70">({d.work_status})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : alertaSemDiario ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span><span className="font-semibold">Confirmada mas sem diário de equipamento</span> — verificar lançamento</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{prog.status_programacao === "CANCELADO" ? "Cancelada — sem diário esperado" : "Sem diário registrado"}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

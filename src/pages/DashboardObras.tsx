/**
 * WF Dashboard — Presidência / Diretoria
 * Foco: Obras ativas, andamento, RDOs, produção.
 * Design: Dark theme elegante para TV (full-screen).
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  HardHat, Activity, AlertCircle, CheckCircle2,
  TrendingUp, Calendar, Layers, RefreshCw, Maximize2,
  ArrowLeft, XCircle, Clock,
} from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

// ─── Helpers ────────────────────────────────────────────────────────────────
function now() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}
function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface ObraStats {
  obra_nome: string;
  rdos: number;
  cancelamentos: number;
  ultima_data: string;
  status: "ativa" | "cancelada" | "sem-rdo";
  tipo_rdo: string | null;
}

interface RdoDia {
  obra_nome: string;
  turno: string;
  tipo_rdo: string | null;
  responsavel: string | null;
  clima: string | null;
  data: string;
}

// ─── Cores por status ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  ativa: { bg: "rgba(16,185,129,0.15)", border: "#10b981", text: "#34d399", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelada: { bg: "rgba(239,68,68,0.12)", border: "#ef4444", text: "#f87171", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  "sem-rdo": { bg: "rgba(100,116,139,0.12)", border: "#475569", text: "#94a3b8", badge: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-5 flex items-center gap-4"
      style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="rounded-xl p-3 flex-shrink-0" style={{ background: `${color}22` }}>
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-black text-white leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Obra Card ───────────────────────────────────────────────────────────────
function ObraCard({ obra }: { obra: ObraStats }) {
  const s = STATUS_COLOR[obra.status];
  return (
    <div className="rounded-xl border p-4 transition-all"
      style={{ background: s.bg, borderColor: s.border + "55" }}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-white text-sm leading-tight flex-1">{obra.obra_nome}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${s.badge}`}>
          {obra.status === "ativa" ? "ATIVA" : obra.status === "cancelada" ? "CANCELOU" : "SEM RDO"}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" />{obra.rdos} RDO{obra.rdos !== 1 ? "s" : ""}
        </span>
        {obra.cancelamentos > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-3 h-3" />{obra.cancelamentos} cancel.
          </span>
        )}
        {obra.ultima_data && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />Ult: {fmtDate(obra.ultima_data)}
          </span>
        )}
        {obra.tipo_rdo && (
          <span className="text-slate-500">{obra.tipo_rdo}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DashboardObras() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<ObraStats[]>([]);
  const [rdosHoje, setRdosHoje] = useState<RdoDia[]>([]);
  const [rdosSemana, setRdosSemana] = useState<{ data: string; count: number }[]>([]);
  const [lastUpdate, setLastUpdate] = useState(now());
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const load = useCallback(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];

    const [
      { data: rdos30 },
      { data: todayRdos },
      { data: weekRdos },
    ] = await Promise.all([
      (supabase as any).from("rdo_diarios")
        .select("obra_nome, data, clima, tipo_rdo")
        .gte("data", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
        .order("data", { ascending: false }),
      (supabase as any).from("rdo_diarios")
        .select("obra_nome, turno, tipo_rdo, responsavel, clima, data")
        .eq("data", hoje)
        .order("obra_nome"),
      (supabase as any).from("rdo_diarios")
        .select("data")
        .gte("data", sevenDaysAgo)
        .order("data"),
    ]);

    // Agrupa por obra
    const obraMap: Record<string, ObraStats> = {};
    for (const r of rdos30 || []) {
      if (!obraMap[r.obra_nome]) {
        obraMap[r.obra_nome] = {
          obra_nome: r.obra_nome,
          rdos: 0,
          cancelamentos: 0,
          ultima_data: r.data,
          status: "sem-rdo",
          tipo_rdo: r.tipo_rdo,
        };
      }
      obraMap[r.obra_nome].rdos += 1;
      if (["Cancelou", "cancelou", "CANCELOU"].includes(r.clima || "")) {
        obraMap[r.obra_nome].cancelamentos += 1;
      }
      if (r.data > obraMap[r.obra_nome].ultima_data) {
        obraMap[r.obra_nome].ultima_data = r.data;
      }
    }

    // Status: ativa = tem RDO hoje; cancelada = ultimo RDO foi cancelamento
    const obrasArr = Object.values(obraMap).sort((a, b) => b.ultima_data.localeCompare(a.ultima_data));
    for (const o of obrasArr) {
      const temHoje = (rdos30 || []).some(r => r.obra_nome === o.obra_nome && r.data === hoje);
      const ultimoRdo = (rdos30 || []).find(r => r.obra_nome === o.obra_nome);
      if (temHoje && !["Cancelou", "cancelou"].includes(ultimoRdo?.clima || "")) {
        o.status = "ativa";
      } else if (["Cancelou", "cancelou"].includes(ultimoRdo?.clima || "")) {
        o.status = "cancelada";
      } else {
        o.status = "sem-rdo";
      }
    }

    setObras(obrasArr);
    setRdosHoje(todayRdos || []);

    // Série semanal
    const countByDay: Record<string, number> = {};
    for (const r of weekRdos || []) {
      countByDay[r.data] = (countByDay[r.data] || 0) + 1;
    }
    const series: { data: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      series.push({ data: fmtDate(d), count: countByDay[d] || 0 });
    }
    setRdosSemana(series);
    setLastUpdate(now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const ativas = obras.filter(o => o.status === "ativa").length;
  const canceladas = obras.filter(o => o.status === "cancelada").length;
  const totalObras = obras.length;
  const rdosHojeCount = rdosHoje.length;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10"
        style={{ background: "rgba(15,23,42,0.95)" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/wf-dashboards")}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={logoCi} alt="Workflux" className="h-7 opacity-90" />
          <div className="w-px h-8 bg-white/20" />
          <div>
            <h1 className="text-white font-black text-lg leading-none">Dashboard de Obras</h1>
            <p className="text-slate-400 text-xs mt-0.5">Presidência · Acompanhamento em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Atualizado às {lastUpdate}
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Carregando dados...</p>
          </div>
        </div>
      ) : (
        <main className="flex-1 px-8 py-6 flex flex-col gap-6 overflow-auto">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard icon={HardHat} label="Obras (30 dias)" value={totalObras} sub="RDOs registrados" color="#6366f1" />
            <KpiCard icon={Activity} label="Ativas hoje" value={ativas} sub="Com RDO no dia" color="#10b981" />
            <KpiCard icon={XCircle} label="Com cancelamento" value={canceladas} sub="Último RDO cancelado" color="#ef4444" />
            <KpiCard icon={CheckCircle2} label="RDOs hoje" value={rdosHojeCount} sub={`${new Date().toLocaleDateString("pt-BR")}`} color="#f59e0b" />
          </div>

          {/* Linha 2: obras + gráfico semanal */}
          <div className="grid grid-cols-3 gap-6 flex-1">
            {/* Lista obras */}
            <div className="col-span-2 rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Obras nos últimos 30 dias
              </h2>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2.5 content-start">
                {obras.map((o, i) => <ObraCard key={i} obra={o} />)}
                {obras.length === 0 && <p className="text-slate-500 text-sm col-span-2 text-center py-8">Nenhuma obra encontrada</p>}
              </div>
            </div>

            {/* Coluna lateral */}
            <div className="flex flex-col gap-4">
              {/* Gráfico semanal */}
              <div className="rounded-2xl border border-white/10 p-5"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> RDOs — últimos 7 dias
                </h2>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={rdosSemana} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rdoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                      itemStyle={{ color: "#a5b4fc" }}
                    />
                    <Area type="monotone" dataKey="count" name="RDOs" stroke="#6366f1" strokeWidth={2} fill="url(#rdoGrad)" dot={{ fill: "#6366f1", r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* RDOs de hoje */}
              <div className="rounded-2xl border border-white/10 p-5 flex-1 overflow-hidden flex flex-col"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" /> RDOs de hoje
                </h2>
                {rdosHoje.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-4">Nenhum RDO ainda hoje</p>
                ) : (
                  <div className="overflow-y-auto space-y-2">
                    {rdosHoje.map((r, i) => (
                      <div key={i} className="rounded-lg p-2.5 border border-white/10"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center justify-between">
                          <span className="text-white text-xs font-bold truncate flex-1">{r.obra_nome}</span>
                          <span className="text-slate-400 text-[10px] flex-shrink-0 ml-2">{r.turno}</span>
                        </div>
                        {r.responsavel && <p className="text-slate-500 text-[10px] mt-0.5 truncate">👷 {r.responsavel}</p>}
                        {r.tipo_rdo && <p className="text-indigo-400 text-[10px]">{r.tipo_rdo}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

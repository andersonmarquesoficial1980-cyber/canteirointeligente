/**
 * WF Dashboard — Frota / Equipamentos
 * Foco: Status da frota em tempo real, mais/menos usados, abastecimento.
 * Design: Dark theme para TV.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Truck, Warehouse, Wrench, Activity, Fuel,
  RefreshCw, Maximize2, ArrowLeft, TrendingUp, Award, AlertTriangle,
} from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

function now() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  Trabalhando:  { label: "Trabalhando",    color: "#10b981", icon: Activity },
  "Em Trânsito":{ label: "Em Trânsito",    color: "#f59e0b", icon: Truck },
  Disponível:   { label: "Disponível",     color: "#6366f1", icon: Warehouse },
  Inoperante:   { label: "Inoperante",     color: "#ef4444", icon: Wrench },
  Folga:        { label: "Folga",          color: "#64748b", icon: Warehouse },
};

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

export default function DashboardFrota() {
  const navigate = useNavigate();
  const [diarios, setDiarios] = useState<any[]>([]);
  const [abast, setAbast] = useState<any[]>([]);
  const [maiUsados, setMaisUsados] = useState<{ frota: string; dias: number }[]>([]);
  const [lastUpdate, setLastUpdate] = useState(now());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const trinta = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [
      { data: diariosHoje },
      { data: abastHoje },
      { data: usos30 },
    ] = await Promise.all([
      (supabase as any).from("equipment_diaries")
        .select("equipment_fleet, equipment_type, work_status, operator_name, ogs_number, fuel_liters")
        .eq("date", hoje).order("equipment_fleet"),
      (supabase as any).from("abastecimentos")
        .select("equipment_fleet, litros, fonte")
        .eq("data", hoje).order("litros", { ascending: false }),
      (supabase as any).from("equipment_diaries")
        .select("equipment_fleet")
        .gte("date", trinta).eq("work_status", "Trabalhando"),
    ]);

    setDiarios(diariosHoje || []);
    setAbast(abastHoje || []);

    // Maisusados
    const countMap: Record<string, number> = {};
    for (const u of usos30 || []) {
      countMap[u.equipment_fleet] = (countMap[u.equipment_fleet] || 0) + 1;
    }
    const sorted = Object.entries(countMap)
      .map(([frota, dias]) => ({ frota, dias }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8);
    setMaisUsados(sorted);

    setLastUpdate(now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Contagens status
  const statusCount: Record<string, number> = {};
  for (const d of diarios) {
    const s = d.work_status || "Outros";
    statusCount[s] = (statusCount[s] || 0) + 1;
  }

  const pieData = Object.entries(statusCount).map(([name, value]) => ({
    name,
    value,
    color: STATUS_META[name]?.color || "#94a3b8",
  }));

  const totalHoje = diarios.length;
  const trabalhando = statusCount["Trabalhando"] || 0;
  const inoperante = statusCount["Inoperante"] || 0;
  const totalLitros = abast.reduce((s, a) => s + (a.litros || 0), 0);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-xl p-3 border text-xs" style={{ background: "#1e293b", borderColor: "#334155" }}>
          <p className="text-white font-bold">{payload[0].name}</p>
          <p style={{ color: payload[0].payload.color }}>{payload[0].value} equipamentos</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10"
        style={{ background: "rgba(15,23,42,0.95)" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/wf-dashboards")}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={logoCi} alt="Workflux" className="h-7 opacity-90" />
          <div className="w-px h-8 bg-white/20" />
          <div>
            <h1 className="text-white font-black text-lg leading-none">Dashboard de Frota</h1>
            <p className="text-slate-400 text-xs mt-0.5">Equipamentos · Status em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {lastUpdate}
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex-1 px-8 py-6 flex flex-col gap-6 overflow-auto">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard icon={Truck} label="Equipamentos hoje" value={totalHoje} sub="Com diário registrado" color="#6366f1" />
            <KpiCard icon={Activity} label="Trabalhando" value={trabalhando} sub={`${totalHoje > 0 ? Math.round(trabalhando / totalHoje * 100) : 0}% da frota`} color="#10b981" />
            <KpiCard icon={Wrench} label="Inoperante" value={inoperante} sub="Requer atenção" color="#ef4444" />
            <KpiCard icon={Fuel} label="Abastecido hoje" value={`${totalLitros.toFixed(0)} L`} sub={`${abast.length} equipamentos`} color="#f59e0b" />
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-3 gap-6 flex-1">
            {/* Donut Status */}
            <div className="rounded-2xl border border-white/10 p-5"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Status da Frota
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke={entry.color + "44"} strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-slate-300 text-xs">{p.name}</span>
                    </div>
                    <span className="text-white font-bold text-sm">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mais usados (30 dias) */}
            <div className="rounded-2xl border border-white/10 p-5"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Mais Utilizados (30d)
              </h2>
              {maiUsados.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={maiUsados} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="frota" type="category" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                      axisLine={false} tickLine={false} width={50} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                      formatter={(v: any) => [`${v} dias`, "Dias trabalhados"]} />
                    <Bar dataKey="dias" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                      {maiUsados.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#f59e0b" : i === 1 ? "#f97316" : "#6366f1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Abastecimento hoje + lista equipamentos */}
            <div className="flex flex-col gap-4">
              {/* Abastecimento */}
              <div className="rounded-2xl border border-white/10 p-5"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-orange-400" /> Abastecimento Hoje
                </h2>
                {abast.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-3">Nenhum abastecimento registrado</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {abast.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white font-bold">{a.equipment_fleet}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 capitalize">{a.fonte}</span>
                          <span className="text-orange-400 font-bold">{(a.litros || 0).toFixed(0)}L</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertas de frota */}
              {inoperante > 0 && (
                <div className="rounded-2xl border border-red-500/30 p-4"
                  style={{ background: "rgba(239,68,68,0.08)" }}>
                  <h2 className="text-red-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Inoperantes
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {diarios.filter(d => d.work_status === "Inoperante").map((d, i) => (
                      <span key={i} className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">
                        {d.equipment_fleet}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranking equipamentos trabalhando */}
              <div className="rounded-2xl border border-white/10 p-4 flex-1"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Trabalhando agora
                </h2>
                <div className="grid grid-cols-3 gap-1.5 overflow-y-auto max-h-32">
                  {diarios.filter(d => d.work_status === "Trabalhando").map((d, i) => (
                    <div key={i} className="rounded-lg p-1.5 text-center bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-bold text-[10px]">{d.equipment_fleet}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

/**
 * WF Dashboard — Diretoria de Manutenção
 * Foco: OS abertas, documentos vencendo, equipamentos em manutenção.
 * Design: Dark theme elegante para TV.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  Wrench, AlertTriangle, FileText, CheckCircle2, Clock,
  TrendingUp, RefreshCw, Maximize2, ArrowLeft, XCircle, Zap,
} from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

function now() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

interface OsItem {
  id: string;
  numero_os: string;
  equipment_fleet: string;
  titulo: string;
  prioridade: string;
  status: string;
  created_at: string;
}

interface DocItem {
  equipment_fleet: string;
  tipo_documento: string;
  data_vencimento: string;
  dias: number;
}

const PRIORIDADE_COLOR: Record<string, string> = {
  urgente: "#ef4444",
  alta: "#f97316",
  media: "#f59e0b",
  baixa: "#10b981",
};
const PRIORIDADE_BG: Record<string, string> = {
  urgente: "rgba(239,68,68,0.15)",
  alta: "rgba(249,115,22,0.15)",
  media: "rgba(245,158,11,0.12)",
  baixa: "rgba(16,185,129,0.12)",
};

function KpiCard({ icon: Icon, label, value, sub, color, alert }: {
  icon: any; label: string; value: string | number; sub?: string; color: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 transition-all ${alert && Number(value) > 0 ? "border-red-500/40" : "border-white/10"}`}
      style={{ background: alert && Number(value) > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)" }}>
      <div className="rounded-xl p-3 flex-shrink-0" style={{ background: `${color}22` }}>
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-3xl font-black leading-none mt-0.5 ${alert && Number(value) > 0 ? "text-red-400" : "text-white"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardManutencao() {
  const navigate = useNavigate();
  const [osAbertas, setOsAbertas] = useState<OsItem[]>([]);
  const [osFechadas30, setOsFechadas30] = useState(0);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [byStatus, setByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [equipManut, setEquipManut] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState(now());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const hoje = new Date();
    const trinta = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [
      { data: osOpen },
      { data: osClosed },
      { data: docsAll },
      { data: equips },
    ] = await Promise.all([
      (supabase as any).from("manutencao_os").select("id,numero_os,equipment_fleet,titulo,prioridade,status,created_at")
        .in("status", ["aberta", "em_andamento"]).order("prioridade"),
      (supabase as any).from("manutencao_os").select("id", { count: "exact", head: true })
        .eq("status", "concluida").gte("updated_at", trinta),
      (supabase as any).from("manutencao_documentos").select("equipment_fleet,tipo_documento,data_vencimento")
        .not("data_vencimento", "is", null),
      (supabase as any).from("equipment_diaries").select("equipment_fleet,work_status")
        .eq("date", new Date().toISOString().split("T")[0]).eq("work_status", "Inoperante"),
    ]);

    setOsAbertas(osOpen || []);
    setOsFechadas30(osClosed?.length || 0);
    setEquipManut(equips || []);

    // Documentos vencendo (60 dias)
    const vencendo = ((docsAll || []) as any[])
      .map(d => ({
        ...d,
        dias: Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / 86400000),
      }))
      .filter(d => d.dias <= 60)
      .sort((a, b) => a.dias - b.dias);
    setDocs(vencendo);

    // Por status
    const statusMap: Record<string, number> = {};
    for (const o of osOpen || []) {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    }
    setByStatus([
      { name: "Aberta", value: statusMap["aberta"] || 0, color: "#f59e0b" },
      { name: "Em Andamento", value: statusMap["em_andamento"] || 0, color: "#6366f1" },
    ]);

    setLastUpdate(now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const urgentes = osAbertas.filter(o => o.prioridade === "urgente" || o.prioridade === "alta").length;
  const vencidos = docs.filter(d => d.dias <= 0).length;
  const vencendo7 = docs.filter(d => d.dias > 0 && d.dias <= 7).length;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
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
            <h1 className="text-white font-black text-lg leading-none">Dashboard de Manutenção</h1>
            <p className="text-slate-400 text-xs mt-0.5">Diretoria de Manutenção · OS e documentos em tempo real</p>
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
          <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <main className="flex-1 px-8 py-6 flex flex-col gap-6 overflow-auto">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard icon={Wrench} label="OS em aberto" value={osAbertas.length} sub="Aguardando / Em andamento" color="#6366f1" />
            <KpiCard icon={AlertTriangle} label="Urgentes / Altas" value={urgentes} sub="Requer atenção imediata" color="#ef4444" alert />
            <KpiCard icon={CheckCircle2} label="Concluídas (30d)" value={osFechadas30} sub="Últimos 30 dias" color="#10b981" />
            <KpiCard icon={FileText} label="Docs vencidos" value={vencidos} sub={`+${vencendo7} vencem em 7 dias`} color="#f59e0b" alert />
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-3 gap-6 flex-1">
            {/* OS Abertas */}
            <div className="col-span-2 rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-400" /> OS em Aberto
              </h2>
              {osAbertas.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
                    <p className="text-emerald-400 font-semibold">Nenhuma OS em aberto</p>
                    <p className="text-slate-500 text-xs mt-1">Tudo em dia! 🎉</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {osAbertas.map((o) => (
                    <div key={o.id} className="rounded-xl border p-3 flex items-center gap-3 transition-all"
                      style={{
                        background: PRIORIDADE_BG[o.prioridade] || "rgba(255,255,255,0.04)",
                        borderColor: (PRIORIDADE_COLOR[o.prioridade] || "#475569") + "44",
                      }}>
                      <div className="flex-shrink-0">
                        <Zap className="w-4 h-4" style={{ color: PRIORIDADE_COLOR[o.prioridade] || "#94a3b8" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-xs">OS #{o.numero_os}</span>
                          <span className="text-slate-300 text-xs font-medium">{o.equipment_fleet}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{ color: PRIORIDADE_COLOR[o.prioridade] || "#94a3b8", background: (PRIORIDADE_COLOR[o.prioridade] || "#475569") + "22" }}>
                            {o.prioridade}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] truncate mt-0.5">{o.titulo}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-500">
                          {o.status === "em_andamento" ? "🔧 Em andamento" : "⏳ Aberta"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coluna lateral */}
            <div className="flex flex-col gap-4">
              {/* Gráfico por prioridade */}
              <div className="rounded-2xl border border-white/10 p-5"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> OS por Status
                </h2>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={byStatus} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {byStatus.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Documentos vencendo */}
              <div className="rounded-2xl border border-white/10 p-5 flex-1 overflow-hidden flex flex-col"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" /> Docs Vencendo (60d)
                </h2>
                {docs.length === 0 ? (
                  <p className="text-emerald-400 text-xs text-center py-4">Todos os docs em dia ✓</p>
                ) : (
                  <div className="overflow-y-auto space-y-2">
                    {docs.map((d, i) => (
                      <div key={i} className={`rounded-lg p-2.5 border ${d.dias <= 0 ? "border-red-500/40 bg-red-500/10" : d.dias <= 7 ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/3"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-white text-xs font-bold">{d.equipment_fleet}</span>
                          <span className={`text-[10px] font-black ${d.dias <= 0 ? "text-red-400" : d.dias <= 7 ? "text-orange-400" : "text-amber-400"}`}>
                            {d.dias <= 0 ? "VENCIDO" : `${d.dias}d`}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px] mt-0.5">{d.tipo_documento}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Equip. inoperantes hoje */}
              <div className="rounded-2xl border border-white/10 p-4"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="text-white font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400" /> Inoperantes hoje ({equipManut.length})
                </h2>
                {equipManut.length === 0 ? (
                  <p className="text-slate-500 text-xs">Nenhum equipamento inoperante</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {equipManut.map((e, i) => (
                      <span key={i} className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">
                        {e.equipment_fleet}
                      </span>
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

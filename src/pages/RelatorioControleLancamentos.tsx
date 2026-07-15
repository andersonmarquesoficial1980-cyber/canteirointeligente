import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Download, Users, Wrench, Calendar, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DiarioRow {
  date: string;
  operator_name: string | null;
  equipment_fleet: string;
  equipment_type: string | null;
  ogs_number: string | null;
  location_address: string | null;
  period: string | null;
  work_status: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  fuel_type: string | null;
  fuel_liters: number | null;
  observations: string | null;
  status: string;
  created_at: string;
  // joined
  usuario_nome: string;
  usuario_email: string;
  usuario_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} (${DIAS[dt.getDay()]})`;
}

function fmtDateShort(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`;
}

function fmtDateTime(ts: string) {
  if (!ts) return "";
  const dt = new Date(ts);
  return dt.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function getAllDays(ini: string, fim: string): string[] {
  const days: string[] = [];
  const cur = new Date(ini + "T12:00:00");
  const end = new Date(fim + "T12:00:00");
  while (cur <= end) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function statusColor(ws: string | null) {
  switch (ws) {
    case "Trabalhando":   return "bg-green-100 text-green-800 border border-green-300";
    case "Folga":         return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    case "Disposição":    return "bg-blue-100 text-blue-800 border border-blue-300";
    case "Em Transporte": return "bg-purple-100 text-purple-800 border border-purple-300";
    default:              return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

function statusIcon(ws: string | null) {
  switch (ws) {
    case "Trabalhando":   return <CheckCircle2 size={12} className="text-green-600" />;
    case "Folga":         return <Clock size={12} className="text-yellow-600" />;
    case "Disposição":    return <AlertCircle size={12} className="text-blue-600" />;
    case "Em Transporte": return <ChevronDown size={12} className="text-purple-600" />;
    default:              return <FileX size={12} className="text-gray-400" />;
  }
}

// ─── Componente de célula de calendário ───────────────────────────────────────

function CalCell({ rows, onClick }: { rows: DiarioRow[]; onClick: () => void }) {
  if (rows.length === 0) {
    return (
      <div className="w-full h-10 rounded flex items-center justify-center bg-red-50 border border-red-200">
        <span className="text-red-400 text-xs font-medium">❌</span>
      </div>
    );
  }
  const env = rows.filter(r => r.status === "enviado");
  const ras = rows.filter(r => r.status === "rascunho");
  return (
    <button onClick={onClick}
      className="w-full min-h-[40px] rounded flex flex-col items-center justify-center gap-0.5 px-1 py-1 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
      {env.map((r, i) => (
        <span key={i} className={`text-[10px] px-1 py-0.5 rounded font-medium w-full text-center truncate ${statusColor(r.work_status)}`}>
          {r.work_status || "—"}
        </span>
      ))}
      {ras.length > 0 && (
        <span className="text-[10px] px-1 py-0.5 rounded font-medium w-full text-center truncate bg-orange-100 text-orange-700 border border-orange-300">
          📝 Rascunho
        </span>
      )}
    </button>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function RelatorioControleLancamentos() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const companyId = profile?.company_id;

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const ultimoDia   = hoje.toISOString().split("T")[0];

  const [aba, setAba] = useState<"usuario" | "equipamento">("usuario");
  const [dataIni, setDataIni]   = useState(primeiroDia);
  const [dataFim, setDataFim]   = useState(ultimoDia);
  const [busca, setBusca]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [diarios, setDiarios]   = useState<DiarioRow[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [modal, setModal]       = useState<{ titulo: string; rows: DiarioRow[] } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // ── Buscar dados ─────────────────────────────────────────────────────────────
  const buscarDados = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // 1ª query: diários sem join (user_id aponta para auth.users, não profiles)
      const { data: raw, error } = await (supabase as any)
        .from("equipment_diaries")
        .select(`
          date, operator_name, equipment_fleet, equipment_type,
          ogs_number, location_address, period, work_status,
          meter_initial, meter_final, odometer_initial, odometer_final,
          fuel_type, fuel_liters, observations, status, created_at, user_id
        `)
        .eq("company_id", companyId)
        .gte("date", dataIni)
        .lte("date", dataFim)
        .order("date", { ascending: true });

      if (error) { console.error("[ControleLancamentos] query error", error); setLoading(false); return; }
      if (!raw || raw.length === 0) { setDiarios([]); setLoading(false); return; }

      // 2ª query: profiles pelos user_ids únicos
      const userIds = [...new Set((raw as any[]).map((d: any) => d.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, nome_completo, email")
        .in("user_id", userIds);

      const profileMap: Record<string, { nome: string; email: string }> = {};
      (profilesData || []).forEach((p: any) => {
        profileMap[p.user_id] = { nome: p.nome_completo || "—", email: p.email || "" };
      });

      const rows: DiarioRow[] = (raw as any[]).map((d: any) => ({
        date: d.date,
        operator_name: d.operator_name,
        equipment_fleet: d.equipment_fleet || "—",
        equipment_type: d.equipment_type,
        ogs_number: d.ogs_number,
        location_address: d.location_address,
        period: d.period,
        work_status: d.work_status,
        meter_initial: d.meter_initial,
        meter_final: d.meter_final,
        odometer_initial: d.odometer_initial,
        odometer_final: d.odometer_final,
        fuel_type: d.fuel_type,
        fuel_liters: d.fuel_liters,
        observations: d.observations,
        status: d.status || "rascunho",
        created_at: d.created_at,
        usuario_id: d.user_id || "",
        usuario_nome: profileMap[d.user_id]?.nome || d.operator_name || "—",
        usuario_email: profileMap[d.user_id]?.email || "",
      }));

      setDiarios(rows);
    } catch (err) {
      console.error("[ControleLancamentos]", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) buscarDados();
  }, [companyId]);

  // ── Derivar dados agrupados ───────────────────────────────────────────────────
  const allDays = getAllDays(dataIni, dataFim);
  const diasLabel = allDays.map(d => {
    const dt = new Date(d + "T12:00:00");
    return { d, label: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`, day: DIAS[dt.getDay()], isWE: dt.getDay() === 0 || dt.getDay() === 6 };
  });

  // Agrupamento por usuário
  const porUsuario: Record<string, { nome: string; email: string; rows: DiarioRow[] }> = {};
  diarios.forEach(r => {
    const key = r.usuario_id || r.usuario_nome;
    if (!porUsuario[key]) porUsuario[key] = { nome: r.usuario_nome, email: r.usuario_email, rows: [] };
    porUsuario[key].rows.push(r);
  });

  // Agrupamento por frota/equipamento
  const porFrota: Record<string, { frota: string; tipo: string | null; rows: DiarioRow[] }> = {};
  diarios.forEach(r => {
    const key = r.equipment_fleet;
    if (!porFrota[key]) porFrota[key] = { frota: r.equipment_fleet, tipo: r.equipment_type, rows: [] };
    porFrota[key].rows.push(r);
  });

  // Filtrar por busca
  const usuariosFiltrados = Object.entries(porUsuario)
    .filter(([, v]) => !busca || v.nome.toLowerCase().includes(busca.toLowerCase()) || v.email.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome));

  const frotasFiltradas = Object.entries(porFrota)
    .filter(([, v]) => !busca || v.frota.toLowerCase().includes(busca.toLowerCase()) || (v.tipo || "").toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a[1].frota.localeCompare(b[1].frota));

  // ── Toggle expandido ──────────────────────────────────────────────────────────
  function toggleExpandido(key: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Export PDF via window.print ───────────────────────────────────────────────
  function exportarPDF() {
    window.print();
  }

  // ── Estatísticas rápidas ──────────────────────────────────────────────────────
  const totalEnviados  = diarios.filter(d => d.status === "enviado").length;
  const totalRascunhos = diarios.filter(d => d.status === "rascunho").length;
  const totalUsuarios  = Object.keys(porUsuario).length;
  const totalFrotas    = Object.keys(porFrota).length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── PRINT STYLE ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .print-container { padding: 0 !important; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg no-print">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => navigate("/relatorios")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Controle de Lançamentos</h1>
              <p className="text-slate-300 text-sm">Visão gerencial dos diários de equipamentos por usuário e por frota</p>
            </div>
            <Button onClick={exportarPDF} size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 no-print">
              <Download size={16} /> Exportar PDF
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 print-container" ref={printRef}>

          {/* ── CABEÇALHO PDF ── */}
          <div className="print-only mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-slate-800">Controle de Lançamentos — Workflux</h1>
            <p className="text-gray-500 text-sm mt-1">
              Período: {fmtDate(dataIni)} a {fmtDate(dataFim)} | Aba: {aba === "usuario" ? "Por Usuário" : "Por Equipamento"} | Gerado em: {new Date().toLocaleString("pt-BR")}
            </p>
          </div>

          {/* ── FILTROS ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5 no-print">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">DATA INÍCIO</label>
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
                  className="h-9 text-sm w-40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">DATA FIM</label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="h-9 text-sm w-40" />
              </div>
              <Button onClick={buscarDados} disabled={loading} className="h-9 bg-slate-700 hover:bg-slate-800 text-white gap-2">
                <Search size={15} /> {loading ? "Buscando..." : "Buscar"}
              </Button>
              <div className="flex-1 min-w-48">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">BUSCAR</label>
                <Input placeholder={aba === "usuario" ? "Nome ou email..." : "Frota ou tipo..."}
                  value={busca} onChange={e => setBusca(e.target.value)}
                  className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Usuários",    val: totalUsuarios,  color: "bg-blue-600",  icon: <Users size={18}/> },
              { label: "Frotas",      val: totalFrotas,    color: "bg-teal-600",  icon: <Wrench size={18}/> },
              { label: "✅ Enviados",  val: totalEnviados,  color: "bg-green-600", icon: <CheckCircle2 size={18}/> },
              { label: "📝 Rascunhos", val: totalRascunhos, color: "bg-orange-500",icon: <AlertCircle size={18}/> },
            ].map(k => (
              <div key={k.label} className={`${k.color} text-white rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
                <div className="opacity-80">{k.icon}</div>
                <div>
                  <div className="text-2xl font-bold">{k.val}</div>
                  <div className="text-xs opacity-80 font-medium">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ABAS ── */}
          <div className="flex gap-2 mb-5 no-print">
            {([
              { id: "usuario",    label: "Por Usuário",    icon: <Users size={15}/> },
              { id: "equipamento",label: "Por Equipamento",icon: <Wrench size={15}/> },
            ] as const).map(t => (
              <button key={t.id} onClick={() => { setAba(t.id); setBusca(""); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  aba === t.id
                    ? "bg-slate-800 text-white shadow"
                    : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              ABA: POR USUÁRIO
          ══════════════════════════════════════════════════════════════════ */}
          {aba === "usuario" && (
            <div className="space-y-3">
              {loading && (
                <div className="text-center py-16 text-gray-400 text-sm">Carregando lançamentos...</div>
              )}
              {!loading && usuariosFiltrados.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">Nenhum usuário encontrado para o período.</div>
              )}
              {!loading && usuariosFiltrados.map(([key, { nome, email, rows }]) => {
                const enviados  = rows.filter(r => r.status === "enviado");
                const diasUnicos = new Set(enviados.map(r => r.date)).size;
                const totalDias  = allDays.length;
                const pct        = Math.round((diasUnicos / totalDias) * 100);
                const exp        = expandidos.has(key);
                const badgeColor = pct === 100 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Header do card */}
                    <button onClick={() => toggleExpandido(key)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{nome}</div>
                        <div className="text-xs text-gray-400 truncate">{email}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`}>
                          {diasUnicos}/{totalDias} dias ({pct}%)
                        </span>
                        <span className="text-xs text-gray-400">{rows.length} registros</span>
                        {exp ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      </div>
                    </button>

                    {/* Calendário */}
                    {exp && (
                      <div className="border-t border-gray-100 p-4">
                        {/* Grade calendário */}
                        <div className="overflow-x-auto">
                          <div className="min-w-max">
                            {/* Labels dos dias */}
                            <div className="flex gap-1 mb-1">
                              {diasLabel.map(({ d, label, day, isWE }) => (
                                <div key={d} className={`w-20 text-center flex-shrink-0`}>
                                  <div className={`text-[10px] font-bold ${isWE ? "text-red-500" : "text-gray-500"}`}>{day}</div>
                                  <div className={`text-[11px] font-semibold ${isWE ? "text-red-400" : "text-gray-600"}`}>{label}</div>
                                </div>
                              ))}
                            </div>
                            {/* Células */}
                            <div className="flex gap-1">
                              {diasLabel.map(({ d }) => {
                                const dayRows = rows.filter(r => r.date === d);
                                return (
                                  <div key={d} className="w-20 flex-shrink-0">
                                    <CalCell rows={dayRows}
                                      onClick={() => setModal({ titulo: `${nome} — ${fmtDate(d)}`, rows: dayRows })}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Tabela de lançamentos */}
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                {["Data","Frota","Tipo","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"].map(h => (
                                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.sort((a,b)=>a.date.localeCompare(b.date)).map((r, i) => (
                                <tr key={i} className={`border-b border-gray-100 ${r.status === "rascunho" ? "bg-orange-50" : i%2===0 ? "bg-white" : "bg-gray-50/50"}`}>
                                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                                  <td className="px-2 py-1.5 font-bold text-slate-700 whitespace-nowrap">{r.equipment_fleet}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{r.equipment_type || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.ogs_number || "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[140px] truncate">{r.location_address || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap capitalize">{r.period || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(r.work_status)}`}>
                                      {statusIcon(r.work_status)} {r.work_status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.meter_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.meter_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.odometer_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.odometer_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.fuel_type || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.fuel_liters ?? "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[160px] truncate" title={r.observations || ""}>{r.observations || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === "enviado" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                                      {r.status === "enviado" ? "✅" : "📝"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-gray-400">{fmtDateTime(r.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ABA: POR EQUIPAMENTO
          ══════════════════════════════════════════════════════════════════ */}
          {aba === "equipamento" && (
            <div className="space-y-3">
              {loading && (
                <div className="text-center py-16 text-gray-400 text-sm">Carregando lançamentos...</div>
              )}
              {!loading && frotasFiltradas.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">Nenhum equipamento encontrado para o período.</div>
              )}
              {!loading && frotasFiltradas.map(([key, { frota, tipo, rows }]) => {
                const enviados   = rows.filter(r => r.status === "enviado");
                const diasUnicos = new Set(enviados.map(r => r.date)).size;
                const totalDias  = allDays.length;
                const pct        = Math.round((diasUnicos / totalDias) * 100);
                const exp        = expandidos.has("eq_" + key);
                const badgeColor = pct === 100 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
                const operadoresU = [...new Set(rows.map(r => r.usuario_nome))].join(", ");
                const ogsU        = [...new Set(rows.map(r => r.ogs_number).filter(Boolean))].join(", ");

                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpandido("eq_" + key)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        <Wrench size={18}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-base">{frota}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {tipo || "—"} {ogsU ? `| OGS: ${ogsU}` : ""} | {operadoresU}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`}>
                          {diasUnicos}/{totalDias} dias ({pct}%)
                        </span>
                        <span className="text-xs text-gray-400">{rows.length} registros</span>
                        {exp ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      </div>
                    </button>

                    {exp && (
                      <div className="border-t border-gray-100 p-4">
                        {/* Calendário por status */}
                        <div className="overflow-x-auto">
                          <div className="min-w-max">
                            <div className="flex gap-1 mb-1">
                              {diasLabel.map(({ d, label, day, isWE }) => (
                                <div key={d} className="w-20 text-center flex-shrink-0">
                                  <div className={`text-[10px] font-bold ${isWE ? "text-red-500" : "text-gray-500"}`}>{day}</div>
                                  <div className={`text-[11px] font-semibold ${isWE ? "text-red-400" : "text-gray-600"}`}>{label}</div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              {diasLabel.map(({ d }) => {
                                const dayRows = rows.filter(r => r.date === d);
                                return (
                                  <div key={d} className="w-20 flex-shrink-0">
                                    <CalCell rows={dayRows}
                                      onClick={() => setModal({ titulo: `${frota} — ${fmtDate(d)}`, rows: dayRows })}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Tabela */}
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                {["Data","Operador","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"].map(h => (
                                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.sort((a,b)=>a.date.localeCompare(b.date)).map((r, i) => (
                                <tr key={i} className={`border-b border-gray-100 ${r.status === "rascunho" ? "bg-orange-50" : i%2===0 ? "bg-white" : "bg-gray-50/50"}`}>
                                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                                  <td className="px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{r.usuario_nome}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.ogs_number || "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[140px] truncate">{r.location_address || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap capitalize">{r.period || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(r.work_status)}`}>
                                      {statusIcon(r.work_status)} {r.work_status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.meter_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.meter_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.odometer_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.odometer_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.fuel_type || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-center">{r.fuel_liters ?? "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[160px] truncate" title={r.observations || ""}>{r.observations || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === "enviado" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                                      {r.status === "enviado" ? "✅" : "📝"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-gray-400">{fmtDateTime(r.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── MODAL DETALHE DIA ─────────────────────────────────────────────── */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print"
            onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{modal.titulo}</h3>
                  <p className="text-slate-300 text-sm">{modal.rows.length} registro(s)</p>
                </div>
                <button onClick={() => setModal(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
              </div>
              <div className="p-6 space-y-4">
                {modal.rows.map((r, i) => (
                  <div key={i} className={`rounded-xl border p-4 ${r.status === "rascunho" ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="font-bold text-slate-800 text-base">{r.equipment_fleet}</span>
                        {r.equipment_type && <span className="ml-2 text-xs text-gray-500">{r.equipment_type}</span>}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor(r.work_status)}`}>
                        {statusIcon(r.work_status)} {r.work_status || "—"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ["Operador", r.operator_name || r.usuario_nome],
                        ["Usuário", r.usuario_nome],
                        ["OGS", r.ogs_number || "—"],
                        ["Local", r.location_address || "—"],
                        ["Turno", r.period ? r.period.charAt(0).toUpperCase() + r.period.slice(1) : "—"],
                        ["Hor. Ini → Fin", r.meter_initial !== null ? `${r.meter_initial} → ${r.meter_final ?? "—"}` : "—"],
                        ["Odo. Ini → Fin", r.odometer_initial !== null ? `${r.odometer_initial} → ${r.odometer_final ?? "—"}` : "—"],
                        ["Combustível", r.fuel_type ? `${r.fuel_type}${r.fuel_liters ? ` — ${r.fuel_liters}L` : ""}` : "—"],
                        ["Lançado em", fmtDateTime(r.created_at)],
                        ["Status envio", r.status === "enviado" ? "✅ Enviado" : "📝 Rascunho"],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <span className="text-gray-400 text-xs">{label}</span>
                          <p className="font-medium text-slate-700 text-xs">{val}</p>
                        </div>
                      ))}
                    </div>
                    {r.observations && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-400 text-xs">Observações</span>
                        <p className="text-slate-700 text-xs mt-0.5">{r.observations}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

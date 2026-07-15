import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Download, Users, Wrench,
  ChevronDown, ChevronUp, CheckCircle2, Clock,
  AlertCircle, FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
}

interface UsuarioCard {
  key: string;
  nome: string;
  email: string;
  rows: DiarioRow[];
  semLancamento: boolean; // veio da lista mestre, sem dados
}

interface FrotaCard {
  key: string;
  frota: string;
  tipo: string;
  rows: DiarioRow[];
  semLancamento: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} (${DIAS[dt.getDay()]})`;
}

function fmtDateTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("pt-BR", {
    day:"2-digit", month:"2-digit", year:"2-digit",
    hour:"2-digit", minute:"2-digit",
  });
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

// ─── CalCell ──────────────────────────────────────────────────────────────────

function CalCell({ rows, onClick }: { rows: DiarioRow[]; onClick: () => void }) {
  if (rows.length === 0) {
    return (
      <div className="w-full h-10 rounded flex items-center justify-center bg-red-50 border border-red-200">
        <span className="text-red-400 text-xs">❌</span>
      </div>
    );
  }
  const env = rows.filter(r => r.status === "enviado");
  const ras = rows.filter(r => r.status === "rascunho");
  return (
    <button onClick={onClick}
      className="w-full min-h-[40px] rounded flex flex-col gap-0.5 px-1 py-1 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
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

  const [aba, setAba]           = useState<"usuario" | "equipamento">("usuario");
  const [dataIni, setDataIni]   = useState(primeiroDia);
  const [dataFim, setDataFim]   = useState(ultimoDia);
  const [busca, setBusca]       = useState("");
  const [tipoFiltro, setTipoFiltro]           = useState("");
  const [apenasSemlancamento, setApenasSemlancamento] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [diarios, setDiarios]   = useState<DiarioRow[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [todasFrotas, setTodasFrotas]     = useState<{ frota: string; tipo: string }[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ titulo: string; rows: DiarioRow[] } | null>(null);

  // ── Busca ──────────────────────────────────────────────────────────────────
  const buscarDados = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // 1 — diários do período
      const { data: raw, error } = await (supabase as any)
        .from("equipment_diaries")
        .select(`date, operator_name, equipment_fleet, equipment_type,
          ogs_number, location_address, period, work_status,
          meter_initial, meter_final, odometer_initial, odometer_final,
          fuel_type, fuel_liters, observations, status, created_at, user_id`)
        .eq("company_id", companyId)
        .gte("date", dataIni)
        .lte("date", dataFim)
        .order("date", { ascending: true });

      if (error) { console.error("[ControleLancamentos]", error); setLoading(false); return; }

      // 2 — profiles dos user_ids únicos
      const userIds = [...new Set(((raw as any[]) || []).map((d: any) => d.user_id).filter(Boolean))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, nome_completo, email").in("user_id", userIds)
        : { data: [] };
      const profileMap: Record<string, { nome: string; email: string }> = {};
      (profilesData || []).forEach((p: any) => {
        profileMap[p.user_id] = { nome: p.nome_completo || "—", email: p.email || "" };
      });

      const rows: DiarioRow[] = ((raw as any[]) || []).map((d: any) => ({
        date: d.date,
        operator_name: d.operator_name,
        equipment_fleet: d.equipment_fleet || "—",
        equipment_type: d.equipment_type || null,
        ogs_number: d.ogs_number || null,
        location_address: d.location_address || null,
        period: d.period || null,
        work_status: d.work_status || null,
        meter_initial: d.meter_initial ?? null,
        meter_final: d.meter_final ?? null,
        odometer_initial: d.odometer_initial ?? null,
        odometer_final: d.odometer_final ?? null,
        fuel_type: d.fuel_type || null,
        fuel_liters: d.fuel_liters ?? null,
        observations: d.observations || null,
        status: d.status || "rascunho",
        created_at: d.created_at,
        usuario_id: d.user_id || "",
        usuario_nome: profileMap[d.user_id]?.nome || d.operator_name || "—",
        usuario_email: profileMap[d.user_id]?.email || "",
      }));
      setDiarios(rows);

      // 3 — todos usuários ativos da empresa (para filtro sem lançamento)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, nome_completo, email")
        .eq("company_id", companyId)
        .eq("status", "ativo");
      setTodosUsuarios(((allProfiles || []) as any[]).map((p: any) => ({
        id: p.user_id || "",
        nome: p.nome_completo || "—",
        email: p.email || "",
      })));

      // 4 — todos equipamentos da empresa (para filtro sem lançamento)
      const { data: allEquip } = await (supabase as any)
        .from("equipamentos")
        .select("frota, tipo")
        .eq("company_id", companyId)
        .order("frota");
      setTodasFrotas(((allEquip || []) as any[]).map((e: any) => ({
        frota: e.frota || "—",
        tipo: e.tipo || "",
      })));

    } catch (err) {
      console.error("[ControleLancamentos]", err);
    }
    setLoading(false);
  };

  useEffect(() => { if (companyId) buscarDados(); }, [companyId]);

  // ── Derivar ────────────────────────────────────────────────────────────────
  const allDays = getAllDays(dataIni, dataFim);
  const diasLabel = allDays.map(d => {
    const dt = new Date(d + "T12:00:00");
    return {
      d,
      label: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`,
      day: DIAS[dt.getDay()],
      isWE: dt.getDay() === 0 || dt.getDay() === 6,
    };
  });

  // Mapa frota → tipo canônico (fonte: tabela equipamentos)
  const frotaToTipo: Record<string, string> = {};
  todasFrotas.forEach(f => { if (f.frota) frotaToTipo[f.frota] = f.tipo; });

  // Agrupamento por usuário
  const porUsuario: Record<string, { nome: string; email: string; rows: DiarioRow[] }> = {};
  diarios.forEach(r => {
    const k = r.usuario_id || r.usuario_nome;
    if (!porUsuario[k]) porUsuario[k] = { nome: r.usuario_nome, email: r.usuario_email, rows: [] };
    porUsuario[k].rows.push(r);
  });

  // Agrupamento por frota — tipo SEMPRE vem do mapa canônico (equipamentos)
  const porFrota: Record<string, { frota: string; tipo: string; rows: DiarioRow[] }> = {};
  diarios.forEach(r => {
    const k = r.equipment_fleet;
    const tipoCanon = frotaToTipo[r.equipment_fleet] || r.equipment_type || "";
    if (!porFrota[k]) porFrota[k] = { frota: r.equipment_fleet, tipo: tipoCanon, rows: [] };
    porFrota[k].rows.push(r);
  });

  // Sets de quem lançou
  const usuariosComLancamento = new Set(diarios.filter(r => r.status === "enviado").map(r => r.usuario_id));
  const frotasComLancamento   = new Set(diarios.filter(r => r.status === "enviado").map(r => r.equipment_fleet));

  // Tipos únicos — SOMENTE da tabela equipamentos (fonte canônica), sem misturar texto livre dos diários
  const tiposEquipamento = [...new Set(
    todasFrotas.map(f => f.tipo?.trim().toUpperCase()).filter(Boolean) as string[]
  )].sort();

  // ── Cards de usuários ─────────────────────────────────────────────────────
  const usuarioCards: UsuarioCard[] = apenasSemlancamento
    ? todosUsuarios
        .filter(u => !usuariosComLancamento.has(u.id))
        .filter(u => !busca || u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()))
        .map(u => ({ key: u.id, nome: u.nome, email: u.email, rows: [], semLancamento: true }))
    : Object.entries(porUsuario)
        .filter(([, v]) => !busca || v.nome.toLowerCase().includes(busca.toLowerCase()) || v.email.toLowerCase().includes(busca.toLowerCase()))
        .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
        .map(([k, v]) => ({ key: k, nome: v.nome, email: v.email, rows: v.rows, semLancamento: false }));

  // ── Cards de frotas ───────────────────────────────────────────────────────
  const frotaCards: FrotaCard[] = apenasSemlancamento
    ? todasFrotas
        .filter(f => !frotasComLancamento.has(f.frota))
        .filter(f => !tipoFiltro || f.tipo.trim().toUpperCase() === tipoFiltro)
        .filter(f => !busca || f.frota.toLowerCase().includes(busca.toLowerCase()) || f.tipo.toLowerCase().includes(busca.toLowerCase()))
        .map(f => ({ key: f.frota, frota: f.frota, tipo: f.tipo, rows: [], semLancamento: true }))
    : Object.entries(porFrota)
        .filter(([, v]) => !tipoFiltro || v.tipo.trim().toUpperCase() === tipoFiltro.trim().toUpperCase())
        .filter(([, v]) => !busca || v.frota.toLowerCase().includes(busca.toLowerCase()) || v.tipo.toLowerCase().includes(busca.toLowerCase()))
        .sort((a, b) => a[1].frota.localeCompare(b[1].frota))
        .map(([k, v]) => ({ key: k, frota: v.frota, tipo: v.tipo, rows: v.rows, semLancamento: false }));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalEnviados  = diarios.filter(d => d.status === "enviado").length;
  const totalRascunhos = diarios.filter(d => d.status === "rascunho").length;

  function toggleExpandido(key: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg no-print">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => navigate("/relatorios")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Controle de Lançamentos</h1>
              <p className="text-slate-300 text-sm">Visão gerencial dos diários de equipamentos por usuário e por frota</p>
            </div>
            <Button onClick={() => window.print()} size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 no-print">
              <Download size={16} /> Exportar PDF
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* FILTROS */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5 no-print">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">DATA INÍCIO</label>
                <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-9 text-sm w-40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">DATA FIM</label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 text-sm w-40" />
              </div>
              <Button onClick={buscarDados} disabled={loading} className="h-9 bg-slate-700 hover:bg-slate-800 text-white gap-2">
                <Search size={15} /> {loading ? "Buscando..." : "Buscar"}
              </Button>

              {/* Filtro tipo — só na aba equipamento */}
              {aba === "equipamento" && tiposEquipamento.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">TIPO DE EQUIPAMENTO</label>
                  <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
                    className="h-9 text-sm border border-gray-200 rounded-md px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[180px]">
                    <option value="">Todos os tipos</option>
                    {tiposEquipamento.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div className="flex-1 min-w-48">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">BUSCAR</label>
                <Input placeholder={aba === "usuario" ? "Nome ou email..." : "Frota ou tipo..."}
                  value={busca} onChange={e => setBusca(e.target.value)} className="h-9 text-sm" />
              </div>

              {/* Só sem lançamentos */}
              <div className="self-end pb-0.5">
                <button onClick={() => setApenasSemlancamento(v => !v)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border transition-all ${
                    apenasSemlancamento
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  <FileX size={15} /> Só sem lançamentos
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Usuários",     val: Object.keys(porUsuario).length, color: "bg-blue-600",   icon: <Users size={18}/> },
              { label: "Frotas",       val: Object.keys(porFrota).length,   color: "bg-teal-600",   icon: <Wrench size={18}/> },
              { label: "✅ Enviados",   val: totalEnviados,                  color: "bg-green-600",  icon: <CheckCircle2 size={18}/> },
              { label: "📝 Rascunhos",  val: totalRascunhos,                 color: "bg-orange-500", icon: <AlertCircle size={18}/> },
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

          {/* ABAS */}
          <div className="flex gap-2 mb-5 no-print">
            {(["usuario","equipamento"] as const).map(id => (
              <button key={id}
                onClick={() => { setAba(id); setBusca(""); setTipoFiltro(""); setApenasSemlancamento(false); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  aba === id ? "bg-slate-800 text-white shadow" : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
                }`}>
                {id === "usuario" ? <><Users size={15}/> Por Usuário</> : <><Wrench size={15}/> Por Equipamento</>}
              </button>
            ))}
          </div>

          {/* ═══ ABA: POR USUÁRIO ═══ */}
          {aba === "usuario" && (
            <div className="space-y-3">
              {loading && <div className="text-center py-16 text-gray-400 text-sm">Carregando lançamentos...</div>}
              {!loading && usuarioCards.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">
                  {apenasSemlancamento ? "🎉 Todos os usuários lançaram no período!" : "Nenhum usuário encontrado para o período."}
                </div>
              )}
              {!loading && usuarioCards.map(card => {
                const enviados   = card.rows.filter(r => r.status === "enviado");
                const diasUnicos = new Set(enviados.map(r => r.date)).size;
                const pct        = card.semLancamento ? 0 : Math.round((diasUnicos / allDays.length) * 100);
                const exp        = expandidos.has(card.key);
                const badgeColor = card.semLancamento || pct === 0
                  ? "bg-red-100 text-red-700"
                  : pct === 100 ? "bg-green-100 text-green-700"
                  : pct >= 70  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700";

                return (
                  <div key={card.key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => !card.semLancamento && toggleExpandido(card.key)}
                      className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${card.semLancamento ? "cursor-default" : "hover:bg-gray-50"}`}>
                      <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {card.nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{card.nome}</div>
                        <div className="text-xs text-gray-400 truncate">{card.email}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`}>
                          {card.semLancamento ? "0 lançamentos" : `${diasUnicos}/${allDays.length} dias (${pct}%)`}
                        </span>
                        <span className="text-xs text-gray-400">{card.rows.length} registros</span>
                        {!card.semLancamento && (exp ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>)}
                      </div>
                    </button>

                    {exp && !card.semLancamento && (
                      <div className="border-t border-gray-100 p-4">
                        {/* Calendário */}
                        <div className="overflow-x-auto mb-4">
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
                                const dayRows = card.rows.filter(r => r.date === d);
                                return (
                                  <div key={d} className="w-20 flex-shrink-0">
                                    <CalCell rows={dayRows}
                                      onClick={() => { if (dayRows.length > 0) setModal({ titulo: `${card.nome} — ${fmtDate(d)}`, rows: dayRows }); }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {/* Tabela */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                {["Data","Frota","Tipo","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"].map(h => (
                                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...card.rows].sort((a,b) => a.date.localeCompare(b.date)).map((r, i) => (
                                <tr key={i} className={`border-b border-gray-100 ${r.status === "rascunho" ? "bg-orange-50" : i%2===0 ? "bg-white" : "bg-gray-50/50"}`}>
                                  <td className="px-2 py-1.5 whitespace-nowrap font-medium">{fmtDate(r.date)}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap font-bold text-slate-700">{r.equipment_fleet}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{r.equipment_type || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.ogs_number || "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[140px] truncate">{r.location_address || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap capitalize">{r.period || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(r.work_status)}`}>
                                      {statusIcon(r.work_status)} {r.work_status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-center">{r.meter_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.meter_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.odometer_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.odometer_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.fuel_type || "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.fuel_liters ?? "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[160px] truncate" title={r.observations || ""}>{r.observations || "—"}</td>
                                  <td className="px-2 py-1.5">
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

          {/* ═══ ABA: POR EQUIPAMENTO ═══ */}
          {aba === "equipamento" && (
            <div className="space-y-3">
              {loading && <div className="text-center py-16 text-gray-400 text-sm">Carregando lançamentos...</div>}
              {!loading && frotaCards.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">
                  {apenasSemlancamento ? "🎉 Todos os equipamentos lançaram no período!" : "Nenhum equipamento encontrado para o período."}
                </div>
              )}
              {!loading && frotaCards.map(card => {
                const enviados   = card.rows.filter(r => r.status === "enviado");
                const diasUnicos = new Set(enviados.map(r => r.date)).size;
                const pct        = card.semLancamento ? 0 : Math.round((diasUnicos / allDays.length) * 100);
                const exp        = expandidos.has("eq_" + card.key);
                const badgeColor = card.semLancamento || pct === 0
                  ? "bg-red-100 text-red-700"
                  : pct === 100 ? "bg-green-100 text-green-700"
                  : pct >= 70  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700";
                const operadoresU = [...new Set(card.rows.map(r => r.usuario_nome))].join(", ");
                const ogsU = [...new Set(card.rows.map(r => r.ogs_number).filter(Boolean))].join(", ");

                return (
                  <div key={card.key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => !card.semLancamento && toggleExpandido("eq_" + card.key)}
                      className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${card.semLancamento ? "cursor-default" : "hover:bg-gray-50"}`}>
                      <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center flex-shrink-0">
                        <Wrench size={18}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-base">{card.frota}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {card.tipo || "—"}{ogsU ? ` | OGS: ${ogsU}` : ""}{operadoresU ? ` | ${operadoresU}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`}>
                          {card.semLancamento ? "0 lançamentos" : `${diasUnicos}/${allDays.length} dias (${pct}%)`}
                        </span>
                        <span className="text-xs text-gray-400">{card.rows.length} registros</span>
                        {!card.semLancamento && (exp ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>)}
                      </div>
                    </button>

                    {exp && !card.semLancamento && (
                      <div className="border-t border-gray-100 p-4">
                        {/* Calendário */}
                        <div className="overflow-x-auto mb-4">
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
                                const dayRows = card.rows.filter(r => r.date === d);
                                return (
                                  <div key={d} className="w-20 flex-shrink-0">
                                    <CalCell rows={dayRows}
                                      onClick={() => { if (dayRows.length > 0) setModal({ titulo: `${card.frota} — ${fmtDate(d)}`, rows: dayRows }); }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {/* Tabela */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                {["Data","Operador","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"].map(h => (
                                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...card.rows].sort((a,b) => a.date.localeCompare(b.date)).map((r, i) => (
                                <tr key={i} className={`border-b border-gray-100 ${r.status === "rascunho" ? "bg-orange-50" : i%2===0 ? "bg-white" : "bg-gray-50/50"}`}>
                                  <td className="px-2 py-1.5 whitespace-nowrap font-medium">{fmtDate(r.date)}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-slate-700">{r.usuario_nome}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.ogs_number || "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[140px] truncate">{r.location_address || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap capitalize">{r.period || "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(r.work_status)}`}>
                                      {statusIcon(r.work_status)} {r.work_status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-center">{r.meter_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.meter_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.odometer_initial ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.odometer_final ?? "—"}</td>
                                  <td className="px-2 py-1.5 whitespace-nowrap">{r.fuel_type || "—"}</td>
                                  <td className="px-2 py-1.5 text-center">{r.fuel_liters ?? "—"}</td>
                                  <td className="px-2 py-1.5 max-w-[160px] truncate" title={r.observations || ""}>{r.observations || "—"}</td>
                                  <td className="px-2 py-1.5">
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

        {/* MODAL */}
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
                        ["Status", r.status === "enviado" ? "✅ Enviado" : "📝 Rascunho"],
                      ].map(([label, val]) => (
                        <div key={label as string}>
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

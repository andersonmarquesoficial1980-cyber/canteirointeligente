import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Search, Calendar, Truck, ClipboardList, Fuel,
  AlertTriangle, CheckCircle, Clock, Wrench, FileText, Download,
  ChevronRight, Filter, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const STATUS_COLOR: Record<string, string> = {
  "Trabalhando":  "bg-green-100 text-green-700",
  "Folga":        "bg-gray-100 text-gray-500",
  "Inoperante":   "bg-red-100 text-red-600",
  "Disposição":   "bg-blue-100 text-blue-600",
  "Cancelou":     "bg-orange-100 text-orange-600",
};

// ─── SEÇÃO: Busca Histórica ───────────────────────────────────────────────────
function BuscaHistorica() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<"equipamento" | "rdo">("equipamento");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [frota, setFrota] = useState("");
  const [ogs, setOgs] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    setLoading(true);
    setResultados([]);
    try {
      if (tipo === "equipamento") {
        let q = supabase.from("equipment_diaries").select("*").eq("date", data).order("equipment_fleet");
        if (frota) q = q.ilike("equipment_fleet", `%${frota}%`);
        const { data: res } = await q;
        setResultados(res || []);
      } else {
        let q = supabase.from("rdos").select("*").eq("data", data).order("created_at", { ascending: false });
        if (ogs) q = q.ilike("obra_nome", `%${ogs}%`);
        const { data: res } = await q;
        setResultados(res || []);
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="rdo-card space-y-4">
      <h3 className="font-display font-bold text-sm flex items-center gap-2">
        <Search className="w-4 h-4 text-primary" /> Busca Histórica
      </h3>

      <div className="flex gap-2">
        <button onClick={() => setTipo("equipamento")} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tipo === "equipamento" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
          🚜 Equipamentos
        </button>
        <button onClick={() => setTipo("rdo")} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tipo === "rdo" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}>
          🏗️ RDOs
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <span className="rdo-label">Data</span>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <span className="rdo-label">{tipo === "equipamento" ? "Frota (opcional)" : "OGS (opcional)"}</span>
          <Input
            value={tipo === "equipamento" ? frota : ogs}
            onChange={e => tipo === "equipamento" ? setFrota(e.target.value) : setOgs(e.target.value)}
            placeholder={tipo === "equipamento" ? "Ex: FA14" : "Ex: 2535"}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      <Button onClick={buscar} disabled={loading} className="w-full h-10 rounded-xl font-semibold gap-2">
        {loading ? "Buscando..." : <><Search className="w-4 h-4" /> Buscar</>}
      </Button>

      {resultados.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center italic">Nenhum resultado.</p>
      )}

      {resultados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold">{resultados.length} resultado{resultados.length !== 1 ? "s" : ""} em {fmtDate(data)}</p>
          {tipo === "equipamento" ? (
            resultados.map((r, i) => (
              <div key={i} className="border border-border rounded-xl p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">{r.equipment_fleet}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[r.work_status] || "bg-gray-100 text-gray-500"}`}>{r.work_status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.equipment_type} · {r.period}</p>
                {r.operator_name && <p className="text-xs">👷 {r.operator_name}</p>}
                {r.ogs_number && <p className="text-xs">OGS: {r.ogs_number} — {r.client_name}</p>}
                {r.location_address && <p className="text-xs">📍 {r.location_address}</p>}
                {r.meter_initial && r.meter_final && (
                  <p className="text-xs">⏱ Hor: {r.meter_initial} → {r.meter_final} ({(r.meter_final - r.meter_initial).toFixed(1)}h)</p>
                )}
                {r.fuel_liters && <p className="text-xs">⛽ {r.fuel_liters} L</p>}
              </div>
            ))
          ) : (
            resultados.map((r, i) => (
              <div key={i} className="border border-border rounded-xl p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">OGS {r.obra_nome}</span>
                  <span className="text-xs text-muted-foreground">{r.tipo_rdo}</span>
                </div>
                {r.cliente && <p className="text-xs">🏢 {r.cliente}</p>}
                {r.local && <p className="text-xs">📍 {r.local}</p>}
                {r.responsavel && <p className="text-xs">👷 {r.responsavel}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: Status do dia ──────────────────────────────────────────────────────
function StatusDia() {
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [diarios, setDiarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    setLoading(true);
    const { data: res } = await supabase
      .from("equipment_diaries")
      .select("equipment_fleet, equipment_type, work_status, operator_name, ogs_number, client_name, location_address, period")
      .eq("date", data)
      .order("equipment_fleet");
    setDiarios(res || []);
    setLoading(false);
  }

  useEffect(() => { buscar(); }, [data]);

  const counts = {
    trabalhando: diarios.filter(d => d.work_status === "Trabalhando").length,
    folga: diarios.filter(d => d.work_status === "Folga").length,
    inoperante: diarios.filter(d => d.work_status === "Inoperante").length,
    outros: diarios.filter(d => !["Trabalhando", "Folga", "Inoperante"].includes(d.work_status)).length,
  };

  return (
    <div className="rdo-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Status dos Equipamentos
        </h3>
        <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 rounded-xl w-36 text-xs" />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-green-50 rounded-xl p-2">
          <p className="text-lg font-display font-bold text-green-700">{counts.trabalhando}</p>
          <p className="text-[9px] text-green-600 font-medium">Trabalhando</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-lg font-display font-bold text-gray-500">{counts.folga}</p>
          <p className="text-[9px] text-gray-400 font-medium">Folga</p>
        </div>
        <div className="bg-red-50 rounded-xl p-2">
          <p className="text-lg font-display font-bold text-red-600">{counts.inoperante}</p>
          <p className="text-[9px] text-red-500 font-medium">Inoperante</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2">
          <p className="text-lg font-display font-bold text-blue-600">{diarios.length}</p>
          <p className="text-[9px] text-blue-500 font-medium">Total</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center">Carregando...</p>
      ) : diarios.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center italic">Nenhum diário nessa data.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {diarios.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs border border-border rounded-lg px-2 py-1.5">
              <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] flex-shrink-0 ${STATUS_COLOR[d.work_status] || "bg-gray-100 text-gray-500"}`}>{d.work_status?.slice(0,4)}</span>
              <span className="font-bold flex-shrink-0">{d.equipment_fleet}</span>
              <span className="text-muted-foreground truncate">{d.operator_name}</span>
              {d.ogs_number && <span className="text-muted-foreground flex-shrink-0">OGS {d.ogs_number}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SEÇÃO: Alertas ────────────────────────────────────────────────────────────
function Alertas() {
  const [osUrgentes, setOsUrgentes] = useState<any[]>([]);
  const [docsVencendo, setDocsVencendo] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      supabase.from("manutencao_os").select("id,numero_os,equipment_fleet,titulo,prioridade,status").in("status", ["aberta", "em_andamento"]).in("prioridade", ["alta", "urgente"]).order("prioridade"),
      supabase.from("manutencao_documentos").select("equipment_fleet,tipo_documento,data_vencimento").not("data_vencimento", "is", null),
    ]).then(([{ data: os }, { data: docs }]) => {
      setOsUrgentes(os || []);
      const hoje = new Date();
      const vencendo = (docs || [])
        .map(d => ({ ...d, dias: Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / 86400000) }))
        .filter(d => d.dias <= 30)
        .sort((a, b) => a.dias - b.dias);
      setDocsVencendo(vencendo);
    });
  }, []);

  if (osUrgentes.length === 0 && docsVencendo.length === 0) return (
    <div className="rdo-card">
      <h3 className="font-display font-bold text-sm flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" /> Alertas
      </h3>
      <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Tudo em ordem!</p>
    </div>
  );

  return (
    <div className="rdo-card space-y-3">
      <h3 className="font-display font-bold text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" /> Alertas ({osUrgentes.length + docsVencendo.length})
      </h3>
      {osUrgentes.map((o, i) => (
        <button key={i} onClick={() => navigate(`/manutencao/os/${o.id}`)} className="w-full text-left flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
          <Wrench className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700">OS #{o.numero_os} — {o.equipment_fleet}</p>
            <p className="text-[10px] text-red-600 truncate">{o.titulo}</p>
          </div>
          <span className="text-[10px] font-bold text-red-600 uppercase">{o.prioridade}</span>
        </button>
      ))}
      {docsVencendo.map((d, i) => (
        <button key={i} onClick={() => navigate("/manutencao/documentos")} className="w-full text-left flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl p-2.5">
          <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-700">{d.equipment_fleet} — {d.tipo_documento}</p>
            <p className="text-[10px] text-orange-600">{d.dias <= 0 ? "⛔ VENCIDO" : `Vence em ${d.dias} dias`}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── SEÇÃO: Abastecimento do dia ───────────────────────────────────────────────
function AbastecimentoDia() {
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("abastecimentos").select("*").eq("data", data).order("equipment_fleet")
      .then(({ data: res }) => setItems(res || []));
  }, [data]);

  const total = items.reduce((s, a) => s + (a.litros || 0), 0);

  return (
    <div className="rdo-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm flex items-center gap-2">
          <Fuel className="w-4 h-4 text-orange-500" /> Abastecimento
        </h3>
        <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 rounded-xl w-36 text-xs" />
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center">Nenhum abastecimento.</p>
      ) : (
        <>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs border border-border rounded-lg px-2 py-1.5">
                <span className="font-bold text-orange-600 flex-shrink-0">{a.litros.toFixed(0)}L</span>
                <span className="font-bold flex-shrink-0">{a.equipment_fleet}</span>
                <span className="text-muted-foreground capitalize flex-shrink-0">{a.fonte}</span>
                {a.lubrificado && <span className="text-amber-600">🔧</span>}
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 text-xs font-bold text-orange-600 text-right">
            Total: {total.toFixed(1)} L
          </div>
        </>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Painel Administrativo</span>
          <span className="block text-[11px] text-primary-foreground/80">Visão geral em tempo real</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Alertas />
        <StatusDia />
        <AbastecimentoDia />
        <BuscaHistorica />

        {/* Atalhos */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "WF Manutenção", icon: Wrench, route: "/manutencao", color: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "WF Abastecimento", icon: Fuel, route: "/abastecimento", color: "bg-orange-50 text-orange-700 border-orange-200" },
            { label: "WF Relatórios", icon: BarChart3, route: "/relatorios", color: "bg-purple-50 text-purple-700 border-purple-200" },
            { label: "WF Documentos", icon: FileText, route: "/documentos", color: "bg-green-50 text-green-700 border-green-200" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button key={item.route} onClick={() => navigate(item.route)} className={`flex items-center gap-2 p-3 rounded-xl border font-semibold text-sm ${item.color} transition-all hover:shadow-sm`}>
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

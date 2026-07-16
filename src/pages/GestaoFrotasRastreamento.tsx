/**
 * GestaoFrotasRastreamento — Dashboard de Rastreamento Unificado
 * Rota: /gestao-frotas/rastreamento
 *
 * LÓGICA DE RASTREAMENTO (simplificada — uma fonte por vez):
 *
 * Para equipamentos COM diário histórico:
 *   → Mostra o ÚLTIMO diário registrado (qualquer data), com indicação de quando foi
 *   → "Trabalhando/Disposição/Manutenção" vem do work_status do último diário
 *   → Hoje sem diário = badge "Sem diário hoje" — mas localização ainda é exibida
 *
 * Para equipamentos SEM nenhum diário:
 *   → Localização vem do campo `setor` do cadastro (equipe/obra onde está alocado)
 *   → Se não tem setor: realmente sem informação
 *
 * NÃO MISTURA fontes — o setor do cadastro é o fallback quando não há diário.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, MapPin, AlertTriangle,
  Truck, Bot, CheckCircle2, Wrench, Clock,
  ChevronDown, ChevronUp, Search, Filter, CalendarDays
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

type FonteInfo = "diario_manual" | "diario_auto" | "setor_cadastro" | "sem_info";
type StatusOperacao = "trabalhando" | "disposicao" | "manutencao" | "transporte" | "folga" | "patio" | "sem_info";

interface EquipRastreio {
  id: string;
  frota: string;
  tipo: string;
  setor: string | null;
  // Localização
  localAtual: string;
  ogsAtual: string | null;
  statusOperacao: StatusOperacao;
  operador: string | null;
  // Rastreabilidade
  fonte: FonteInfo;
  ultimaDiarioData: string | null;   // data do último diário
  diasSemDiario: number | null;      // dias desde o último diário
  temDiarioHoje: boolean;
  isAutoHoje: boolean;
  // Transporte via carreta
  carretaTransporte: string | null;
  destinoTransporte: string | null;
}

const STATUS_CFG: Record<StatusOperacao, { label: string; dot: string; badge: string; bgRow: string }> = {
  trabalhando:  { label: "Trabalhando",    dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", bgRow: "bg-white" },
  disposicao:   { label: "À Disposição",   dot: "bg-blue-400",    badge: "bg-blue-100 text-blue-700 border border-blue-200",         bgRow: "bg-white" },
  manutencao:   { label: "Manutenção",     dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border border-amber-200",       bgRow: "bg-amber-50" },
  transporte:   { label: "Em Transporte",  dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 border border-purple-200",    bgRow: "bg-purple-50" },
  folga:        { label: "Folga/Parado",   dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border border-slate-200",       bgRow: "bg-slate-50" },
  patio:        { label: "No Pátio",       dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border border-slate-200",       bgRow: "bg-slate-50" },
  sem_info:     { label: "Sem informação", dot: "bg-gray-300",    badge: "bg-gray-100 text-gray-500 border border-gray-200",          bgRow: "bg-white" },
};

function resolverStatus(workStatus: string | null, setor: string | null, diarioData: string | null): StatusOperacao {
  if (!workStatus) {
    // Sem diário — inferir pelo setor
    const s = (setor || "").toUpperCase();
    if (s.includes("MANUTENÇÃO") || s.includes("MANUTENCAO")) return "manutencao";
    if (s.includes("DISPOSIÇÃO") || s.includes("DISPOSICAO")) return "disposicao";
    return "sem_info";
  }
  const ws = workStatus.toLowerCase();
  if (ws.includes("manuten")) return "manutencao";
  if (ws.includes("disposição") || ws.includes("disposicao")) return "disposicao";
  // "Em Transporte" só vale se o diário for de hoje — senão o equip já chegou
  if (ws.includes("transporte")) {
    const hoje = new Date().toISOString().split("T")[0];
    return diarioData === hoje ? "transporte" : "trabalhando";
  }
  if (ws.includes("folga") || ws.includes("cancelou") || ws.includes("inoperante")) return "folga";
  if (ws.includes("pátio") || ws.includes("patio")) return "patio";
  return "trabalhando";
}

function diasAtras(dataStr: string | null): number | null {
  if (!dataStr) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(dataStr + "T00:00:00");
  return Math.round((hoje.getTime() - data.getTime()) / 86400000);
}

function labelDias(d: number | null): string {
  if (d === null) return "sem diário";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

function corDias(d: number | null): string {
  if (d === null) return "text-gray-400";
  if (d === 0) return "text-emerald-600 font-semibold";
  if (d <= 2) return "text-blue-600";
  if (d <= 7) return "text-amber-600";
  return "text-red-600 font-semibold";
}

export default function GestaoFrotasRastreamento() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<EquipRastreio[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusOperacao | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];

    // 1. Todos equipamentos ativos
    const { data: equips } = await (supabase as any)
      .from("equipamentos")
      .select("id, frota, tipo, setor, status")
      .eq("company_id", COMPANY_ID)
      .eq("status", "ativo")
      .not("frota", "is", null)
      .order("tipo").order("frota");

    if (!equips?.length) { setLista([]); setLoading(false); return; }

    const frotas = equips.map((e: any) => e.frota!);

    // 2. Último diário de cada equipamento (qualquer data, manual ou auto)
    //    Buscamos os últimos 10 dias de diários para pegar o mais recente de cada frota
    const { data: diarios } = await (supabase as any)
      .from("equipment_diaries")
      .select("equipment_fleet, date, work_status, location_address, ogs_number, operator_name, is_auto, status")
      .eq("company_id", COMPANY_ID)
      .in("status", ["enviado", "auto"])
      .in("equipment_fleet", frotas)
      .gte("date", (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; })())
      .order("date", { ascending: false });

    // 3. Transportes de hoje (equipamento sendo carregado por carreta)
    const { data: transportes } = await (supabase as any)
      .from("equipamento_transportes")
      .select("equipment_fleet, transportador_nome, destino_descricao, destino_ogs")
      .eq("data", hoje)
      .eq("company_id", COMPANY_ID);

    // Montar mapa: último diário manual por frota, e se tem diário hoje
    const ultimoDiarioMap = new Map<string, typeof diarios extends (infer T)[] | null ? T : never>();
    const diarioHojeMap = new Map<string, boolean>();  // frota → tem diário hoje?
    const diarioHojeAutoMap = new Map<string, boolean>(); // frota → diário de hoje é auto?

    for (const d of (diarios || []) as any[]) {
      const frota = d.equipment_fleet as string;
      // Marcar se tem diário hoje
      if (d.date === hoje) {
        diarioHojeMap.set(frota, true);
        if (d.is_auto) diarioHojeAutoMap.set(frota, true);
      }
      // Guardar último diário manual (preferência sobre auto)
      const existing = ultimoDiarioMap.get(frota);
      if (!existing) {
        ultimoDiarioMap.set(frota, d);
      } else if (!d.is_auto && existing.is_auto) {
        // Preferir manual sobre auto para a localização
        ultimoDiarioMap.set(frota, d);
      }
    }

    const transporteMap = new Map<string, { carreta: string; destino: string; destinoOgs: string | null }>();
    for (const t of transportes || []) {
      transporteMap.set(t.equipment_fleet, {
        carreta: t.transportador_nome,
        destino: t.destino_descricao,
        destinoOgs: t.destino_ogs || null,
      });
    }

    // Montar resultado
    const result: EquipRastreio[] = (equips as any[]).map((eq: any) => {
      const frota = eq.frota as string;
      const ultimoDiario = ultimoDiarioMap.get(frota) as any;
      const transporte = transporteMap.get(frota);
      const temDiarioHoje = diarioHojeMap.get(frota) ?? false;
      const isAutoHoje = diarioHojeAutoMap.get(frota) ?? false;
      const dAtras = diasAtras(ultimoDiario?.date ?? null);

      // Transporte de hoje tem prioridade sobre o diário para localização
      if (transporte) {
        return {
          ...eq,
          localAtual: transporte.destino || "Em rota",
          ogsAtual: transporte.destinoOgs,
          statusOperacao: "transporte" as StatusOperacao,
          operador: ultimoDiario?.operator_name ?? null,
          fonte: "diario_manual" as FonteInfo,
          ultimaDiarioData: ultimoDiario?.date ?? null,
          diasSemDiario: dAtras,
          temDiarioHoje,
          isAutoHoje,
          carretaTransporte: transporte.carreta,
          destinoTransporte: transporte.destino,
        };
      }

      if (ultimoDiario) {
        return {
          ...eq,
          localAtual: ultimoDiario.location_address || eq.setor || "—",
          ogsAtual: ultimoDiario.ogs_number || null,
          statusOperacao: resolverStatus(ultimoDiario.work_status, eq.setor, ultimoDiario.date),
          operador: ultimoDiario.operator_name ?? null,
          fonte: ultimoDiario.is_auto ? "diario_auto" : "diario_manual",
          ultimaDiarioData: ultimoDiario.date,
          diasSemDiario: dAtras,
          temDiarioHoje,
          isAutoHoje,
          carretaTransporte: null,
          destinoTransporte: null,
        };
      }

      // Sem nenhum diário — usar setor do cadastro como localização
      const setor = eq.setor;
      return {
        ...eq,
        localAtual: setor || "—",
        ogsAtual: null,
        statusOperacao: resolverStatus(null, setor, null),
        operador: null,
        fonte: setor ? "setor_cadastro" : "sem_info",
        ultimaDiarioData: null,
        diasSemDiario: null,
        temDiarioHoje: false,
        isAutoHoje: false,
        carretaTransporte: null,
        destinoTransporte: null,
      };
    });

    setLista(result);
    setUltimaAtualizacao(new Date());
    setLoading(false);
  }

  // KPIs
  const kpis = useMemo(() => ({
    total: lista.length,
    trabalhando: lista.filter((e) => e.statusOperacao === "trabalhando").length,
    manutencao: lista.filter((e) => e.statusOperacao === "manutencao").length,
    transporte: lista.filter((e) => e.statusOperacao === "transporte").length,
    disposicao: lista.filter((e) => e.statusOperacao === "disposicao" || e.statusOperacao === "patio" || e.statusOperacao === "folga").length,
    semDiarioHoje: lista.filter((e) => !e.temDiarioHoje).length,
    semInfo: lista.filter((e) => e.fonte === "sem_info").length,
  }), [lista]);

  const tiposUnicos = useMemo(() =>
    Array.from(new Set(lista.map((e) => e.tipo || "").filter(Boolean))).sort(),
    [lista]);

  const listaFiltrada = useMemo(() => {
    let r = lista;
    if (filtroStatus !== "todos") r = r.filter((e) => e.statusOperacao === filtroStatus);
    if (filtroTipo !== "todos") r = r.filter((e) => e.tipo === filtroTipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter((e) =>
        e.frota?.toLowerCase().includes(q) ||
        e.tipo?.toLowerCase().includes(q) ||
        e.localAtual?.toLowerCase().includes(q) ||
        e.operador?.toLowerCase().includes(q) ||
        e.setor?.toLowerCase().includes(q) ||
        e.ogsAtual?.toLowerCase().includes(q)
      );
    }
    // Ordenação: manutenção primeiro, depois trabalhando, depois o resto
    const ord: Record<StatusOperacao, number> = {
      manutencao: 0, transporte: 1, trabalhando: 2,
      disposicao: 3, patio: 4, folga: 5, sem_info: 6,
    };
    return r.sort((a, b) => {
      const diff = ord[a.statusOperacao] - ord[b.statusOperacao];
      if (diff !== 0) return diff;
      return (a.diasSemDiario ?? 999) - (b.diasSemDiario ?? 999);
    });
  }, [lista, filtroStatus, filtroTipo, busca]);

  const fmtHora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtData = (s: string) => {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  const CHIPS = [
    { key: "todos" as const,      label: "Todos",          count: kpis.total,       cor: "bg-gray-100 text-gray-700 border border-gray-200" },
    { key: "trabalhando" as const, label: "✅ Trabalhando", count: kpis.trabalhando,  cor: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
    { key: "transporte" as const,  label: "🚛 Transporte",  count: kpis.transporte,   cor: "bg-purple-100 text-purple-700 border border-purple-200" },
    { key: "manutencao" as const,  label: "🔧 Manutenção",  count: kpis.manutencao,   cor: "bg-amber-100 text-amber-700 border border-amber-200" },
    { key: "disposicao" as const,  label: "📦 Disp./Pátio", count: kpis.disposicao,   cor: "bg-blue-100 text-blue-700 border border-blue-200" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg sticky top-0 z-10">
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Rastreamento de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">
            {ultimaAtualizacao ? `Atualizado às ${fmtHora(ultimaAtualizacao)}` : "Carregando..."}
          </span>
        </div>
        <button onClick={buscarDados} disabled={loading}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total ativos", value: kpis.total, cor: "text-gray-700" },
            { label: "Trabalhando", value: kpis.trabalhando, cor: "text-emerald-600" },
            { label: "Manutenção", value: kpis.manutencao, cor: kpis.manutencao > 0 ? "text-amber-600 font-bold" : "text-gray-400" },
            { label: "Sem diário hoje", value: kpis.semDiarioHoje, cor: kpis.semDiarioHoje > 0 ? "text-orange-600" : "text-gray-400" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-border px-3 py-2.5 text-center">
              <p className={`text-2xl font-display font-extrabold ${k.cor}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Aviso sobre o que "sem diário hoje" significa */}
        {kpis.semDiarioHoje > 0 && (
          <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
            <CalendarDays className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800">
              <strong>{kpis.semDiarioHoje} equipamentos</strong> não têm diário preenchido hoje — mas a localização abaixo é do <strong>último diário registrado</strong> (pode ser ontem ou dias anteriores). O diário automático do pátio é gerado às 21h para os equipamentos que precisam.
            </p>
          </div>
        )}

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setFiltroStatus(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${c.cor} ${
                filtroStatus === c.key ? "ring-2 ring-offset-1 ring-primary/50 scale-105" : "opacity-80 hover:opacity-100"
              }`}>
              {c.label} <span className="font-bold ml-1">{c.count}</span>
            </button>
          ))}
        </div>

        {/* Busca + tipo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar frota, local, OGS, operador..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-10 pl-9 pr-8 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
              <option value="todos">Todos os tipos</option>
              {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
            <p className="text-sm text-muted-foreground">Buscando localização de todos os equipamentos...</p>
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhum equipamento com esse filtro.
          </div>
        ) : (
          <div className="space-y-1.5">
            {listaFiltrada.map((eq) => {
              const cfg = STATUS_CFG[eq.statusOperacao];
              const isOpen = expandido[eq.frota];
              const dAtras = eq.diasSemDiario;

              return (
                <div key={eq.frota} className={`rounded-xl border border-border overflow-hidden ${cfg.bgRow}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.03] transition-colors"
                    onClick={() => setExpandido((p) => ({ ...p, [eq.frota]: !p[eq.frota] }))}>

                    {/* Dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

                    {/* Frota */}
                    <div className="w-28 flex-shrink-0">
                      <p className="font-display font-bold text-sm leading-tight">{eq.frota}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{eq.tipo}</p>
                    </div>

                    {/* Local */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium">
                        {eq.localAtual}
                        {eq.ogsAtual && eq.ogsAtual !== "000" && (
                          <span className="text-muted-foreground text-xs ml-1.5">OGS {eq.ogsAtual}</span>
                        )}
                      </p>
                      {/* Quando foi o último diário */}
                      <p className={`text-[10px] ${corDias(dAtras)}`}>
                        {eq.fonte === "setor_cadastro"
                          ? "📋 Localização pelo setor cadastrado"
                          : eq.fonte === "sem_info"
                          ? "❓ Sem informação"
                          : `📅 Último diário: ${eq.ultimaDiarioData ? fmtData(eq.ultimaDiarioData) : "—"} (${labelDias(dAtras)})`
                        }
                        {eq.isAutoHoje && " 🤖"}
                      </p>
                    </div>

                    {/* Badge status */}
                    <span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {/* Badge "sem diário hoje" */}
                    {!eq.temDiarioHoje && eq.fonte !== "setor_cadastro" && eq.fonte !== "sem_info" && (
                      <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-orange-100 text-orange-700 border border-orange-200">
                        <CalendarDays className="w-3 h-3" /> Sem diário hoje
                      </span>
                    )}

                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
                  </button>

                  {/* Expansão */}
                  {isOpen && (
                    <div className="px-4 pb-3 pt-0 border-t border-border/50 bg-black/[0.02] space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
                        <div><span className="text-muted-foreground">Status: </span><span className="font-medium">{cfg.label}</span></div>
                        {eq.setor && <div><span className="text-muted-foreground">Equipe/Setor: </span><span className="font-medium">{eq.setor}</span></div>}
                        {eq.operador && <div><span className="text-muted-foreground">Operador: </span><span className="font-medium">{eq.operador}</span></div>}
                        {eq.ogsAtual && eq.ogsAtual !== "000" && (
                          <div><span className="text-muted-foreground">OGS: </span><span className="font-medium">{eq.ogsAtual}</span></div>
                        )}
                        {eq.carretaTransporte && (
                          <div><span className="text-muted-foreground">Carreta: </span><span className="font-medium text-purple-700">{eq.carretaTransporte}</span></div>
                        )}
                        {eq.destinoTransporte && (
                          <div><span className="text-muted-foreground">Destino: </span><span className="font-medium text-purple-700">{eq.destinoTransporte}</span></div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Fonte da localização: </span>
                          <span className="font-medium">
                            {eq.fonte === "diario_manual" ? "Diário do operador" :
                             eq.fonte === "diario_auto" ? "🤖 Diário automático" :
                             eq.fonte === "setor_cadastro" ? "📋 Setor cadastrado" :
                             "❓ Sem informação"}
                          </span>
                        </div>
                        {eq.ultimaDiarioData && (
                          <div>
                            <span className="text-muted-foreground">Último diário: </span>
                            <span className={`font-medium ${corDias(dAtras)}`}>
                              {fmtData(eq.ultimaDiarioData)} ({labelDias(dAtras)})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Alertas contextuais */}
                      {!eq.temDiarioHoje && dAtras !== null && dAtras > 7 && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">
                            Último diário há <strong>{dAtras} dias</strong>. Verificar situação do equipamento.
                          </p>
                        </div>
                      )}
                      {eq.fonte === "setor_cadastro" && (
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-700">
                            Localização pelo <strong>setor cadastrado</strong> — nenhum diário de equipamento registrado ainda para esta frota.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white rounded-xl border border-border p-3 mt-2">
          <p className="text-xs font-bold text-muted-foreground mb-2">Como funciona o rastreamento</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>📅 <strong>Último diário do operador</strong> → fonte mais confiável. Data indica quando foi registrado.</p>
            <p>🤖 <strong>Diário automático</strong> → gerado às 21h pelo Workflux quando não há apontamento manual.</p>
            <p>📋 <strong>Setor cadastrado</strong> → equipamentos sem nenhum diário: localização pelo cadastro.</p>
            <p>🚛 <strong>Em transporte</strong> → registrado hoje pelo motorista da carreta.</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pb-4">
          {listaFiltrada.length} de {lista.length} equipamentos •{" "}
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>
    </div>
  );
}

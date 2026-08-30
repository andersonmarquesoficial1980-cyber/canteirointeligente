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

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import {
  ArrowLeft, RefreshCw, MapPin, AlertTriangle,
  Truck, Bot, CheckCircle2, Wrench, Clock,
  ChevronDown, ChevronUp, Search, Filter, CalendarDays
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";
import { DEFAULT_COMPANY_ID } from "@/config/company";

const COMPANY_ID = DEFAULT_COMPANY_ID;

type FonteInfo = "diario_manual" | "diario_auto" | "setor_cadastro" | "sem_info";
type StatusOperacao = "trabalhando" | "disposicao" | "manutencao" | "transporte" | "folga" | "patio" | "sem_info";
type ClasseObservabilidade = "confirmado_manual" | "confirmado_transporte" | "elegivel_auto_parado" | "pendencia_humana";
type ConfiancaRastreio = "alta" | "media" | "baixa";

interface InconsistenciaItem {
  frotaInformada: string;
  origem: "diario" | "transporte";
  data: string;
  detalhe: string;
}

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
  classeObservabilidade: ClasseObservabilidade;
  confianca: ConfiancaRastreio;
  motivoClasse: string;
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

function isParado(eqStatus: string | null, setor: string | null, statusOperacao: StatusOperacao) {
  const st = (eqStatus || "").toLowerCase().replace(/[_\s]/g, "");
  const s = (setor || "").toLowerCase();
  if (st.includes("manut") || st.includes("disposicao") || st.includes("inativo")) return true;
  if (s.includes("manutenção") || s.includes("manutencao") || s.includes("disposição") || s.includes("disposicao") || s.includes("pátio") || s.includes("patio") || s.includes("base")) return true;
  return statusOperacao === "manutencao" || statusOperacao === "disposicao" || statusOperacao === "patio" || statusOperacao === "folga";
}

function classificarObservabilidade(params: {
  fonte: FonteInfo;
  statusOperacao: StatusOperacao;
  temDiarioHoje: boolean;
  isAutoHoje: boolean;
  temTransporteHoje: boolean;
  eqStatus: string | null;
  setor: string | null;
}): { classe: ClasseObservabilidade; confianca: ConfiancaRastreio; motivo: string } {
  const { fonte, statusOperacao, temDiarioHoje, isAutoHoje, temTransporteHoje, eqStatus, setor } = params;

  if (temTransporteHoje) {
    return { classe: "confirmado_transporte", confianca: "alta", motivo: "Transporte registrado hoje." };
  }

  if (temDiarioHoje && fonte === "diario_manual") {
    return { classe: "confirmado_manual", confianca: "alta", motivo: "Diário manual válido hoje." };
  }

  if (isParado(eqStatus, setor, statusOperacao) && !temDiarioHoje) {
    return {
      classe: "elegivel_auto_parado",
      confianca: fonte === "setor_cadastro" ? "media" : "alta",
      motivo: "Sem diário manual hoje e equipamento em manutenção/disposição/pátio.",
    };
  }

  if (fonte === "sem_info") {
    return { classe: "pendencia_humana", confianca: "baixa", motivo: "Sem diário e sem setor cadastrado." };
  }

  return { classe: "pendencia_humana", confianca: temDiarioHoje ? "media" : "baixa", motivo: "Exige lançamento/validação humana." };
}

export default function GestaoFrotasRastreamento() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/gestao-frotas");
  const { trail, goTo } = useNavigationTrail({ label: "Rastreamento de Frotas" });
  const [lista, setLista] = useState<EquipRastreio[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusOperacao | "todos">("todos");
  const [filtroClasse, setFiltroClasse] = useState<ClasseObservabilidade | "todos">("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [inconsistencias, setInconsistencias] = useState<InconsistenciaItem[]>([]);
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
      .select("equipment_fleet, transportador_nome, destino_descricao, destino_ogs, data")
      .eq("data", hoje)
      .eq("company_id", COMPANY_ID);

    // 4. Diários de hoje sem filtro por frota — para detectar erro de apontamento
    const { data: diariosHojeRaw } = await (supabase as any)
      .from("equipment_diaries")
      .select("equipment_fleet, date, status")
      .eq("company_id", COMPANY_ID)
      .in("status", ["enviado", "auto"])
      .eq("date", hoje)
      .not("equipment_fleet", "is", null);

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
        const statusOperacao = "transporte" as StatusOperacao;
        const cls = classificarObservabilidade({
          fonte: "diario_manual",
          statusOperacao,
          temDiarioHoje,
          isAutoHoje,
          temTransporteHoje: true,
          eqStatus: eq.status ?? null,
          setor: eq.setor ?? null,
        });
        return {
          ...eq,
          localAtual: transporte.destino || "Em rota",
          ogsAtual: transporte.destinoOgs,
          statusOperacao,
          operador: ultimoDiario?.operator_name ?? null,
          fonte: "diario_manual" as FonteInfo,
          ultimaDiarioData: ultimoDiario?.date ?? null,
          diasSemDiario: dAtras,
          temDiarioHoje,
          isAutoHoje,
          carretaTransporte: transporte.carreta,
          destinoTransporte: transporte.destino,
          classeObservabilidade: cls.classe,
          confianca: cls.confianca,
          motivoClasse: cls.motivo,
        };
      }

      if (ultimoDiario) {
        const statusOperacao = resolverStatus(ultimoDiario.work_status, eq.setor, ultimoDiario.date);
        const fonte = ultimoDiario.is_auto ? "diario_auto" : "diario_manual";
        const cls = classificarObservabilidade({
          fonte,
          statusOperacao,
          temDiarioHoje,
          isAutoHoje,
          temTransporteHoje: false,
          eqStatus: eq.status ?? null,
          setor: eq.setor ?? null,
        });
        return {
          ...eq,
          localAtual: ultimoDiario.location_address || eq.setor || "—",
          ogsAtual: ultimoDiario.ogs_number || null,
          statusOperacao,
          operador: ultimoDiario.operator_name ?? null,
          fonte,
          ultimaDiarioData: ultimoDiario.date,
          diasSemDiario: dAtras,
          temDiarioHoje,
          isAutoHoje,
          carretaTransporte: null,
          destinoTransporte: null,
          classeObservabilidade: cls.classe,
          confianca: cls.confianca,
          motivoClasse: cls.motivo,
        };
      }

      // Sem nenhum diário — usar setor do cadastro como localização
      const setor = eq.setor;
      const statusOperacao = resolverStatus(null, setor, null);
      const fonte = setor ? "setor_cadastro" : "sem_info";
      const cls = classificarObservabilidade({
        fonte,
        statusOperacao,
        temDiarioHoje: false,
        isAutoHoje: false,
        temTransporteHoje: false,
        eqStatus: eq.status ?? null,
        setor: eq.setor ?? null,
      });
      return {
        ...eq,
        localAtual: setor || "—",
        ogsAtual: null,
        statusOperacao,
        operador: null,
        fonte,
        ultimaDiarioData: null,
        diasSemDiario: null,
        temDiarioHoje: false,
        isAutoHoje: false,
        carretaTransporte: null,
        destinoTransporte: null,
        classeObservabilidade: cls.classe,
        confianca: cls.confianca,
        motivoClasse: cls.motivo,
      };
    });

    const frotasSet = new Set(frotas.map((f: string) => (f || "").toUpperCase()));
    const inconsistDiario: InconsistenciaItem[] = (diariosHojeRaw || [])
      .filter((d: any) => d?.equipment_fleet && !frotasSet.has(String(d.equipment_fleet).toUpperCase()))
      .map((d: any) => ({
        frotaInformada: String(d.equipment_fleet),
        origem: "diario" as const,
        data: d.date,
        detalhe: "Frota informada no diário não encontrada no cadastro de equipamentos.",
      }));

    const inconsistTransporte: InconsistenciaItem[] = (transportes || [])
      .filter((t: any) => t?.equipment_fleet && !frotasSet.has(String(t.equipment_fleet).toUpperCase()))
      .map((t: any) => ({
        frotaInformada: String(t.equipment_fleet),
        origem: "transporte" as const,
        data: t.data || hoje,
        detalhe: "Frota informada no transporte não encontrada no cadastro de equipamentos.",
      }));

    const allIncons = [...inconsistDiario, ...inconsistTransporte]
      .sort((a, b) => b.data.localeCompare(a.data));

    setInconsistencias(allIncons);
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
    confirmados: lista.filter((e) => e.classeObservabilidade === "confirmado_manual" || e.classeObservabilidade === "confirmado_transporte").length,
    elegiveisAuto: lista.filter((e) => e.classeObservabilidade === "elegivel_auto_parado").length,
    pendenciasHumanas: lista.filter((e) => e.classeObservabilidade === "pendencia_humana").length,
    semRastreio7d: lista.filter((e) => (e.diasSemDiario ?? 0) > 7).length,
    inconsistencias: inconsistencias.length,
  }), [lista, inconsistencias]);

  const tiposUnicos = useMemo(() =>
    Array.from(new Set(lista.map((e) => e.tipo || "").filter(Boolean))).sort(),
    [lista]);

  const listaFiltrada = useMemo(() => {
    let r = lista;
    if (filtroStatus !== "todos") r = r.filter((e) => e.statusOperacao === filtroStatus);
    if (filtroClasse !== "todos") r = r.filter((e) => e.classeObservabilidade === filtroClasse);
    if (filtroTipo !== "todos") r = r.filter((e) => e.tipo === filtroTipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter((e) =>
        e.frota?.toLowerCase().includes(q) ||
        e.tipo?.toLowerCase().includes(q) ||
        e.localAtual?.toLowerCase().includes(q) ||
        e.operador?.toLowerCase().includes(q) ||
        e.setor?.toLowerCase().includes(q) ||
        e.motivoClasse?.toLowerCase().includes(q) ||
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
  }, [lista, filtroStatus, filtroClasse, filtroTipo, busca]);

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

  const CHIPS_CLASSE = [
    { key: "todos" as const, label: "Todos", count: kpis.total, cor: "bg-slate-100 text-slate-700 border border-slate-200" },
    { key: "confirmado_manual" as const, label: "✅ Confirmado (manual)", count: lista.filter((e) => e.classeObservabilidade === "confirmado_manual").length, cor: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
    { key: "confirmado_transporte" as const, label: "🚛 Confirmado (transporte)", count: lista.filter((e) => e.classeObservabilidade === "confirmado_transporte").length, cor: "bg-purple-100 text-purple-700 border border-purple-200" },
    { key: "elegivel_auto_parado" as const, label: "🤖 Elegível auto (parado)", count: kpis.elegiveisAuto, cor: "bg-blue-100 text-blue-700 border border-blue-200" },
    { key: "pendencia_humana" as const, label: "⚠️ Pendência humana", count: kpis.pendenciasHumanas, cor: "bg-orange-100 text-orange-700 border border-orange-200" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg sticky top-0 z-10">
        <button onClick={goBack} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
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

      <div className="px-4 pb-2 bg-header-gradient">
        <NavigationTrail trail={trail} onSelect={goTo} />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "Total ativos", value: kpis.total, cor: "text-gray-700" },
            { label: "Confirmados (manual/transporte)", value: kpis.confirmados, cor: "text-emerald-600" },
            { label: "Elegíveis auto (parados)", value: kpis.elegiveisAuto, cor: "text-blue-600" },
            { label: "Pendências humanas", value: kpis.pendenciasHumanas, cor: kpis.pendenciasHumanas > 0 ? "text-orange-600" : "text-gray-400" },
            { label: "Inconsistências de frota", value: kpis.inconsistencias, cor: kpis.inconsistencias > 0 ? "text-red-600 font-bold" : "text-gray-400" },
            { label: "Sem rastreio > 7 dias", value: kpis.semRastreio7d, cor: kpis.semRastreio7d > 0 ? "text-red-600" : "text-gray-400" },
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

        {/* Filtros de observabilidade (Fase 1) */}
        <div className="flex flex-wrap gap-2">
          {CHIPS_CLASSE.map((c) => (
            <button key={c.key} onClick={() => setFiltroClasse(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${c.cor} ${
                filtroClasse === c.key ? "ring-2 ring-offset-1 ring-primary/50 scale-105" : "opacity-80 hover:opacity-100"
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
              const confCfg = eq.confianca === "alta"
                ? { label: "Confiança alta", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" }
                : eq.confianca === "media"
                ? { label: "Confiança média", cls: "bg-amber-100 text-amber-700 border border-amber-200" }
                : { label: "Confiança baixa", cls: "bg-red-100 text-red-700 border border-red-200" };

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

                    {/* Badge confiança */}
                    <span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${confCfg.cls}`}>
                      {confCfg.label}
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
                        <div><span className="text-muted-foreground">Classe Fase 1: </span><span className="font-medium">{eq.classeObservabilidade.replaceAll("_", " ")}</span></div>
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
                        <div>
                          <span className="text-muted-foreground">Motivo da classe: </span>
                          <span className="font-medium">{eq.motivoClasse}</span>
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

        {/* Painel de exceções (Fase 1) */}
        <div className="bg-white rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-muted-foreground">Fila de exceções — frota inconsistente</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${kpis.inconsistencias > 0 ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>
              {kpis.inconsistencias} pendência(s)
            </span>
          </div>
          {inconsistencias.length === 0 ? (
            <p className="text-xs text-emerald-700">Nenhuma inconsistência de frota detectada hoje.</p>
          ) : (
            <div className="space-y-1.5">
              {inconsistencias.slice(0, 12).map((item, idx) => (
                <div key={`${item.frotaInformada}-${idx}`} className="text-xs rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                  <p className="font-semibold text-red-800">{item.frotaInformada} · {item.origem === "diario" ? "Diário" : "Transporte"} · {fmtData(item.data)}</p>
                  <p className="text-red-700">{item.detalhe}</p>
                </div>
              ))}
            </div>
          )}
        </div>

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

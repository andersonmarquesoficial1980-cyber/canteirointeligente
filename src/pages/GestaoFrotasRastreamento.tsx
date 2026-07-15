/**
 * GestaoFrotasRastreamento — Dashboard de Rastreamento Unificado
 * Rota: /gestao-frotas/rastreamento
 *
 * Mostra onde está cada equipamento ativo, unindo 3 fontes:
 *   1. Diário de equipamento do dia (manual ou auto)
 *   2. Registros de transporte via carreta (equipamento_transportes)
 *   3. Apontamento de horas (equipment_time_entries) — atividade mais recente
 *
 * Lógica de prioridade por equipamento (dia atual):
 *   1º Diário manual → local e status real
 *   2º Em transporte  → mostra carreta e destino
 *   3º Diário auto    → Pátio Central (cinza)
 *   4º Sem apontamento → alerta vermelho
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, MapPin, AlertTriangle,
  Truck, Bot, CheckCircle2, Wrench, Clock,
  ChevronDown, ChevronUp, Search, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Tipos que não entram no controle de diário automático
const TIPOS_EXCLUIDOS_AUTO = [
  "BANHEIRO QUÍMICO", "CAMINHÃO BASCULANTE", "CAMINHÃO PLATAFORMA",
  "CAMINHÃO COMBOIO", "CARRETINHA BANHEIRO", "COMPRESSOR", "GERADOR",
  "MISTURADOR DE ARGAMASSA", "PLACA VIBRATÓRIA", "PRANCHA REBOQUE",
  "ROMPEDOR ELÉTRICO", "ROMPEDOR PNEUMÁTICO", "SERRA CLIPPER",
  "TORRE DE ILUMINAÇÃO", "VAN",
];

type StatusRastreio =
  | "trabalhando"   // diário manual, trabalhando
  | "disposicao"    // diário manual, à disposição
  | "manutencao"    // diário manual ou setor, em manutenção
  | "transporte"    // em transporte registrado por carreta
  | "patioAuto"     // diário automático — pátio central
  | "semApontamento"; // sem diário hoje

interface EquipRastreio {
  id: string;
  frota: string;
  tipo: string;
  setor: string | null;
  status: string | null;
  // Rastreamento
  rastreioStatus: StatusRastreio;
  localAtual: string;
  ogsAtual: string | null;
  operador: string | null;
  workStatus: string | null;
  isAuto: boolean;
  // Transporte
  carretaTransporte: string | null;
  destinoTransporte: string | null;
  // Marcador de tipo "excluído do auto"
  excluídoAuto: boolean;
}

const STATUS_CONFIG: Record<StatusRastreio, {
  label: string;
  icon: React.ReactNode;
  bgRow: string;
  badge: string;
  dot: string;
}> = {
  trabalhando: {
    label: "Trabalhando",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bgRow: "bg-white",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  disposicao: {
    label: "À Disposição",
    icon: <Clock className="w-3.5 h-3.5" />,
    bgRow: "bg-white",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
    dot: "bg-blue-400",
  },
  manutencao: {
    label: "Manutenção",
    icon: <Wrench className="w-3.5 h-3.5" />,
    bgRow: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
  },
  transporte: {
    label: "Em Transporte",
    icon: <Truck className="w-3.5 h-3.5" />,
    bgRow: "bg-purple-50",
    badge: "bg-purple-100 text-purple-700 border border-purple-200",
    dot: "bg-purple-500",
  },
  patioAuto: {
    label: "Pátio (Auto)",
    icon: <Bot className="w-3.5 h-3.5" />,
    bgRow: "bg-slate-50",
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-400",
  },
  semApontamento: {
    label: "Sem Apontamento",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    bgRow: "bg-red-50",
    badge: "bg-red-100 text-red-700 border border-red-200",
    dot: "bg-red-500",
  },
};

function resolverStatusRastreio(workStatus: string | null): StatusRastreio {
  if (!workStatus) return "semApontamento";
  const ws = workStatus.toLowerCase();
  if (ws.includes("manuten")) return "manutencao";
  if (ws.includes("disposição") || ws.includes("disposicao")) return "disposicao";
  if (ws.includes("transporte")) return "transporte";
  return "trabalhando";
}

type FiltroStatus = "todos" | StatusRastreio;
type FiltroTipo = "todos" | string;

export default function GestaoFrotasRastreamento() {
  const navigate = useNavigate();
  const [equipamentos, setEquipamentos] = useState<EquipRastreio[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  useEffect(() => {
    buscarDados();
  }, []);

  async function buscarDados() {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];

    // 1. Todos equipamentos ativos
    const { data: equips } = await supabase
      .from("equipamentos")
      .select("id, frota, tipo, setor, status")
      .eq("company_id", COMPANY_ID)
      .eq("status", "ativo")
      .not("frota", "is", null)
      .order("tipo")
      .order("frota");

    if (!equips?.length) {
      setEquipamentos([]);
      setLoading(false);
      return;
    }

    // 2. Diários de hoje
    const frotas = equips.map((e) => e.frota!);
    const { data: diarios } = await supabase
      .from("equipment_diaries")
      .select("equipment_fleet, work_status, location_address, ogs_number, operator_name, is_auto, status")
      .eq("date", hoje)
      .eq("company_id", COMPANY_ID)
      .in("equipment_fleet", frotas);

    // 3. Transportes de hoje (equipamento sendo carregado por carreta)
    const { data: transportes } = await (supabase as any)
      .from("equipamento_transportes")
      .select("equipment_fleet, transportador_nome, destino_descricao, destino_ogs")
      .eq("data", hoje)
      .eq("company_id", COMPANY_ID);

    // Montar mapas para lookup rápido
    const diarioMap = new Map<string, typeof diarios extends (infer T)[] | null ? T : never>();
    for (const d of diarios || []) {
      // Priorizar diário manual sobre auto
      const existing = diarioMap.get(d.equipment_fleet!);
      if (!existing || (!d.is_auto && existing.is_auto)) {
        diarioMap.set(d.equipment_fleet!, d);
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

    // Montar lista final
    const result: EquipRastreio[] = equips.map((eq) => {
      const diario = diarioMap.get(eq.frota!);
      const transporte = transporteMap.get(eq.frota!);
      const excluídoAuto = TIPOS_EXCLUIDOS_AUTO.includes((eq.tipo || "").toUpperCase());

      if (diario && !diario.is_auto) {
        // Diário manual — fonte mais confiável
        let rastreioStatus = resolverStatusRastreio(diario.work_status);

        // Se tem registro de transporte e o diário diz "Em Transporte"
        if (rastreioStatus === "transporte" && transporte) {
          return {
            ...eq,
            rastreioStatus: "transporte",
            localAtual: transporte.destino || diario.location_address || "—",
            ogsAtual: transporte.destinoOgs || diario.ogs_number || null,
            operador: diario.operator_name,
            workStatus: diario.work_status,
            isAuto: false,
            carretaTransporte: transporte.carreta,
            destinoTransporte: transporte.destino,
            excluídoAuto,
          };
        }

        return {
          ...eq,
          rastreioStatus,
          localAtual: diario.location_address || "—",
          ogsAtual: diario.ogs_number || null,
          operador: diario.operator_name,
          workStatus: diario.work_status,
          isAuto: false,
          carretaTransporte: null,
          destinoTransporte: null,
          excluídoAuto,
        };
      }

      if (transporte) {
        // Em transporte registrado por carreta (sem diário manual)
        return {
          ...eq,
          rastreioStatus: "transporte",
          localAtual: transporte.destino || "Em rota",
          ogsAtual: transporte.destinoOgs,
          operador: null,
          workStatus: "Em Transporte",
          isAuto: true,
          carretaTransporte: transporte.carreta,
          destinoTransporte: transporte.destino,
          excluídoAuto,
        };
      }

      if (diario && diario.is_auto) {
        // Diário automático — pátio central
        const setor = (eq.setor || "").toUpperCase();
        let rastreioStatus: StatusRastreio = "patioAuto";
        if (setor.includes("MANUTENÇÃO") || setor.includes("MANUTENCAO")) rastreioStatus = "manutencao";
        else if (setor.includes("DISPOSIÇÃO") || setor.includes("DISPOSICAO")) rastreioStatus = "disposicao";

        return {
          ...eq,
          rastreioStatus,
          localAtual: diario.location_address || "Pátio Central",
          ogsAtual: null,
          operador: null,
          workStatus: diario.work_status,
          isAuto: true,
          carretaTransporte: null,
          destinoTransporte: null,
          excluídoAuto,
        };
      }

      // Sem nenhum apontamento
      return {
        ...eq,
        rastreioStatus: excluídoAuto ? "patioAuto" : "semApontamento",
        localAtual: excluídoAuto ? "Pátio Central" : "—",
        ogsAtual: null,
        operador: null,
        workStatus: null,
        isAuto: false,
        carretaTransporte: null,
        destinoTransporte: null,
        excluídoAuto,
      };
    });

    setEquipamentos(result);
    setUltimaAtualizacao(new Date());
    setLoading(false);
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = equipamentos.length;
    const trabalhando = equipamentos.filter((e) => e.rastreioStatus === "trabalhando").length;
    const manutencao = equipamentos.filter((e) => e.rastreioStatus === "manutencao").length;
    const transporte = equipamentos.filter((e) => e.rastreioStatus === "transporte").length;
    const patio = equipamentos.filter((e) => e.rastreioStatus === "patioAuto" || e.rastreioStatus === "disposicao").length;
    const semApontamento = equipamentos.filter((e) => e.rastreioStatus === "semApontamento").length;
    return { total, trabalhando, manutencao, transporte, patio, semApontamento };
  }, [equipamentos]);

  // Tipos únicos para filtro
  const tiposUnicos = useMemo(() => {
    const set = new Set(equipamentos.map((e) => e.tipo || "").filter(Boolean));
    return Array.from(set).sort();
  }, [equipamentos]);

  // Lista filtrada
  const lista = useMemo(() => {
    let r = equipamentos;
    if (filtroStatus !== "todos") r = r.filter((e) => e.rastreioStatus === filtroStatus);
    if (filtroTipo !== "todos") r = r.filter((e) => e.tipo === filtroTipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter(
        (e) =>
          e.frota?.toLowerCase().includes(q) ||
          e.tipo?.toLowerCase().includes(q) ||
          e.localAtual?.toLowerCase().includes(q) ||
          e.operador?.toLowerCase().includes(q) ||
          e.setor?.toLowerCase().includes(q)
      );
    }
    // Ordenar: sem apontamento primeiro, depois manutenção, depois os demais
    const prioridade: Record<StatusRastreio, number> = {
      semApontamento: 0,
      manutencao: 1,
      transporte: 2,
      trabalhando: 3,
      disposicao: 4,
      patioAuto: 5,
    };
    return r.sort((a, b) => prioridade[a.rastreioStatus] - prioridade[b.rastreioStatus]);
  }, [equipamentos, filtroStatus, filtroTipo, busca]);

  const fmtHora = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const FILTROS: { key: FiltroStatus; label: string; count: number; cor: string }[] = [
    { key: "todos", label: "Todos", count: kpis.total, cor: "bg-gray-100 text-gray-700 border border-gray-200" },
    { key: "semApontamento", label: "⚠ Sem apontamento", count: kpis.semApontamento, cor: kpis.semApontamento > 0 ? "bg-red-100 text-red-700 border border-red-300" : "bg-gray-100 text-gray-400 border border-gray-200" },
    { key: "trabalhando", label: "✅ Trabalhando", count: kpis.trabalhando, cor: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
    { key: "transporte", label: "🚛 Em transporte", count: kpis.transporte, cor: "bg-purple-100 text-purple-700 border border-purple-200" },
    { key: "manutencao", label: "🔧 Manutenção", count: kpis.manutencao, cor: "bg-amber-100 text-amber-700 border border-amber-200" },
    { key: "patioAuto", label: "🤖 Pátio / Disp.", count: kpis.patio, cor: "bg-slate-100 text-slate-600 border border-slate-200" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg sticky top-0 z-10">
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            Rastreamento de Frotas
          </span>
          <span className="block text-[11px] text-primary-foreground/80">
            {ultimaAtualizacao ? `Atualizado às ${fmtHora(ultimaAtualizacao)}` : "Carregando..."}
          </span>
        </div>
        <button
          onClick={buscarDados}
          disabled={loading}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* KPIs inline */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { label: "Total", value: kpis.total, cor: "text-gray-700" },
            { label: "Trabalhando", value: kpis.trabalhando, cor: "text-emerald-600" },
            { label: "Em Transporte", value: kpis.transporte, cor: "text-purple-600" },
            { label: "Manutenção", value: kpis.manutencao, cor: "text-amber-600" },
            { label: "Pátio/Disp.", value: kpis.patio, cor: "text-slate-600" },
            { label: "Sem Apontamento", value: kpis.semApontamento, cor: kpis.semApontamento > 0 ? "text-red-600 font-bold" : "text-gray-400" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-border px-3 py-2 text-center">
              <p className={`text-xl font-display font-extrabold ${k.cor}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltroStatus(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${f.cor} ${
                filtroStatus === f.key ? "ring-2 ring-offset-1 ring-primary/50 scale-105" : "opacity-80 hover:opacity-100"
              }`}
            >
              {f.label} <span className="font-bold ml-1">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Busca + filtro de tipo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar frota, local, operador..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-10 pl-9 pr-8 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            >
              <option value="todos">Todos os tipos</option>
              {tiposUnicos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
            <p className="text-sm text-muted-foreground">Carregando localização de {""} equipamentos...</p>
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhum equipamento encontrado com esse filtro.
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((eq) => {
              const cfg = STATUS_CONFIG[eq.rastreioStatus];
              const isExpanded = expandido[eq.frota];

              return (
                <div
                  key={eq.frota}
                  className={`rounded-xl border border-border overflow-hidden ${cfg.bgRow}`}
                >
                  {/* Linha principal */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                    onClick={() =>
                      setExpandido((prev) => ({ ...prev, [eq.frota]: !prev[eq.frota] }))
                    }
                  >
                    {/* Dot de status */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

                    {/* Frota + Tipo */}
                    <div className="w-28 flex-shrink-0">
                      <p className="font-display font-bold text-sm leading-tight">{eq.frota}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{eq.tipo}</p>
                    </div>

                    {/* Local */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium">{eq.localAtual}</p>
                      {eq.ogsAtual && eq.ogsAtual !== "000" && (
                        <p className="text-[10px] text-muted-foreground">OGS {eq.ogsAtual}</p>
                      )}
                    </div>

                    {/* Badge de status */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg.badge}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>

                    {/* Expandir */}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                    }
                  </button>

                  {/* Detalhe expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-0 border-t border-border/50 bg-black/[0.02] space-y-1.5">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {eq.setor && (
                          <div>
                            <span className="text-muted-foreground">Equipe/Setor: </span>
                            <span className="font-medium">{eq.setor}</span>
                          </div>
                        )}
                        {eq.operador && (
                          <div>
                            <span className="text-muted-foreground">Operador: </span>
                            <span className="font-medium">{eq.operador}</span>
                          </div>
                        )}
                        {eq.workStatus && (
                          <div>
                            <span className="text-muted-foreground">Status diário: </span>
                            <span className="font-medium">{eq.workStatus}</span>
                          </div>
                        )}
                        {eq.carretaTransporte && (
                          <div>
                            <span className="text-muted-foreground">Transportado por: </span>
                            <span className="font-medium text-purple-700">{eq.carretaTransporte}</span>
                          </div>
                        )}
                        {eq.destinoTransporte && (
                          <div>
                            <span className="text-muted-foreground">Destino: </span>
                            <span className="font-medium text-purple-700">{eq.destinoTransporte}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Fonte: </span>
                          <span className="font-medium">
                            {eq.rastreioStatus === "transporte" && eq.carretaTransporte
                              ? "Diário da carreta"
                              : eq.isAuto
                              ? "🤖 Automático"
                              : eq.workStatus
                              ? "Diário manual"
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Alerta sem apontamento */}
                      {eq.rastreioStatus === "semApontamento" && (
                        <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">
                            Nenhum diário registrado hoje. Verificar com o operador/equipe.
                            {!eq.excluídoAuto && " O diário automático de pátio será gerado às 21h se não houver apontamento."}
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
        <div className="bg-white rounded-xl border border-border p-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">Legenda de Fontes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>✅ <strong>Diário manual</strong> — operador preencheu hoje</span>
            <span>🚛 <strong>Em Transporte</strong> — informado pelo motorista da carreta</span>
            <span>🤖 <strong>Pátio (Auto)</strong> — gerado automaticamente às 21h</span>
            <span>⚠️ <strong>Sem apontamento</strong> — nenhum registro encontrado</span>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pb-4">
          Mostrando {lista.length} de {equipamentos.length} equipamentos ativos •{" "}
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

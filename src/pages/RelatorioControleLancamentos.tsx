import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import {
  ArrowLeft, Search, Download, Users, Wrench,
  ChevronDown, ChevronUp, CheckCircle2, Clock,
  AlertCircle, FileX, Settings2, Copy, Monitor, LayoutList, ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toLocalISODate } from "@/lib/date-local";
import { findMeterGaps, eligibleFleetCoverage, type MeterDiary, type MeterGap } from "@/lib/equipmentDiaryAudit";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DiarioRow {
  id: string;
  is_auto: boolean;
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

type EmptyState = "missing" | "pending" | "future" | "na";

interface ListItem {
  key: string;
  kind: "usuario" | "frota";
  titulo: string;
  subtitulo: string;
  tipo: string;
  rows: DiarioRow[];
  semLancamento: boolean;
  badgeText: string;
  badgeCls: string;
  missing: string[];            // datas vencidas sem diário (só frota)
  breaks: MeterGap[];           // divergências de medidor (só frota)
  dayState: Map<string, EmptyState>;
  dispensado: boolean;
}

interface ConfigObrigatorio {
  tipos: string[];     // tipos (UPPERCASE) que NÃO exigem diário
  frotas: string[];    // frotas que NÃO exigem diário
  ocultar: boolean;    // ocultar dispensados da lista
}

const CFG_VAZIA: ConfigObrigatorio = { tipos: [], frotas: [], ocultar: true };
const tipoKey = (t?: string | null) => (t || "").trim().toUpperCase();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} (${DIAS[dt.getDay()]})`;
}

function fmtShort(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")} (${DIAS[dt.getDay()]})`;
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
    days.push(toLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function statusColor(ws: string | null) {
  switch (ws) {
    case "Trabalhando":   return "bg-green-100 text-green-800 border border-green-300";
    case "Folga":         return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    case "Manutenção":    return "bg-amber-100 text-amber-800 border border-amber-300";
    case "Disposição":    return "bg-blue-100 text-blue-800 border border-blue-300";
    case "Em Transporte": return "bg-purple-100 text-purple-800 border border-purple-300";
    default:               return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

function statusIcon(ws: string | null) {
  switch (ws) {
    case "Trabalhando":   return <CheckCircle2 size={12} className="text-green-600" />;
    case "Folga":         return <Clock size={12} className="text-yellow-600" />;
    case "Manutenção":    return <Wrench size={12} className="text-amber-600" />;
    case "Disposição":    return <AlertCircle size={12} className="text-blue-600" />;
    case "Em Transporte": return <ChevronDown size={12} className="text-purple-600" />;
    default:               return <FileX size={12} className="text-gray-400" />;
  }
}

// ─── CalCell ──────────────────────────────────────────────────────────────────

function CalCell({ rows, onClick, empty }: { rows: DiarioRow[]; onClick: () => void; empty: EmptyState }) {
  const manuais = rows.filter(r => r.status === "enviado" && !r.is_auto);
  if (manuais.length === 0) {
    if (rows.length === 0 && empty === "na") {
      return <div title="Antes do cadastro do equipamento" className="w-full h-10 rounded flex items-center justify-center bg-gray-50 border border-gray-100 text-gray-300 text-xs">—</div>;
    }
    if (rows.length === 0 && empty === "future") {
      return <div className="w-full h-10 rounded flex items-center justify-center bg-gray-50 border border-gray-100 text-gray-300 text-xs">·</div>;
    }
    if (rows.length === 0 && empty === "pending") {
      return <div title="Hoje ainda não está atrasado" className="w-full h-10 rounded flex items-center justify-center bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-semibold">Hoje</div>;
    }
    return (
      <div className="w-full h-10 rounded flex items-center justify-center bg-red-50 border border-red-200">
        <span className="text-red-500 text-xs font-semibold">{rows.length ? "Auto ≠ diário" : "❌"}</span>
      </div>
    );
  }
  const ras = rows.filter(r => r.status === "rascunho");
  return (
    <button onClick={onClick}
      className="w-full min-h-[40px] rounded flex flex-col gap-0.5 px-1 py-1 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
      {manuais.map((r, i) => (
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

// ─── Detalhe (calendário + tabela) — usado no acordeão e no painel lateral ─────

function Detalhe({ item, diasLabel, onCell, onCopy, onNavigate, compact }: {
  item: ListItem;
  diasLabel: { d: string; label: string; day: string; isWE: boolean }[];
  onCell: (titulo: string, rows: DiarioRow[]) => void;
  onCopy: (item: ListItem) => void;
  onNavigate: (path: string) => void;
  compact: boolean;
}) {
  const isFrota = item.kind === "frota";
  const colW = compact ? 64 : 76;
  const cols = isFrota
    ? ["Data","Operador","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"]
    : ["Data","Frota","Tipo","OGS","Local","Turno","Status","Hor.Ini","Hor.Fin","Odo.Ini","Odo.Fin","Comb.","Litros","Obs.","Envio","Lançado em"];
  const sorted = [...item.rows].sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at).localeCompare(String(b.created_at)));

  return (
    <div className="p-4">
      {isFrota && (item.missing.length > 0 || item.breaks.length > 0) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50/60 p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm">
              {item.missing.length > 0 && (
                <>
                  <div className="font-semibold text-red-700 mb-1.5">{item.missing.length} dia(s) sem diário enviado</div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.missing.map(d => (
                      <span key={d} className="px-2 py-0.5 rounded-full bg-white border border-red-200 text-red-700 text-xs font-medium">{fmtShort(d)}</span>
                    ))}
                  </div>
                </>
              )}
              {item.breaks.map(({ previous, current, kind, difference }) => (
                <p key={current.id} className="mt-2 pt-2 border-t border-red-100 text-xs text-slate-700">
                  {difference < 0 ? "🔴 Regressão" : "⚠️ Intervalo sem medição"} de {Math.abs(difference)} {kind === "odometer" ? "km" : "h"}:
                  {" "}{fmtDate(previous.date)} {previous.period || ""} final <strong>{kind === "odometer" ? previous.odometer_final : previous.meter_final}</strong>
                  {" → "}{fmtDate(current.date)} {current.period || ""} inicial <strong>{kind === "odometer" ? current.odometer_initial : current.meter_initial}</strong>.
                  {" "}<button type="button" className="underline font-semibold" onClick={() => onNavigate(`/visualizar-lancamento/${previous.id}`)}>Ver anterior</button>
                  {" · "}<button type="button" className="underline font-semibold" onClick={() => onNavigate(`/visualizar-lancamento/${current.id}`)}>Ver atual</button>
                </p>
              ))}
            </div>
            {item.missing.length > 0 && (
              <Button size="sm" variant="outline" className="no-print gap-1.5 bg-white" onClick={() => onCopy(item)}>
                <Copy size={14} /> Copiar cobrança
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Calendário */}
      <div className="overflow-x-auto mb-4">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${diasLabel.length}, minmax(${colW}px, 1fr))`, minWidth: diasLabel.length * (colW + 4) }}>
          {diasLabel.map(({ d, label, day, isWE }) => (
            <div key={"h" + d} className="text-center">
              <div className={`text-[10px] font-bold ${isWE ? "text-red-500" : "text-gray-500"}`}>{day}</div>
              <div className={`text-[11px] font-semibold ${isWE ? "text-red-400" : "text-gray-600"}`}>{label}</div>
            </div>
          ))}
          {diasLabel.map(({ d }) => {
            const dayRows = item.rows.filter(r => r.date === d);
            return (
              <div key={"c" + d}>
                <CalCell rows={dayRows} empty={item.dayState.get(d) || "missing"}
                  onClick={() => { if (dayRows.length > 0) onCell(`${item.titulo} — ${fmtDate(d)}`, dayRows); }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      {sorted.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-6">Nenhum diário lançado no período.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200">
                {cols.map(h => <th key={h} className="px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id + i} className={`border-b border-gray-100 ${r.status === "rascunho" ? "bg-orange-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap font-medium">{fmtDate(r.date)}</td>
                  {isFrota ? (
                    <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-slate-700">{r.usuario_nome}</td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 whitespace-nowrap font-bold text-slate-700">{r.equipment_fleet}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{r.equipment_type || "—"}</td>
                    </>
                  )}
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.ogs_number || "—"}</td>
                  <td className={`px-2 py-1.5 truncate ${compact ? "max-w-[260px]" : "max-w-[140px]"}`} title={r.location_address || ""}>{r.location_address || "—"}</td>
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
                  <td className={`px-2 py-1.5 truncate ${compact ? "max-w-[320px]" : "max-w-[160px]"}`} title={r.observations || ""}>{r.observations || "—"}</td>
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
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

type EquipMeta = { frota: string; tipo: string; centro_custo?: string | null; status?: string; created_at?: string | null };

export default function RelatorioControleLancamentos() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const companyId = profile?.company_id;

  const hoje = new Date();
  const primeiroDia = toLocalISODate(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const ultimoDia   = toLocalISODate(hoje);
  const hojeISO = ultimoDia;

  const [aba, setAba]           = useState<"usuario" | "equipamento">("equipamento");
  const [dataIni, setDataIni]   = useState(primeiroDia);
  const [dataFim, setDataFim]   = useState(ultimoDia);
  const [loadedRange, setLoadedRange] = useState({ start: primeiroDia, end: ultimoDia });
  const [busca, setBusca]       = useState("");
  const [tipoFiltro, setTipoFiltro]           = useState("");
  const [apenasSemlancamento, setApenasSemlancamento] = useState(false);
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [ordem, setOrdem]       = useState<"pendencias" | "az">("pendencias");
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [diarios, setDiarios]   = useState<DiarioRow[]>([]);
  const [meterBaselines, setMeterBaselines] = useState<MeterDiary[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [todasFrotas, setTodasFrotas]     = useState<EquipMeta[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ titulo: string; rows: DiarioRow[] } | null>(null);
  const [selKey, setSelKey] = useState<string>("");
  const [cfgAberta, setCfgAberta] = useState(false);
  const [cfgBusca, setCfgBusca] = useState("");

  // Layout (opcional, por navegador): "padrao" = coluna central; "painel" = tela toda, lista à esquerda + detalhe à direita
  const [layout, setLayout] = useState<"padrao" | "painel">(() => {
    try { return localStorage.getItem("wf_ctrl_lanc_layout") === "painel" ? "painel" : "padrao"; } catch { return "padrao"; }
  });
  const painel = layout === "painel";
  const trocarLayout = (l: "padrao" | "painel") => {
    setLayout(l);
    try { localStorage.setItem("wf_ctrl_lanc_layout", l); } catch { /* ignore */ }
  };

  // Equipamentos que exigem diário (por navegador/empresa)
  const cfgStorageKey = `wf_ctrl_lanc_cfg_${companyId || "x"}`;
  const [cfg, setCfg] = useState<ConfigObrigatorio>(CFG_VAZIA);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cfgStorageKey);
      setCfg(raw ? { ...CFG_VAZIA, ...JSON.parse(raw) } : CFG_VAZIA);
    } catch { setCfg(CFG_VAZIA); }
  }, [cfgStorageKey]);
  const salvarCfg = (next: ConfigObrigatorio) => {
    setCfg(next);
    try { localStorage.setItem(cfgStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // ── Busca ──────────────────────────────────────────────────────────────────
  const buscarDados = async () => {
    if (!companyId) return;
    setLoading(true);
    setFetchError("");
    try {
      // 1 — diários do período
      const raw: any[] = [];
      let error: any = null;
      for (let offset = 0; ; offset += 1000) {
        const page = await (supabase as any)
        .from("equipment_diaries")
        .select(`id, is_auto, date, operator_name, equipment_fleet, equipment_type,
          ogs_number, location_address, period, work_status,
          meter_initial, meter_final, odometer_initial, odometer_final,
          fuel_type, fuel_liters, observations, status, created_at, user_id`)
        .eq("company_id", companyId)
        .or("status.is.null,status.neq.rascunho")
        .gte("date", dataIni)
        .lte("date", dataFim)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + 999);
        if (page.error) { error = page.error; break; }
        raw.push(...(page.data || []));
        if (!page.data || page.data.length < 1000) break;
      }

      if (error) { console.error("[ControleLancamentos]", error); setFetchError("Não foi possível carregar todos os diários. Tente novamente."); setLoading(false); return; }

      // Uma medição no primeiro dia do filtro também precisa ser comparada com o mês anterior.
      // Janela limitada: sem leitura nos 90 dias anteriores, o painel declara a referência desconhecida.
      const baselineStart = new Date(`${dataIni}T12:00:00Z`);
      baselineStart.setUTCDate(baselineStart.getUTCDate() - 90);
      const baselineRaw: MeterDiary[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await (supabase as any).from("equipment_diaries")
          .select("id,equipment_fleet,date,period,created_at,status,is_auto,meter_initial,meter_final,odometer_initial,odometer_final")
          .eq("company_id", companyId).eq("status", "enviado")
          .or("is_auto.is.null,is_auto.eq.false")
          .gte("date", baselineStart.toISOString().slice(0, 10)).lt("date", dataIni)
          .order("date", { ascending: true }).order("id", { ascending: true })
          .range(offset, offset + 999);
        if (page.error) throw page.error;
        baselineRaw.push(...(page.data || []));
        if (!page.data || page.data.length < 1000) break;
      }
      const latestByFleet = new Map<string, MeterDiary>();
      baselineRaw.sort((a, b) => a.date.localeCompare(b.date) ||
        Number(a.period === "noturno") - Number(b.period === "noturno") ||
        String(a.created_at || "").localeCompare(String(b.created_at || "")) || a.id.localeCompare(b.id))
        .forEach(row => latestByFleet.set(row.equipment_fleet, row));

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
        id: d.id,
        is_auto: Boolean(d.is_auto),
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

      // 4 — todos equipamentos da empresa (lista mestre)
      const { data: allEquip, error: equipamentosError } = await (supabase as any)
        .from("equipamentos")
        .select("frota, tipo, centro_custo, status, created_at")
        .eq("company_id", companyId)
        .order("frota");
      if (equipamentosError) throw equipamentosError;
      setTodasFrotas(((allEquip || []) as any[]).map((e: any) => ({
        frota: e.frota || "—",
        tipo: e.tipo || "",
        centro_custo: e.centro_custo || null,
        status: e.status || "",
        created_at: e.created_at || null,
      })));
      setDiarios(rows);
      setMeterBaselines([...latestByFleet.values()]);
      setLoadedRange({ start: dataIni, end: dataFim });

    } catch (err) {
      console.error("[ControleLancamentos]", err);
      setFetchError("Falha ao carregar a lista de equipamentos. Não considere o painel completo; tente novamente.");
    }
    setLoading(false);
  };

  useEffect(() => { if (companyId) buscarDados(); }, [companyId]);

  // ── Derivar ────────────────────────────────────────────────────────────────
  const allDays = useMemo(() => getAllDays(loadedRange.start, loadedRange.end), [loadedRange]);
  const diasLabel = useMemo(() => allDays.map(d => {
    const dt = new Date(d + "T12:00:00");
    return {
      d,
      label: `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`,
      day: DIAS[dt.getDay()],
      isWE: dt.getDay() === 0 || dt.getDay() === 6,
    };
  }), [allDays]);

  // Tipos únicos — SOMENTE da tabela equipamentos (fonte canônica), sem misturar texto livre dos diários
  const tiposEquipamento = useMemo(() => [...new Set(
    todasFrotas.map(f => tipoKey(f.tipo)).filter(Boolean)
  )].sort(), [todasFrotas]);

  // Todas as frotas (cadastro ∪ diários do período) com cobertura calculada
  const frotaItensTodos: ListItem[] = useMemo(() => {
    const byFleet = new Map<string, DiarioRow[]>();
    diarios.forEach(r => {
      const arr = byFleet.get(r.equipment_fleet);
      if (arr) arr.push(r); else byFleet.set(r.equipment_fleet, [r]);
    });
    const meta = new Map<string, EquipMeta>();
    todasFrotas.forEach(f => { if (f.frota && !meta.has(f.frota)) meta.set(f.frota, f); });
    const keys = new Set<string>([...meta.keys(), ...byFleet.keys()]);
    const baselineByFleet = new Map<string, MeterDiary[]>();
    meterBaselines.forEach(b => {
      const arr = baselineByFleet.get(b.equipment_fleet);
      if (arr) arr.push(b); else baselineByFleet.set(b.equipment_fleet, [b]);
    });

    const items: ListItem[] = [];
    keys.forEach(frota => {
      const m = meta.get(frota);
      const rows = byFleet.get(frota) || [];
      const devolvido = m?.status?.toLowerCase() === "devolvido";
      if (devolvido && rows.length === 0) return; // devolvido sem uso no período: fora da lista

      const tipo = (m?.tipo || rows.find(r => r.equipment_type)?.equipment_type || "").trim();
      const label = m?.centro_custo || frota;
      const dispensado = cfg.frotas.includes(frota) || (!!tipo && cfg.tipos.includes(tipoKey(tipo)));

      const cov = eligibleFleetCoverage(loadedRange.start, loadedRange.end, rows as MeterDiary[], hojeISO, m?.created_at);
      const missing = devolvido ? [] : cov.filter(d => d.state === "missing").map(d => d.date);
      const breaks = findMeterGaps(rows as MeterDiary[], baselineByFleet.get(frota) || []);
      const billable = cov.filter(d => d.state === "complete" || d.state === "missing");
      const done = billable.filter(d => d.state === "complete").length;
      const pct = billable.length ? Math.round((done / billable.length) * 100) : null;
      const manuais = rows.filter(r => r.status === "enviado" && !r.is_auto);
      const semLancamento = manuais.length === 0;

      const dayState = new Map<string, EmptyState>();
      const covMap = new Map(cov.map(d => [d.date, d.state] as const));
      allDays.forEach(d => {
        const s = covMap.get(d);
        dayState.set(d, !s ? "na" : s === "missing" ? "missing" : s === "pending" ? "pending" : s === "future" ? "future" : "missing");
      });

      const ogs = [...new Set(rows.map(r => r.ogs_number).filter(Boolean))].join(", ");
      const ops = [...new Set(rows.map(r => r.usuario_nome).filter(n => n && n !== "—"))].join(", ");
      items.push({
        key: frota, kind: "frota",
        titulo: label,
        subtitulo: `${frota !== label ? `Frota: ${frota} | ` : ""}${tipo || "—"}${ogs ? ` | OGS: ${ogs}` : ""}${ops ? ` | ${ops}` : ""}${devolvido ? " | DEVOLVIDO" : ""}`,
        tipo, rows, semLancamento, missing, breaks, dayState, dispensado,
        badgeText: pct === null ? "Aguardando" : `${done}/${billable.length} dias (${pct}%)`,
        badgeCls: pct === null ? "bg-gray-100 text-gray-600"
          : pct === 100 ? "bg-green-100 text-green-700"
          : pct >= 70 ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700",
      });
    });
    return items;
  }, [diarios, todasFrotas, meterBaselines, loadedRange, allDays, hojeISO, cfg]);

  // Pendências consideram só equipamentos que exigem diário (independe de busca/tipo)
  const frotaPendencias = useMemo(
    () => frotaItensTodos.filter(i => !i.dispensado && (i.missing.length || i.breaks.length)),
    [frotaItensTodos],
  );

  const frotaCards: ListItem[] = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const lista = frotaItensTodos
      .filter(i => !(cfg.ocultar && i.dispensado))
      .filter(i => !tipoFiltro || tipoKey(i.tipo) === tipoFiltro)
      .filter(i => !b || i.titulo.toLowerCase().includes(b) || i.key.toLowerCase().includes(b) || i.tipo.toLowerCase().includes(b))
      .filter(i => !apenasSemlancamento || i.semLancamento)
      .filter(i => !apenasPendentes || i.missing.length > 0 || i.breaks.length > 0);
    return lista.sort((a, b) => ordem === "pendencias"
      ? (b.missing.length + b.breaks.length) - (a.missing.length + a.breaks.length) || a.key.localeCompare(b.key, "pt-BR", { numeric: true })
      : a.key.localeCompare(b.key, "pt-BR", { numeric: true }));
  }, [frotaItensTodos, cfg.ocultar, tipoFiltro, busca, apenasSemlancamento, apenasPendentes, ordem]);

  // Usuários
  const usuarioCards: ListItem[] = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const porUsuario: Record<string, { nome: string; email: string; rows: DiarioRow[] }> = {};
    diarios.forEach(r => {
      const k = r.usuario_id || r.usuario_nome;
      if (!porUsuario[k]) porUsuario[k] = { nome: r.usuario_nome, email: r.usuario_email, rows: [] };
      porUsuario[k].rows.push(r);
    });
    const usuariosComLancamento = new Set(diarios.filter(r => r.status === "enviado").map(r => r.usuario_id));
    const dayState = new Map<string, EmptyState>();
    allDays.forEach(d => dayState.set(d, d < hojeISO ? "missing" : d === hojeISO ? "pending" : "future"));
    const mk = (key: string, nome: string, email: string, rows: DiarioRow[], sem: boolean): ListItem => {
      const dias = new Set(rows.filter(r => r.status === "enviado" && !r.is_auto).map(r => r.date)).size;
      const pct = sem ? 0 : Math.round((dias / (allDays.length || 1)) * 100);
      return {
        key, kind: "usuario", titulo: nome, subtitulo: email, tipo: "", rows, semLancamento: sem,
        missing: [], breaks: [], dayState, dispensado: false,
        badgeText: sem ? "0 lançamentos" : `${dias}/${allDays.length} dias (${pct}%)`,
        badgeCls: sem || pct === 0 ? "bg-red-100 text-red-700" : pct === 100 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700",
      };
    };
    const match = (nome: string, email: string) => !b || nome.toLowerCase().includes(b) || email.toLowerCase().includes(b);
    return apenasSemlancamento
      ? todosUsuarios.filter(u => !usuariosComLancamento.has(u.id)).filter(u => match(u.nome, u.email)).map(u => mk(u.id, u.nome, u.email, [], true))
      : Object.entries(porUsuario).filter(([, v]) => match(v.nome, v.email))
          .sort((a, b2) => a[1].nome.localeCompare(b2[1].nome))
          .map(([k, v]) => mk(k, v.nome, v.email, v.rows, false));
  }, [diarios, todosUsuarios, allDays, hojeISO, busca, apenasSemlancamento]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalEnviados  = diarios.filter(d => d.status === "enviado").length;
  const totalRascunhos = diarios.filter(d => d.status === "rascunho").length;
  const frotasMonitoradas = frotaItensTodos.filter(i => !i.dispensado);
  const qtdUsuarios = new Set(diarios.map(r => r.usuario_id || r.usuario_nome)).size;
  const qtdDispensadas = frotaItensTodos.filter(i => i.dispensado).length;

  const itens = aba === "usuario" ? usuarioCards : frotaCards;
  const selecionado = itens.find(i => i.key === selKey) || itens[0];

  function toggleExpandido(key: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const expandirTudo = () => setExpandidos(prev => prev.size > 0 ? new Set() : new Set(itens.filter(i => !(i.kind === "usuario" && i.semLancamento)).map(i => `${i.kind}_${i.key}`)));

  const copiarCobranca = async (item: ListItem) => {
    const texto = `Pendência de diário de equipamento\n${item.titulo}${item.key !== item.titulo ? ` (${item.key})` : ""}${item.tipo ? ` — ${item.tipo}` : ""}\nDias sem diário lançado: ${item.missing.map(fmtShort).join(", ")}\nPor favor, lance os diários que faltam.`;
    try { await navigator.clipboard.writeText(texto); toast.success("Cobrança copiada"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const abrirModal = (titulo: string, rows: DiarioRow[]) => setModal({ titulo, rows });

  // Config: listas auxiliares
  const frotasParaConfig = useMemo(() => {
    const b = cfgBusca.trim().toLowerCase();
    return todasFrotas
      .filter(f => f.status?.toLowerCase() !== "devolvido")
      .filter(f => !b || f.frota.toLowerCase().includes(b) || (f.centro_custo || "").toLowerCase().includes(b) || f.tipo.toLowerCase().includes(b))
      .sort((a, b2) => a.frota.localeCompare(b2.frota, "pt-BR", { numeric: true }));
  }, [todasFrotas, cfgBusca]);
  const contagemPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    todasFrotas.filter(f => f.status?.toLowerCase() !== "devolvido").forEach(f => { const k = tipoKey(f.tipo); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [todasFrotas]);

  const toggleTipoObrigatorio = (t: string) =>
    salvarCfg({ ...cfg, tipos: cfg.tipos.includes(t) ? cfg.tipos.filter(x => x !== t) : [...cfg.tipos, t] });
  const toggleFrotaObrigatoria = (f: string) =>
    salvarCfg({ ...cfg, frotas: cfg.frotas.includes(f) ? cfg.frotas.filter(x => x !== f) : [...cfg.frotas, f] });

  // ── Subcomponentes de renderização ────────────────────────────────────────
  const avatar = (item: ListItem) => item.kind === "frota"
    ? <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center flex-shrink-0"><Wrench size={18}/></div>
    : <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{item.titulo.charAt(0)}</div>;

  const pendChips = (item: ListItem) => (
    <>
      {item.dispensado && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">dispensado</span>}
      {item.missing.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">{item.missing.length} faltando</span>}
      {item.breaks.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">{item.breaks.length} diverg.</span>}
    </>
  );

  // ──────────────────────────────────────────────────────────────────────────
  const containerCls = painel ? "w-full max-w-none px-4 2xl:px-8" : "max-w-7xl mx-auto px-4";

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
          <div className={`${containerCls} py-4 flex items-center gap-3`}>
            <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Controle de Lançamentos</h1>
              <p className="text-slate-300 text-sm">Visão gerencial dos diários de equipamentos por usuário e por frota</p>
            </div>
            <div className="hidden md:flex rounded-lg border border-white/20 overflow-hidden" title="Layout da tela">
              <button onClick={() => trocarLayout("padrao")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${!painel ? "bg-white text-slate-800" : "text-white/80 hover:bg-white/10"}`}>
                <LayoutList size={14} /> Padrão
              </button>
              <button onClick={() => trocarLayout("painel")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${painel ? "bg-white text-slate-800" : "text-white/80 hover:bg-white/10"}`}>
                <Monitor size={14} /> Painel ultrawide
              </button>
            </div>
            <Button onClick={() => window.print()} size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 no-print">
              <Download size={16} /> Exportar PDF
            </Button>
          </div>
        </div>

        <div className={`${containerCls} py-6`}>

          {/* FILTROS */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 no-print">
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
                <Input placeholder={aba === "usuario" ? "Nome ou email..." : "Frota/CC ou tipo..."}
                  value={busca} onChange={e => setBusca(e.target.value)} className="h-9 text-sm" />
              </div>

              {aba === "equipamento" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">ORDENAR</label>
                    <select value={ordem} onChange={e => setOrdem(e.target.value as "pendencias" | "az")}
                      className="h-9 text-sm border border-gray-200 rounded-md px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
                      <option value="pendencias">Mais pendências primeiro</option>
                      <option value="az">Frota (A–Z)</option>
                    </select>
                  </div>
                  <button onClick={() => setApenasPendentes(v => !v)}
                    className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border transition-all ${
                      apenasPendentes ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                    <AlertCircle size={15} /> Só com pendência
                  </button>
                </>
              )}

              <button onClick={() => setApenasSemlancamento(v => !v)}
                className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border transition-all ${
                  apenasSemlancamento ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                <FileX size={15} /> Só sem lançamentos
              </button>

              {aba === "equipamento" && (
                <button onClick={() => setCfgAberta(v => !v)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border transition-all ${
                    cfgAberta ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                  <Settings2 size={15} /> Equipamentos obrigatórios{qtdDispensadas > 0 ? ` (${qtdDispensadas} dispensados)` : ""}
                </button>
              )}
            </div>

            {/* CONFIG — quais equipamentos exigem diário */}
            {aba === "equipamento" && cfgAberta && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-slate-600 mb-3">
                  Desmarque o que <strong>não precisa</strong> de diário (ex.: reboques, tanques, equipamentos parados). Dispensados saem da lista, das pendências e dos totais.
                  A escolha fica salva neste navegador.
                </p>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" checked={cfg.ocultar} onChange={e => salvarCfg({ ...cfg, ocultar: e.target.checked })} />
                  Ocultar equipamentos dispensados da lista
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-500">POR TIPO</span>
                      <span className="text-xs">
                        <button className="underline mr-3" onClick={() => salvarCfg({ ...cfg, tipos: [] })}>Todos obrigatórios</button>
                        <button className="underline" onClick={() => salvarCfg({ ...cfg, tipos: [...tiposEquipamento] })}>Nenhum</button>
                      </span>
                    </div>
                    <div className="max-h-64 overflow-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                      {tiposEquipamento.map(t => (
                        <label key={t} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={!cfg.tipos.includes(t)} onChange={() => toggleTipoObrigatorio(t)} />
                          <span className="flex-1">{t}</span>
                          <span className="text-xs text-gray-400">{contagemPorTipo.get(t) || 0}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-xs font-semibold text-gray-500">POR EQUIPAMENTO</span>
                      <Input placeholder="Filtrar..." value={cfgBusca} onChange={e => setCfgBusca(e.target.value)} className="h-7 text-xs w-48" />
                    </div>
                    <div className="max-h-64 overflow-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                      {frotasParaConfig.map(f => {
                        const porTipo = cfg.tipos.includes(tipoKey(f.tipo));
                        return (
                          <label key={f.frota} className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 ${porTipo ? "opacity-50" : ""}`}>
                            <input type="checkbox" checked={!porTipo && !cfg.frotas.includes(f.frota)} disabled={porTipo} onChange={() => toggleFrotaObrigatoria(f.frota)} />
                            <span className="font-semibold">{f.centro_custo || f.frota}</span>
                            <span className="text-xs text-gray-400 flex-1 truncate">{f.centro_custo && f.centro_custo !== f.frota ? `${f.frota} · ` : ""}{f.tipo}{porTipo ? " (dispensado pelo tipo)" : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PENDÊNCIAS */}
          <details open={!painel} className="bg-white rounded-xl border border-gray-200 p-4 mb-4 group">
            <summary className="cursor-pointer list-none flex items-center gap-3">
              <h2 className="font-semibold text-slate-800">Pendências diárias por frota</h2>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${frotaPendencias.length ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {frotaPendencias.length} frota(s)
              </span>
              <span className="text-xs text-gray-400">{fmtDate(loadedRange.start)} a {fmtDate(loadedRange.end)} ({allDays.length} dias)</span>
              <ChevronDown size={16} className="ml-auto text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-3">
              {fetchError && <p className="text-destructive font-semibold" role="alert">{fetchError}</p>}
              <details className="mb-3 text-xs text-slate-500">
                <summary className="cursor-pointer underline w-fit">Como a cobrança é calculada</summary>
                <p className="mt-1.5 text-sm text-slate-600">Todos os dias desde o cadastro contam, inclusive fins de semana, manutenção e dias parados; hoje ainda não está atrasado. A medição inicial é comparada com até 90 dias anteriores; sem leitura nesse intervalo, não há referência confiável. Devolvidos não geram cobrança atual (sem data histórica de devolução). Diários automáticos não quitam a obrigação. Mais de um uso ou turno deve gerar mais de um lançamento; sem escala independente, o painel só confirma os turnos efetivamente enviados. Equipamentos marcados como dispensados não entram na cobrança.</p>
              </details>
              {!fetchError && frotaPendencias.length === 0 ? <p className="text-sm text-slate-500">Nenhuma pendência detectada no período carregado.</p> : !fetchError &&
                <div className={`${painel ? "max-h-72" : "max-h-96"} overflow-auto ${painel ? "grid gap-2 xl:grid-cols-2 2xl:grid-cols-3 content-start" : "space-y-2"}`}>
                  {frotaPendencias.map(f => (
                    <button key={f.key} type="button"
                      onClick={() => { setAba("equipamento"); setSelKey(f.key); setExpandidos(prev => new Set(prev).add("frota_" + f.key)); }}
                      className="w-full text-left rounded-md border border-gray-200 p-2 text-sm hover:bg-gray-50">
                      <span className="font-semibold">{f.titulo}</span>{f.titulo !== f.key && <span className="text-gray-500"> ({f.key})</span>}
                      <span className="text-slate-600"> — {f.missing.length} dias sem diário · {f.breaks.length} divergências</span>
                    </button>
                  ))}
                </div>}
            </div>
          </details>

          {/* KPIs */}
          <div className={`grid grid-cols-2 ${painel ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3 mb-4`}>
            {[
              { label: "Usuários",     val: qtdUsuarios, color: "bg-blue-600",   icon: <Users size={18}/> },
              { label: qtdDispensadas ? `Frotas monitoradas (${qtdDispensadas} dispensadas)` : "Frotas monitoradas", val: frotasMonitoradas.length, color: "bg-teal-600", icon: <Wrench size={18}/> },
              { label: "✅ Enviados",   val: totalEnviados,  color: "bg-green-600",  icon: <CheckCircle2 size={18}/> },
              { label: "📝 Rascunhos",  val: totalRascunhos, color: "bg-orange-500", icon: <AlertCircle size={18}/> },
              ...(painel ? [{ label: "Frotas com pendência", val: frotaPendencias.length, color: "bg-red-600", icon: <FileX size={18}/> }] : []),
            ].map(k => (
              <div key={k.label} className={`${k.color} text-white rounded-xl ${painel ? "p-3" : "p-4"} flex items-center gap-3 shadow-sm`}>
                <div className="opacity-80">{k.icon}</div>
                <div>
                  <div className="text-2xl font-bold">{k.val}</div>
                  <div className="text-xs opacity-80 font-medium">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ABAS */}
          <div className="flex gap-2 mb-4 no-print items-center">
            {(["usuario","equipamento"] as const).map(id => (
              <button key={id}
                onClick={() => { setAba(id); setBusca(""); setTipoFiltro(""); setApenasSemlancamento(false); setApenasPendentes(false); setSelKey(""); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  aba === id ? "bg-slate-800 text-white shadow" : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"
                }`}>
                {id === "usuario" ? <><Users size={15}/> Por Usuário</> : <><Wrench size={15}/> Por Equipamento</>}
              </button>
            ))}
            <span className="text-sm text-gray-500 ml-2">{itens.length} {aba === "usuario" ? "usuário(s)" : "equipamento(s)"} na lista</span>
            {!painel && itens.length > 0 && (
              <button onClick={expandirTudo} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                <ChevronsUpDown size={14} /> {expandidos.size > 0 ? "Recolher tudo" : "Expandir tudo"}
              </button>
            )}
          </div>

          {loading && <div className="text-center py-16 text-gray-400 text-sm">Carregando lançamentos...</div>}
          {!loading && itens.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              {apenasSemlancamento
                ? (aba === "usuario" ? "🎉 Todos os usuários lançaram no período!" : "🎉 Todos os equipamentos lançaram no período!")
                : apenasPendentes ? "🎉 Nenhum equipamento com pendência no período!"
                : aba === "usuario" ? "Nenhum usuário encontrado para o período." : "Nenhum equipamento encontrado."}
            </div>
          )}

          {/* ═══ LISTA — modo padrão (acordeão) ═══ */}
          {!loading && !painel && (
            <div className="space-y-3">
              {itens.map(item => {
                const ek = `${item.kind}_${item.key}`;
                const exp = expandidos.has(ek);
                const podeExpandir = !(item.kind === "usuario" && item.semLancamento);
                return (
                  <div key={ek} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${item.dispensado ? "border-gray-200 opacity-70" : "border-gray-200"}`}>
                    <button onClick={() => podeExpandir && toggleExpandido(ek)}
                      className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${podeExpandir ? "hover:bg-gray-50" : "cursor-default"}`}>
                      {avatar(item)}
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-slate-800 ${item.kind === "frota" ? "font-bold text-base" : "truncate"}`}>{item.titulo}</div>
                        <div className="text-xs text-gray-400 truncate">{item.subtitulo}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {pendChips(item)}
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${item.badgeCls}`}>{item.badgeText}</span>
                        <span className="text-xs text-gray-400">{item.rows.length} registros</span>
                        {podeExpandir && (exp ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>)}
                      </div>
                    </button>
                    {exp && podeExpandir && (
                      <div className="border-t border-gray-100">
                        <Detalhe item={item} diasLabel={diasLabel} onCell={abrirModal} onCopy={copiarCobranca} onNavigate={navigate} compact={false} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ PAINEL ULTRAWIDE — lista à esquerda, detalhe à direita ═══ */}
          {!loading && painel && itens.length > 0 && (
            <div className="grid gap-4 items-start grid-cols-1 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
              <div className="no-print lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)] overflow-y-auto space-y-1.5 pr-1">
                {itens.map(item => {
                  const ativo = selecionado?.key === item.key;
                  return (
                    <button key={`${item.kind}_${item.key}`} onClick={() => setSelKey(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        ativo ? "bg-slate-800 border-slate-800 text-white shadow" : "bg-white border-gray-200 hover:bg-gray-50"} ${item.dispensado && !ativo ? "opacity-60" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm truncate ${ativo ? "text-white" : "text-slate-800"}`}>{item.titulo}</div>
                        <div className={`text-[11px] truncate ${ativo ? "text-slate-300" : "text-gray-400"}`}>{item.subtitulo}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeCls}`}>{item.badgeText}</span>
                        <div className="flex gap-1">{pendChips(item)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-w-0">
                {selecionado && (
                  <>
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                      {avatar(selecionado)}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-lg">{selecionado.titulo}</div>
                        <div className="text-xs text-gray-400 truncate">{selecionado.subtitulo}</div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${selecionado.badgeCls}`}>{selecionado.badgeText}</span>
                      <span className="text-xs text-gray-400">{selecionado.rows.length} registros</span>
                    </div>
                    <Detalhe item={selecionado} diasLabel={diasLabel} onCell={abrirModal} onCopy={copiarCobranca} onNavigate={navigate} compact />
                  </>
                )}
              </div>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useEquipamentoTipos } from "@/hooks/useEquipamentoTipos";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";

// Ordena apontamentos respeitando turno noturno (virada de meia-noite)
// Horários antes das 07:00 são tratados como continuação do dia anterior
const sortNocturnalEntries = (entries: any[]): any[] => {
  const toMinutes = (t: string | null | undefined): number => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    const mins = (h ?? 0) * 60 + (m ?? 0);
    return mins < 7 * 60 ? mins + 24 * 60 : mins;
  };
  return [...entries].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
};

interface EquipamentoCadastro {
  id: string;
  frota: string | null;
  tipo: string | null;
  categoria_rdo: string | null;
}

interface Lancamento {
  id: string;
  created_at: string | null;
  date: string | null;
  equipment_fleet: string | null;
  equipment_type: string | null;
  work_status: string | null;
  period: string | null;
  operator_name: string | null;
  operator_solo?: string | null;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  observations: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  fuel_liters: number | null;
  fuel_type?: string | null;
  fuel_meter?: number | null;
  status: string | null;
}

interface KmaOperationDetail {
  operation_type: string | null;
  cap_type: string | null;
  cap_supplier: string | null;
  cap_qty_ton: number | null;
  cap_nf_number: string | null;
  filer_type: string | null;
  filer_supplier: string | null;
  filer_qty_ton: number | null;
  aggregates_supplier: string | null;
  silo1_material: string | null;
  silo1_qty: number | null;
  silo2_material: string | null;
  silo2_qty: number | null;
  water_liters: number | null;
  water_supplier: string | null;
  total_volume_machined_ton: number | null;
}

interface AccessContext {
  userId: string;
  companyId: string | null;
  effectiveCompanyId: string | null;
  isAdminUser: boolean;
  permRdoViewAll: boolean;
  permEquipViewAll: boolean;
  nomesResponsavel: string[];
}

interface LinkedRowsCacheEntry {
  at: number;
  rows: Lancamento[];
}

interface EquipamentosCacheEntry {
  at: number;
  rows: EquipamentoCadastro[];
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function normalizarTipoEquipamento(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  const norm = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const aliases: Record<string, string> = {
    CAMINHOES: "Caminhões",
    COMBOIO: "Caminhões",
    "CAMINHAO COMBOIO": "Caminhões",
    VEICULO: "Veículo",
    CARRETA: "Carreta",
    RETRO: "Retro",
    ROLO: "Rolo",
    BOBCAT: "Bobcat",
    FRESADORA: "Fresadora",
    "USINA KMA": "Usina KMA",
    "USINA MOVEL": "Usina KMA",
    VIBROACABADORA: "Vibroacabadora",
  };

  return aliases[norm] || v;
}

function normTxt(v: string | null | undefined): string {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const FILTER_KEY_BASE = "meusLancamentos_filtros";

const buildFilterKey = (userId?: string | null) => `${FILTER_KEY_BASE}:${userId || "anon"}`;

function salvarFiltros(filterKey: string, filtros: Record<string, string>) {
  try { sessionStorage.setItem(filterKey, JSON.stringify(filtros)); } catch {}
}

function restaurarFiltros(filterKey: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(filterKey);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function MeusLancamentos() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSmartBack("/");
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const { categorias } = useEquipamentoTipos();
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [rdos, setRdos] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; tipo: "equipamento" | "rdo"; label: string } | null>(null);
  const [deletando, setDeletando] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [rascunhos, setRascunhos] = useState<Lancamento[]>([]);
  const [rascunhosRdo, setRascunhosRdo] = useState<any[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [subtipos, setSubtipos] = useState<string[]>([]);
  const [frotas, setFrotas] = useState<string[]>([]);

  // Filtros persistidos por usuário (evita vazar filtro entre usuários/impersonação)
  const [filtroKey, setFiltroKey] = useState(buildFilterKey(null));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessContext, setAccessContext] = useState<AccessContext | null>(null);
  const linkedRowsCacheRef = useRef<Map<string, LinkedRowsCacheEntry>>(new Map());
  const equipamentosCacheRef = useRef<Map<string, EquipamentosCacheEntry>>(new Map());
  const loadRequestRef = useRef(0);
  const [filtrosHidratados, setFiltrosHidratados] = useState(false);
  const [tipoEquipamento, setTipoEquipamento] = useState("todos");
  const [subtipoEquipamento, setSubtipoEquipamento] = useState("todos");
  const [frotaSelecionada, setFrotaSelecionada] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Abre na aba correta se vier de WF Obras ou WF Equipamentos
  const abaInicial = (() => {
    try {
      const sinal = sessionStorage.getItem("meusLancamentos_aba");
      if (sinal === "rdos" || sinal === "ocorrencias") {
        sessionStorage.removeItem("meusLancamentos_aba");
        return sinal as "rdos" | "ocorrencias";
      }
    } catch {}
    return "equipamentos";
  })();
  const [aba, setAba] = useState<"equipamentos" | "rdos" | "ocorrencias">(abaInicial);
  const breadcrumbLabel = aba === "rdos"
    ? "Meus Lançamentos (RDOs)"
    : aba === "ocorrencias"
      ? "Meus Lançamentos (Ocorrências)"
      : "Meus Lançamentos";
  const { trail, goTo } = useNavigationTrail({ label: breadcrumbLabel });
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [detalheExtra, setDetalheExtra] = useState<{ areas: any[]; bits: any[]; times: any[]; horas: number | null; kmaOperation: KmaOperationDetail | null }>({ areas: [], bits: [], times: [], horas: null, kmaOperation: null });

  const abrirDetalhe = async (item: Lancamento) => {
    setSelecionado(item);
    setEditandoId(null);
    setDetalheExtra({ areas: [], bits: [], times: [], horas: null, kmaOperation: null });
    const [{ data: areas }, { data: bits }, { data: times }, { data: kmaOps }] = await Promise.all([
      supabase.from('equipment_production_areas').select('*').eq('diary_id', item.id),
      supabase.from('bit_entries').select('*').eq('diary_id', item.id),
      supabase.from('equipment_time_entries').select('*').eq('diary_id', item.id),
      supabase.from('kma_operations').select('*').eq('diary_id', item.id).limit(1),
    ]);
    const PARADAS = ['Refeições', 'À Disposição', 'Manutenção'];
    let horasTotal = 0;
    (times || []).forEach((t: any) => {
      if (t.start_time && t.end_time && !PARADAS.includes(t.activity || '')) {
        const [sh, sm] = t.start_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        horasTotal += diff / 60;
      }
    });
    const sortedTimes = sortNocturnalEntries(times || []);
    setDetalheExtra({
      areas: areas || [],
      bits: bits || [],
      times: sortedTimes,
      horas: horasTotal > 0 ? Math.round(horasTotal * 10) / 10 : null,
      kmaOperation: ((kmaOps || [])[0] as KmaOperationDetail | undefined) ?? null,
    });
  };

  const handleDeletar = async () => {
    if (!confirmDelete) return;
    setDeletando(true);
    try {
      if (confirmDelete.tipo === "equipamento") {
        await (supabase as any).from("equipment_diaries").delete().eq("id", confirmDelete.id);
        setLancamentos(prev => prev.filter(l => l.id !== confirmDelete.id));
        setRascunhos(prev => prev.filter(l => l.id !== confirmDelete.id));
      } else {
        // Deletar RDO e dados relacionados
        await Promise.all([
          (supabase as any).from("rdo_efetivo").delete().eq("rdo_id", confirmDelete.id),
          (supabase as any).from("rdo_producao").delete().eq("rdo_id", confirmDelete.id),
          (supabase as any).from("rdo_equipamentos").delete().eq("rdo_id", confirmDelete.id),
          (supabase as any).from("rdo_nf_massa").delete().eq("rdo_id", confirmDelete.id),
        ]);
        await (supabase as any).from("rdo_diarios").delete().eq("id", confirmDelete.id);
        setRdos(prev => prev.filter(r => r.id !== confirmDelete.id));
        setRascunhosRdo(prev => prev.filter(r => r.id !== confirmDelete.id));
      }
      linkedRowsCacheRef.current.clear();
    } finally {
      setDeletando(false);
      setConfirmDelete(null);
    }
  };

  const handleEditarLancamento = async (item: Lancamento) => {
    // Salva filtros ativos antes de sair para edição
    salvarFiltros(filtroKey, { tipoEquipamento, subtipoEquipamento, frotaSelecionada, dataInicio, dataFim });
    setEditandoId(item.id);
    linkedRowsCacheRef.current.clear();
    await new Promise((resolve) => setTimeout(resolve, 200));
    navigate(
      `/equipamentos/diario?edit=${item.id}&tipo=${encodeURIComponent(
        item.equipment_type || "",
      )}&frota=${encodeURIComponent(item.equipment_fleet || "")}&returnTo=${returnTo}`,
    );
  };

  const handleLimparFiltros = () => {
    setTipoEquipamento("todos");
    setSubtipoEquipamento("todos");
    setFrotaSelecionada("todas");
    setDataInicio("");
    setDataFim("");
    try {
      sessionStorage.removeItem(filtroKey);
    } catch {}
  };

  const carregar = async () => {
    const requestId = ++loadRequestRef.current;
    const isStale = () => requestId !== loadRequestRef.current;

    const perfEnabled = new URLSearchParams(location.search).get("wfPerf") === "1";
    const perfRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const t0 = performance.now();
    let tMark = t0;
    const perfSteps: Array<{ step: string; ms: number }> = [];
    const stamp = (step: string) => {
      if (!perfEnabled) return;
      const now = performance.now();
      perfSteps.push({ step, ms: Math.round((now - tMark) * 100) / 100 });
      tMark = now;
    };

    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
    stamp("auth.getUser");
    if (isStale()) return;
    const user = authData.user;

    if (!user) {
      if (isStale()) return;
      setCurrentUserId(null);
      setAccessContext(null);
      linkedRowsCacheRef.current.clear();
      equipamentosCacheRef.current.clear();
      setLancamentos([]);
      setTipos([]);
      setLoading(false);
      if (perfEnabled) {
        console.info("[WF PERF] MeusLancamentos.carregar", {
          runId: perfRunId,
          totalMs: Math.round((performance.now() - t0) * 100) / 100,
          user: "anon",
          steps: perfSteps,
        });
      }
      return;
    }

    let ctx = accessContext;
    const contextCacheHit = !!ctx && ctx.userId === user.id;

    if (!ctx || ctx.userId !== user.id) {
      // Verificar perfil do usuário — admin vê todos os lançamentos da empresa
      const { data: profileData } = await supabase
        .from("profiles")
        .select("perfil, role, company_id, nome_completo")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdminByProfile = (profileData as any)?.perfil === "Administrador" || (profileData as any)?.role === "superadmin";
      const companyId = (profileData as any)?.company_id;

      // Buscar TODOS os roles do usuário em user_admin_roles (pode ter múltiplos)
      const { data: roleAssignments } = await (supabase as any)
        .from("user_admin_roles")
        .select("role_id, company_id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      let permRdoViewAll = false;
      let permEquipViewAll = false;
      let roleCompanyId: string | null = null;

      if (roleAssignments && roleAssignments.length > 0) {
        // Pega o company_id de qualquer assignment (todos devem ser da mesma empresa)
        roleCompanyId = roleAssignments[0]?.company_id || null;

        // Busca permissões de TODOS os roles do usuário de uma vez
        const roleIds = roleAssignments.map((r: any) => r.role_id).filter(Boolean);
        const { data: perms } = await (supabase as any)
          .from("admin_permissions")
          .select("resource, action")
          .in("role_id", roleIds);

        (perms || []).forEach((p: any) => {
          if ((p.resource === "rdo_diarios" || p.resource === "all") && (p.action === "view_all" || p.action === "manage")) {
            permRdoViewAll = true;
          }
          if ((p.resource === "equipment_diaries" || p.resource === "all") && (p.action === "view_all" || p.action === "manage")) {
            permEquipViewAll = true;
          }
        });
      }

      const isAdminUser = isAdminByProfile;
      const effectiveCompanyId = companyId || roleCompanyId;
      const profileFullName = ((profileData as any)?.nome_completo || "").trim();

      // Nome canônico do encarregado/responsável na base (employees.name), para casar com rdo_diarios.encarregado/responsavel
      let nomeCanonicoEncarregado: string | null = null;
      const nameParts = profileFullName
        .split(/\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);

      if (effectiveCompanyId && nameParts.length >= 2) {
        const primeiro = nameParts[0];
        const ultimo = nameParts[nameParts.length - 1];
        const { data: emp } = await (supabase as any)
          .from("employees")
          .select("name")
          .eq("company_id", effectiveCompanyId)
          .ilike("name", `%${primeiro}%`)
          .ilike("name", `%${ultimo}%`)
          .maybeSingle();
        nomeCanonicoEncarregado = (emp?.name || "").trim() || null;
      }

      const nomesResponsavel = Array.from(
        new Set(
          [profileFullName, nomeCanonicoEncarregado]
            .map((n) => (n || "").trim())
            .filter(Boolean),
        ),
      );

      ctx = {
        userId: user.id,
        companyId,
        effectiveCompanyId,
        isAdminUser,
        permRdoViewAll,
        permEquipViewAll,
        nomesResponsavel,
      };

      if (isStale()) return;
      setAccessContext(ctx);
    }

    if (isStale()) return;
    const { companyId, effectiveCompanyId, isAdminUser, permRdoViewAll, permEquipViewAll, nomesResponsavel } = ctx;

    if (isStale()) return;
    setIsAdmin(isAdminUser || permEquipViewAll || permRdoViewAll);
    const isAdmin = isAdminUser || permEquipViewAll || permRdoViewAll;
    const shouldLoadRdos = aba === "rdos";
    const shouldLoadOcorrencias = aba === "ocorrencias";
    stamp(`accessContext.${contextCacheHit ? "hit" : "miss"}`);

    const equipamentosCacheKey = effectiveCompanyId || "__all__";
    const cachedEquipamentos = equipamentosCacheRef.current.get(equipamentosCacheKey);
    const equipamentosCacheValid =
      !!cachedEquipamentos && (Date.now() - cachedEquipamentos.at) < 60_000;

    const equipamentosPromise: Promise<{ data: EquipamentoCadastro[] }> = equipamentosCacheValid
      ? Promise.resolve({ data: cachedEquipamentos.rows })
      : (async () => {
          let eqQuery = (supabase as any)
            .from("equipamentos")
            .select("id, frota, tipo, categoria_rdo, status");

          // IMPORTANTE: para mapear subtipo corretamente no histórico de Meus Lançamentos,
          // precisamos considerar TODAS as frotas da empresa (ativo, devolvido, manutenção, etc.),
          // e não somente status "ativo".
          if (effectiveCompanyId) {
            eqQuery = eqQuery.eq("company_id", effectiveCompanyId);
          }

          const { data } = await eqQuery;
          const rows = (data || []) as EquipamentoCadastro[];
          equipamentosCacheRef.current.set(equipamentosCacheKey, {
            at: Date.now(),
            rows,
          });
          return { data: rows };
        })();

    const buildEquipBaseQuery = () => {
      let q = (supabase as any)
        .from("equipment_diaries")
        .select("*")
        .neq("status", "rascunho")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
      if (frotaSelecionada !== "todas") q = q.eq("equipment_fleet", frotaSelecionada);
      if (dataInicio) q = q.gte("date", dataInicio);
      if (dataFim) q = q.lte("date", dataFim);
      return q;
    };

    let rows: Lancamento[] = [];
    let linkedCacheStatus: "n/a" | "hit" | "miss" = "n/a";

    if ((isAdmin && companyId) || (permEquipViewAll && effectiveCompanyId)) {
      const { data } = await buildEquipBaseQuery();
      rows = (data || []) as Lancamento[];
    } else {
      // Próprios lançamentos
      const ownPromise = buildEquipBaseQuery().eq("user_id", user.id);

      const linkedCacheKey = [
        user.id,
        effectiveCompanyId || "-",
        dataInicio || "-",
        dataFim || "-",
        frotaSelecionada,
        ...[...nomesResponsavel].sort((a, b) => a.localeCompare(b, "pt-BR")).map((n) => normTxt(n)),
      ].join("|");

      const cachedLinkedEntry = linkedRowsCacheRef.current.get(linkedCacheKey);
      const isLinkedCacheValid = !!cachedLinkedEntry && (Date.now() - cachedLinkedEntry.at) < 45_000;
      linkedCacheStatus = isLinkedCacheValid ? "hit" : "miss";
      let linkedRows: Lancamento[] = isLinkedCacheValid ? cachedLinkedEntry.rows : [];

      const ownResult = await ownPromise;

      if (!isLinkedCacheValid) {
        // + lançamentos vinculados aos RDOs onde o usuário é encarregado/responsável
        const buildResponsavelRdoQuery = () => {
          let q = (supabase as any)
            .from("rdo_diarios")
            .select("id,data,obra_nome")
            .order("data", { ascending: false });

          if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
          if (dataInicio) q = q.gte("data", dataInicio);
          if (dataFim) q = q.lte("data", dataFim);
          return q;
        };

        const consultasRdoResp: Promise<any>[] = [];
        nomesResponsavel.forEach((nome) => {
          consultasRdoResp.push(buildResponsavelRdoQuery().ilike("encarregado", nome));
          consultasRdoResp.push(buildResponsavelRdoQuery().ilike("responsavel", nome));
        });

        const rdoRespResults = await Promise.all(consultasRdoResp);

        const rdoById = new Map<string, { id: string; data: string | null; obra_nome: string | null }>();
        rdoRespResults.forEach((res) => {
          (res?.data || []).forEach((r: any) => {
            if (r?.id && !rdoById.has(r.id)) rdoById.set(r.id, r);
          });
        });

        linkedRows = [];
        const rdosResp = Array.from(rdoById.values());

        if (rdosResp.length > 0 && effectiveCompanyId) {
          const rdoIds = rdosResp.map((r) => r.id);
          const fleetDayKeys = new Set<string>();
          const rdoWithEquipSet = new Set<string>();

          // Fonte principal: rdo_equipamentos
          for (const ids of chunkArray(rdoIds, 150)) {
            const { data: eqRows } = await (supabase as any)
              .from("rdo_equipamentos")
              .select("rdo_id,frota")
              .eq("company_id", effectiveCompanyId)
              .in("rdo_id", ids);

            (eqRows || []).forEach((eq: any) => {
              const rdo = rdoById.get(eq?.rdo_id);
              if (!rdo?.data || !eq?.frota) return;
              fleetDayKeys.add(`${rdo.data}|${normTxt(eq.frota)}`);
              rdoWithEquipSet.add(eq.rdo_id);
            });
          }

          // Fallback legado: RDO sem linhas em rdo_equipamentos
          const rdosSemEquip = rdosResp.filter((r) => !rdoWithEquipSet.has(r.id));
          if (rdosSemEquip.length > 0) {
            const ogsSet = new Set<string>();
            const dateSet = new Set<string>();
            const keyDataOgs = new Set<string>();

            rdosSemEquip.forEach((r) => {
              const data = (r.data || "").trim();
              const ogs = (r.obra_nome || "").trim();
              if (!data || !ogs) return;
              ogsSet.add(ogs);
              dateSet.add(data);
              keyDataOgs.add(`${data}|${normTxt(ogs)}`);
            });

            const ogsList = Array.from(ogsSet);
            const dateList = Array.from(dateSet).sort();
            if (ogsList.length > 0 && dateList.length > 0) {
              const minDate = dateList[0];
              const maxDate = dateList[dateList.length - 1];

              for (const ogsChunk of chunkArray(ogsList, 80)) {
                let fbQuery = (supabase as any)
                  .from("equipment_diaries")
                  .select("date,equipment_fleet,ogs_number")
                  .eq("company_id", effectiveCompanyId)
                  .gte("date", minDate)
                  .lte("date", maxDate)
                  .in("ogs_number", ogsChunk)
                  .range(0, 4999);

                if (frotaSelecionada !== "todas") fbQuery = fbQuery.eq("equipment_fleet", frotaSelecionada);

                const { data: fbRows } = await fbQuery;
                (fbRows || []).forEach((ed: any) => {
                  const data = (ed?.date || "").trim();
                  const ogs = (ed?.ogs_number || "").trim();
                  const frota = (ed?.equipment_fleet || "").trim();
                  if (!data || !ogs || !frota) return;
                  if (!keyDataOgs.has(`${data}|${normTxt(ogs)}`)) return;
                  fleetDayKeys.add(`${data}|${normTxt(frota)}`);
                });
              }
            }
          }

          if (fleetDayKeys.size > 0) {
            const dateSet = new Set<string>();
            const fleetSet = new Set<string>();
            fleetDayKeys.forEach((k) => {
              const [d, f] = k.split("|");
              if (d) dateSet.add(d);
              if (f) fleetSet.add(f);
            });

            const dates = Array.from(dateSet).sort();
            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];
            const fleetNormSet = new Set(Array.from(fleetSet));

            let linkedQuery = (supabase as any)
              .from("equipment_diaries")
              .select("*")
              .neq("status", "rascunho")
              .eq("company_id", effectiveCompanyId)
              .gte("date", minDate)
              .lte("date", maxDate)
              .order("date", { ascending: false })
              .order("created_at", { ascending: false })
              .range(0, 4999);

            if (frotaSelecionada !== "todas") linkedQuery = linkedQuery.eq("equipment_fleet", frotaSelecionada);

            const { data: linkedBase } = await linkedQuery;
            (linkedBase || []).forEach((d: any) => {
              const key = `${d?.date || ""}|${normTxt(d?.equipment_fleet)}`;
              if (!fleetNormSet.has(normTxt(d?.equipment_fleet))) return;
              if (!fleetDayKeys.has(key)) return;
              linkedRows.push(d as Lancamento);
            });
          }
        }

        linkedRowsCacheRef.current.set(linkedCacheKey, { at: Date.now(), rows: linkedRows });
      }

      const merged = new Map<string, Lancamento>();
      ((ownResult?.data || []) as Lancamento[]).forEach((r) => {
        if (r?.id) merged.set(r.id, r);
      });
      linkedRows.forEach((r) => {
        if (r?.id && !merged.has(r.id)) merged.set(r.id, r);
      });

      rows = Array.from(merged.values()).sort((a: any, b: any) => {
        const dtA = `${a?.date || ""}|${a?.created_at || ""}`;
        const dtB = `${b?.date || ""}|${b?.created_at || ""}`;
        return dtB.localeCompare(dtA);
      });
    }
    stamp(`equipmentRows.loaded.${isAdmin ? "admin" : "user"}.linkedCache_${linkedCacheStatus}`);

    const { data: equipamentosRows } = await equipamentosPromise;
    if (isStale()) return;
    const equipamentosAtivos = (equipamentosRows || []) as EquipamentoCadastro[];
    stamp(`equipamentos.metadata.${equipamentosCacheValid ? "hit" : "miss"}`);

    const categoriaBySubtipoNorm = new Map<string, string>();
    categorias.forEach((cat) => {
      cat.tipos.forEach((t) => {
        categoriaBySubtipoNorm.set(normTxt(t.tipoValor), cat.key);
      });
    });

    const equipamentoByFrota = new Map<string, EquipamentoCadastro>();
    equipamentosAtivos.forEach((e) => {
      const key = normTxt(e.frota);
      if (key) equipamentoByFrota.set(key, e);
    });

    const resolveCategoriaByDiary = (fleet: string | null | undefined, tipoRaw: string | null | undefined) => {
      const eq = equipamentoByFrota.get(normTxt(fleet));
      const subtipo = eq?.tipo || tipoRaw || "";
      const catBySubtipo = categoriaBySubtipoNorm.get(normTxt(subtipo));
      if (catBySubtipo) return catBySubtipo;

      const tipoNormalizado = normalizarTipoEquipamento(tipoRaw);
      const catByLabel = categorias.find((c) => normTxt(c.label) === normTxt(tipoNormalizado));
      return catByLabel?.key || null;
    };

    const resolveSubtipoByDiary = (fleet: string | null | undefined, tipoRaw: string | null | undefined) => {
      const eq = equipamentoByFrota.get(normTxt(fleet));
      return eq?.tipo || tipoRaw || null;
    };

    const categoriaKeys = new Set(categorias.map((c) => c.key));
    const tipoEquipamentoAtivo =
      tipoEquipamento === "todos" || categoriaKeys.has(tipoEquipamento)
        ? tipoEquipamento
        : "todos";

    if (tipoEquipamentoAtivo !== tipoEquipamento) {
      setTipoEquipamento("todos");
    }

    const subtiposDaCategoriaAtiva =
      tipoEquipamentoAtivo === "todos"
        ? []
        : (categorias.find((cat) => cat.key === tipoEquipamentoAtivo)?.tipos || []).map((t) => t.tipoValor);

    const subtipoEquipamentoAtivo =
      subtipoEquipamento === "todos" ||
      subtiposDaCategoriaAtiva.some((s) => normTxt(s) === normTxt(subtipoEquipamento))
        ? subtipoEquipamento
        : "todos";

    if (subtipoEquipamentoAtivo !== subtipoEquipamento) {
      setSubtipoEquipamento("todos");
    }

    if (isStale()) return;
    const lancamentosEnriquecidos = ((rows || []) as Lancamento[]).map((r) => {
      const subtipo = resolveSubtipoByDiary(r.equipment_fleet, r.equipment_type);
      return {
        ...r,
        equipment_type: subtipo || normalizarTipoEquipamento(r.equipment_type),
      };
    });

    const lancamentosFiltrados = lancamentosEnriquecidos.filter((r) => {
      const categoriaKey = resolveCategoriaByDiary(r.equipment_fleet, r.equipment_type);
      const subtipo = resolveSubtipoByDiary(r.equipment_fleet, r.equipment_type);

      if (tipoEquipamentoAtivo !== "todos" && categoriaKey !== tipoEquipamentoAtivo) return false;
      if (subtipoEquipamentoAtivo !== "todos" && normTxt(subtipo) !== normTxt(subtipoEquipamentoAtivo)) return false;
      return true;
    });

    if (isStale()) return;
    setLancamentos(lancamentosFiltrados);
    stamp("equipamentos.filtered");

    // Buscar RDOs
    // Regra: usuário comum vê os próprios RDOs + RDOs em que ele é encarregado/responsável.
    // Admin/RDO view_all continua vendo todos da empresa.
    const buildRdoBaseQuery = () => {
      let q = (supabase as any)
        .from("rdo_diarios")
        .select("id,data,obra_nome,tipo_rdo,responsavel,encarregado,turno,clima,user_id,company_id,status_validacao,created_at,editado_em,editado_por_nome")
        .or("status_validacao.is.null,status_validacao.neq.rascunho")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);
      return q;
    };

    const enriquecerRdosComApontador = async (rows: any[]) => {
      if (!rows || rows.length === 0) return [];

      const userIds = Array.from(new Set(rows.map((r) => r?.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        return rows.map((r) => ({ ...r, apontador_nome: "-" }));
      }

      let profilesQuery = (supabase as any)
        .from("profiles")
        .select("user_id,nome_completo")
        .in("user_id", userIds);

      if (effectiveCompanyId) {
        profilesQuery = profilesQuery.eq("company_id", effectiveCompanyId);
      }

      const { data: profilesRows } = await profilesQuery;
      const nomeByUserId = new Map<string, string>(
        (profilesRows || []).map((p: any) => [p.user_id, (p.nome_completo || "").trim()]),
      );

      return rows.map((r) => ({
        ...r,
        apontador_nome: nomeByUserId.get(r.user_id) || "-",
      }));
    };

    if (shouldLoadRdos) {
      if ((isAdmin && companyId) || (permRdoViewAll && effectiveCompanyId)) {
        // RDO_Admin/Administrador com view_all: vê todos os RDOs da empresa
        const { data: rdoRows } = await buildRdoBaseQuery();
        const rdosComApontador = await enriquecerRdosComApontador(rdoRows || []);
        if (isStale()) return;
        setRdos(rdosComApontador);
      } else {
        const consultasRdo: Promise<any>[] = [buildRdoBaseQuery().eq("user_id", user.id)];

        nomesResponsavel.forEach((nome) => {
          consultasRdo.push(buildRdoBaseQuery().ilike("encarregado", nome));
          consultasRdo.push(buildRdoBaseQuery().ilike("responsavel", nome));
        });

        const resultadosRdo = await Promise.all(consultasRdo);
        const mergedById = new Map<string, any>();
        resultadosRdo.forEach((res) => {
          const linhas = res?.data || [];
          linhas.forEach((row: any) => {
            if (row?.id && !mergedById.has(row.id)) mergedById.set(row.id, row);
          });
        });

        const rdoRows = Array.from(mergedById.values()).sort((a: any, b: any) => {
          const dtA = `${a?.data || ""}|${a?.created_at || ""}`;
          const dtB = `${b?.data || ""}|${b?.created_at || ""}`;
          return dtB.localeCompare(dtA);
        });

        const rdosComApontador = await enriquecerRdosComApontador(rdoRows);
        if (isStale()) return;
        setRdos(rdosComApontador);
      }
      stamp("rdos.loaded");
    }

    // Buscar ocorrências somente quando aba ativa é ocorrências
    if (shouldLoadOcorrencias) {
      let ocorrQuery = (supabase as any)
        .from("equipamentos_ocorrencias")
        .select("id, frota, titulo, tipo, prioridade, status, created_at, resposta_manutencao, respondido_em, respondido_por")
        .order("created_at", { ascending: false });
      if (isAdmin && companyId) {
        ocorrQuery = ocorrQuery.eq("company_id", companyId);
      } else {
        ocorrQuery = ocorrQuery.eq("created_by", user.id);
      }
      const { data: ocorrRows } = await ocorrQuery;
      if (isStale()) return;
      setOcorrencias(ocorrRows || []);
      stamp("ocorrencias.loaded");
    }

    // Tipos/Subtipos devem refletir a estrutura atual cadastrada em equipamento_tipos,
    // independente de equipamentos ativos (evita sumir opções após reestruturação).
    const tiposDisponiveis = categorias.map((cat) => ({ value: cat.key, label: cat.label }));
    if (isStale()) return;
    setTipos(tiposDisponiveis.map((t) => t.value));

    const subtiposDaCategoria =
      tipoEquipamentoAtivo === "todos"
        ? []
        : (categorias.find((cat) => cat.key === tipoEquipamentoAtivo)?.tipos || [])
            .map((t) => t.tipoValor);
    if (isStale()) return;
    setSubtipos(subtiposDaCategoria);

    const frotasFiltradas = equipamentosAtivos
      .filter((e) => {
        if (tipoEquipamentoAtivo === "todos") return false;
        const cat = categorias.find((c) => c.key === tipoEquipamentoAtivo);
        if (!cat) return false;

        const pertenceCategoria = cat.tipos.some((t) => normTxt(t.tipoValor) === normTxt(e.tipo));
        if (!pertenceCategoria) return false;

        if (subtipoEquipamentoAtivo === "todos") return false;
        return normTxt(e.tipo) === normTxt(subtipoEquipamentoAtivo);
      })
      .map((e) => e.frota)
      .filter(Boolean) as string[];

    const frotasUnicas = Array.from(new Set(frotasFiltradas));
    if (isStale()) return;
    setFrotas(frotasUnicas.sort((a: string, b: string) => a.localeCompare(b, "pt-BR")));
    stamp("filtros.opcoes");
    setLoading(false);

      if (perfEnabled) {
        console.info("[WF PERF] MeusLancamentos.carregar", {
          runId: perfRunId,
          totalMs: Math.round((performance.now() - t0) * 100) / 100,
          aba,
          contextCacheHit,
          linkedCacheStatus,
          filtros: {
            tipoEquipamento,
            subtipoEquipamento,
            frotaSelecionada,
            dataInicio,
            dataFim,
          },
          steps: perfSteps,
        });
      }
    } catch (error) {
      if (isStale()) return;
      console.error("[WF] Erro ao carregar Meus Lançamentos", error);
      setLoading(false);
    }
  };

  // Hidrata filtros salvos por usuário logado (evita herdar filtro de outro usuário)
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;
        const key = buildFilterKey(userId);
        if (!ativo) return;

        setCurrentUserId(userId);
        setFiltroKey(key);
        const salvos = restaurarFiltros(key);
        setTipoEquipamento(salvos.tipoEquipamento || "todos");
        setSubtipoEquipamento(salvos.subtipoEquipamento || "todos");
        setFrotaSelecionada(salvos.frotaSelecionada || "todas");
        setDataInicio(salvos.dataInicio || "");
        setDataFim(salvos.dataFim || "");
      } finally {
        if (ativo) setFiltrosHidratados(true);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // Invalida respostas assíncronas pendentes quando componente desmonta
  useEffect(() => {
    return () => {
      loadRequestRef.current += 1;
    };
  }, []);

  // Rascunhos independem dos filtros (evita refetch pesado em cada troca de tipo/subtipo/frota/data)
  useEffect(() => {
    let ativo = true;

    if (!currentUserId) {
      setRascunhos([]);
      setRascunhosRdo([]);
      return () => {
        ativo = false;
      };
    }

    (async () => {
      const [rascunhosEqRes, rascunhosRdoRes] = await Promise.all([
        (supabase as any)
          .from("equipment_diaries")
          .select("*")
          .eq("status", "rascunho")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("rdo_diarios")
          .select("id,data,obra_nome,tipo_rdo,responsavel,turno,clima,user_id,status_validacao")
          .eq("status_validacao", "rascunho")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false }),
      ]);

      if (!ativo) return;

      setRascunhos(
        ((rascunhosEqRes.data || []) as Lancamento[]).map((r) => ({
          ...r,
          equipment_type: normalizarTipoEquipamento(r.equipment_type),
        })),
      );
      setRascunhosRdo(rascunhosRdoRes.data || []);
    })();

    return () => {
      ativo = false;
    };
  }, [currentUserId]);

  // Resetar subtipo e frota ao mudar tipo
  useEffect(() => {
    setSubtipoEquipamento("todos");
    setFrotaSelecionada("todas");
  }, [tipoEquipamento]);

  // Resetar frota ao mudar subtipo
  useEffect(() => {
    setFrotaSelecionada("todas");
  }, [subtipoEquipamento]);

  // Persiste filtros no sessionStorage sempre que mudam
  useEffect(() => {
    if (!filtrosHidratados) return;
    salvarFiltros(filtroKey, { tipoEquipamento, subtipoEquipamento, frotaSelecionada, dataInicio, dataFim });
  }, [filtroKey, filtrosHidratados, tipoEquipamento, subtipoEquipamento, frotaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (!filtrosHidratados) return;
    const timer = setTimeout(() => {
      carregar();
    }, 220);
    return () => clearTimeout(timer);
  }, [filtrosHidratados, aba, tipoEquipamento, subtipoEquipamento, frotaSelecionada, dataInicio, dataFim, categorias]);

  const resumo = useMemo(() => {
    return `${lancamentos.length} lançamento${lancamentos.length === 1 ? "" : "s"}`;
  }, [lancamentos]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="px-4 py-3 bg-header-gradient shadow-lg space-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <LogoHomeButton className="h-10 object-contain" />
          <div className="flex-1 min-w-0">
            <span className="block font-display font-extrabold text-sm text-primary-foreground truncate">
              {isAdmin ? "Lançamentos — Todos" : "Meus Lançamentos"}
            </span>
            <span className="block text-[11px] text-primary-foreground/80">{resumo}</span>
          </div>
        </div>
        <NavigationTrail trail={trail} onSelect={goTo} />
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Seção de Rascunhos — visível apenas para o próprio usuário quando há rascunhos pendentes */}
        {(rascunhos.length > 0 || rascunhosRdo.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">📝 Rascunhos não enviados</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                {rascunhos.length + rascunhosRdo.length}
              </span>
            </div>
            <div className="space-y-2">
              {rascunhos.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-800 truncate">
                      {r.equipment_fleet || "-"} • {r.equipment_type || "-"}
                    </p>
                    <p className="text-xs text-blue-600">{fmtDate(r.date)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEditarLancamento(r)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Continuar
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: r.id, tipo: "equipamento", label: `Rascunho ${r.equipment_fleet || "-"} • ${fmtDate(r.date)}` })}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {rascunhosRdo.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-800 truncate">
                      RDO • {r.obra_nome || "-"}
                    </p>
                    <p className="text-xs text-blue-600">{fmtDate(r.data)} {r.turno ? `• ${r.turno}` : ""}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/obras/rdo?edit=${r.id}&returnTo=${returnTo}`)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Continuar
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: r.id, tipo: "rdo", label: `Rascunho RDO ${r.obra_nome || "-"} • ${fmtDate(r.data)}` })}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-2">
          <button onClick={() => setAba("equipamentos")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              aba === "equipamentos" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
            }`}>
            🚜 Equipamentos ({lancamentos.length})
          </button>
          <button onClick={() => setAba("rdos")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              aba === "rdos" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
            }`}>
            🏗️ RDOs ({rdos.length})
          </button>
          <button onClick={() => setAba("ocorrencias")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              aba === "ocorrencias" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-muted-foreground border-border"
            }`}>
            ⚠️ Ocorr. ({ocorrencias.length})
          </button>
        </div>

        {/* Filtros de Equipamentos */}
        {aba === "equipamentos" && <div className="rdo-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Equipamento</span>
              <Select value={tipoEquipamento} onValueChange={setTipoEquipamento}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tipos.map((tipoKey) => {
                    const cat = categorias.find((c) => c.key === tipoKey);
                    return (
                      <SelectItem key={tipoKey} value={tipoKey}>{cat?.label || tipoKey}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Subtipo</span>
              <Select
                value={subtipoEquipamento}
                onValueChange={setSubtipoEquipamento}
                disabled={tipoEquipamento === "todos" || subtipos.length === 0}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {subtipos.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Frota</span>
              <Select
                value={frotaSelecionada}
                onValueChange={setFrotaSelecionada}
                disabled={subtipoEquipamento === "todos" || frotas.length === 0}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {frotas.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Início</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Fim</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleLimparFiltros}>
              Limpar filtros
            </Button>
          </div>
        </div>}

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : aba === "rdos" ? (
          /* Lista de RDOs */
          rdos.length === 0 ? (
            <div className="rdo-card py-10 text-center text-muted-foreground text-sm">Nenhum RDO encontrado.</div>
          ) : (
            <div className="space-y-3">
              {rdos.map((rdo: any) => {
                const fmtRdoDate = rdo.data ? (() => { const [y,m,d] = rdo.data.split('-'); return `${d}/${m}/${y}`; })() : '-';
                return (
                  <div key={rdo.id} className="rdo-card hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <button className="flex-1 text-left space-y-1"
                        onClick={() => navigate(`/visualizar-rdo/${rdo.id}?returnTo=${returnTo}`)}>
                        <p className="text-sm font-display font-bold text-primary">OGS {rdo.obra_nome} • {fmtRdoDate}</p>
                        <p className="text-xs text-muted-foreground">Tipo: {rdo.tipo_rdo || '-'} • Responsável: {rdo.responsavel || '-'}</p>
                        <p className="text-xs text-muted-foreground">Apontador: {rdo.apontador_nome || '-'}</p>
                        {rdo.editado_em && (
                          <p className="text-[11px] text-amber-700 font-medium">
                            ✏️ Editado por {rdo.editado_por_nome || "usuário interno"} em {fmtDateTime(rdo.editado_em)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Turno: {rdo.turno || '-'} • Clima: {rdo.clima || '-'}</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">RDO</span>
                        <button
                          onClick={() => navigate(`/obras/rdo?edit=${rdo.id}&returnTo=${returnTo}`)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: rdo.id, tipo: 'rdo', label: `OGS ${rdo.obra_nome} • ${fmtRdoDate}` })}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : aba === "ocorrencias" ? (
          /* Lista de Ocorrências */
          ocorrencias.length === 0 ? (
            <div className="rdo-card py-10 text-center text-muted-foreground text-sm">Nenhuma ocorrência registrada.</div>
          ) : (
            <div className="space-y-3">
              {ocorrencias.map((oc: any) => {
                const statusColor: Record<string, string> = {
                  ABERTA: "bg-orange-100 text-orange-700",
                  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
                  CONCLUIDA: "bg-green-100 text-green-700",
                  CANCELADA: "bg-gray-100 text-gray-500",
                };
                const statusLabel: Record<string, string> = {
                  ABERTA: "Aberta",
                  EM_ANDAMENTO: "Em andamento",
                  CONCLUIDA: "Concluída",
                  CANCELADA: "Cancelada",
                };
                const prioColor: Record<string, string> = {
                  BAIXA: "bg-green-100 text-green-700",
                  NORMAL: "bg-blue-100 text-blue-700",
                  ALTA: "bg-orange-100 text-orange-700",
                  URGENTE: "bg-red-100 text-red-700",
                };
                const dt = new Date(oc.created_at);
                const fmtDt = dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={oc.id} className="rdo-card hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/manutencao/ocorrencia/${oc.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-display font-bold text-primary">{oc.frota} — {oc.titulo}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor[oc.status] || "bg-gray-100 text-gray-500"}`}>
                            {statusLabel[oc.status] || oc.status}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${prioColor[oc.prioridade] || ""}`}>
                            {oc.prioridade}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{oc.tipo} • {fmtDt}</p>
                        {oc.resposta_manutencao && (
                          <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <p className="text-[11px] text-green-700 font-semibold mb-0.5">✅ Resposta da Manutenção{oc.respondido_por ? ` (${oc.respondido_por})` : ""}</p>
                            <p className="text-xs text-green-800">{oc.resposta_manutencao}</p>
                          </div>
                        )}
                        {!oc.resposta_manutencao && oc.status === "ABERTA" && (
                          <p className="text-[11px] text-orange-600">Aguardando retorno da manutenção...</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : lancamentos.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum lançamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-3">
            {lancamentos.map((item) => (
              <div key={item.id} className="rdo-card hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 text-left" onClick={() => abrirDetalhe(item)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-display font-bold text-primary">
                          {item.equipment_fleet || "-"} • {item.equipment_type || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {fmtDate(item.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-muted-foreground">Status</p>
                        <p className="text-xs">{item.work_status || "-"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                      <div><p className="text-muted-foreground">Frota</p><p className="font-semibold">{item.equipment_fleet || "-"}</p></div>
                      <div><p className="text-muted-foreground">Tipo</p><p className="font-semibold">{item.equipment_type || "-"}</p></div>
                      <div><p className="text-muted-foreground">Status</p><p className="font-semibold">{item.work_status || "-"}</p></div>
                      <div><p className="text-muted-foreground">Turno</p><p className="font-semibold">{item.period || "-"}</p></div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0 pt-1">
                    <button
                      onClick={() => handleEditarLancamento(item)}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: item.id, tipo: 'equipamento', label: `${item.equipment_fleet || '-'} • ${fmtDate(item.date)}` })}
                      className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!selecionado}
        onOpenChange={(open) => {
          if (!open) {
            setSelecionado(null);
            setEditandoId(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do Lançamento</DialogTitle>
          </DialogHeader>

          {selecionado && (
            <div className="space-y-4 text-sm overflow-y-auto max-h-[75vh] pr-1">
              {/* Cabeçalho compacto igual ao RelatorioEquipamento */}
              <div className="space-y-1 border-b border-border pb-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <p><span className="text-muted-foreground">Frota:</span> <strong>{selecionado.equipment_fleet || "-"}</strong></p>
                  <p><span className="text-muted-foreground">Tipo:</span> <strong>{selecionado.equipment_type || "-"}</strong></p>
                  <p><span className="text-muted-foreground">Data:</span> <strong>{fmtDate(selecionado.date)}</strong></p>
                  <p><span className="text-muted-foreground">Turno:</span> <strong>{selecionado.period || "-"}</strong></p>
                  <p><span className="text-muted-foreground">Operador:</span> <strong>{selecionado.operator_name || "-"}</strong></p>
                  {selecionado.operator_solo && <p><span className="text-muted-foreground">Auxiliar/Solo:</span> <strong>{selecionado.operator_solo}</strong></p>}
                  <p><span className="text-muted-foreground">OGS:</span> <strong>{selecionado.ogs_number || "-"}</strong></p>
                  <p><span className="text-muted-foreground">Cliente:</span> <strong>{selecionado.client_name || "-"}</strong></p>
                  {selecionado.location_address && <p><span className="text-muted-foreground">Local:</span> <strong>{selecionado.location_address}</strong></p>}
                  {['Caminhões','Comboio','Carreta','Veículo'].includes(selecionado.equipment_type || '') ? (
                    <p><span className="text-muted-foreground">Odômetro:</span> <strong>{selecionado.odometer_initial ?? "-"} → {selecionado.odometer_final ?? "-"}</strong></p>
                  ) : (
                    <p><span className="text-muted-foreground">Horímetro:</span> <strong>{selecionado.meter_initial ?? "-"} → {selecionado.meter_final ?? "-"}</strong></p>
                  )}
                  <p><span className="text-muted-foreground">Status:</span> <strong>{selecionado.work_status || "-"}</strong></p>
                </div>
                <p className="text-sm pt-1"><span className="text-muted-foreground">Observações:</span> <strong>{selecionado.observations || "-"}</strong></p>
              </div>

              {detalheExtra.kmaOperation && (
                <div className="space-y-2 border-b border-border pb-3">
                  <p className="text-xs font-semibold">Operação KMA</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <p><span className="text-muted-foreground">Tipo de Operação:</span> <strong>{detalheExtra.kmaOperation.operation_type || "-"}</strong></p>
                    <p><span className="text-muted-foreground">Volume Total Usinado (ton):</span> <strong>{detalheExtra.kmaOperation.total_volume_machined_ton ?? "-"}</strong></p>
                    <p><span className="text-muted-foreground">CAP Tipo:</span> <strong>{detalheExtra.kmaOperation.cap_type || "-"}</strong></p>
                    <p><span className="text-muted-foreground">CAP Fornecedor:</span> <strong>{detalheExtra.kmaOperation.cap_supplier || "-"}</strong></p>
                    <p><span className="text-muted-foreground">CAP Qtd (ton):</span> <strong>{detalheExtra.kmaOperation.cap_qty_ton ?? "-"}</strong></p>
                    <p><span className="text-muted-foreground">CAP Nº NF:</span> <strong>{detalheExtra.kmaOperation.cap_nf_number || "-"}</strong></p>
                    <p><span className="text-muted-foreground">Filer Tipo:</span> <strong>{detalheExtra.kmaOperation.filer_type || "-"}</strong></p>
                    <p><span className="text-muted-foreground">Filer Fornecedor:</span> <strong>{detalheExtra.kmaOperation.filer_supplier || "-"}</strong></p>
                    <p><span className="text-muted-foreground">Filer Qtd (ton):</span> <strong>{detalheExtra.kmaOperation.filer_qty_ton ?? "-"}</strong></p>
                    <p><span className="text-muted-foreground">Fornecedor Agregados:</span> <strong>{detalheExtra.kmaOperation.aggregates_supplier || "-"}</strong></p>
                    <p><span className="text-muted-foreground">Silo 1:</span> <strong>{detalheExtra.kmaOperation.silo1_material || "-"} {detalheExtra.kmaOperation.silo1_qty != null ? `(${detalheExtra.kmaOperation.silo1_qty} ton)` : ""}</strong></p>
                    <p><span className="text-muted-foreground">Silo 2:</span> <strong>{detalheExtra.kmaOperation.silo2_material || "-"} {detalheExtra.kmaOperation.silo2_qty != null ? `(${detalheExtra.kmaOperation.silo2_qty} ton)` : ""}</strong></p>
                    <p><span className="text-muted-foreground">Água (L):</span> <strong>{detalheExtra.kmaOperation.water_liters ?? "-"}</strong></p>
                    <p><span className="text-muted-foreground">Água Fornecedor:</span> <strong>{detalheExtra.kmaOperation.water_supplier || "-"}</strong></p>
                  </div>
                </div>
              )}

              {/* Apontamento de Horas */}
              {detalheExtra.times.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Apontamento de Horas</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-1 pr-2">Início</th>
                          <th className="text-left py-1 pr-2">Término</th>
                          <th className="text-left py-1 pr-2">Atividade</th>
                          <th className="text-left py-1 pr-2">Descrição</th>
                          <th className="text-left py-1 pr-2">Origem</th>
                          <th className="text-left py-1">Destino</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalheExtra.times.map((t: any) => (
                          <tr key={t.id} className="border-b border-border/30">
                            <td className="py-1 pr-2">{t.start_time || "-"}</td>
                            <td className="py-1 pr-2">{t.end_time || "-"}</td>
                            <td className="py-1 pr-2">{t.activity || "-"}</td>
                            <td className="py-1 pr-2">{t.description || "-"}</td>
                            <td className="py-1 pr-2">{t.origin || "-"}</td>
                            <td className="py-1">{t.destination || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Produção / Fresagem — só para Fresadora */}
              {selecionado.equipment_type === "Fresadora" && detalheExtra.areas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Produção / Fresagem</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-1 pr-2">#</th>
                          <th className="text-right py-1 pr-2">Comp. (m)</th>
                          <th className="text-right py-1 pr-2">Larg. (m)</th>
                          <th className="text-right py-1 pr-2">Esp. (cm)</th>
                          <th className="text-right py-1 pr-2">Área (m²)</th>
                          <th className="text-right py-1">Vol. (m³)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalheExtra.areas.map((a: any, i: number) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-1 pr-2">{i + 1}</td>
                            <td className="py-1 pr-2 text-right">{Number(a.length_m).toFixed(2)}</td>
                            <td className="py-1 pr-2 text-right">{Number(a.width_m).toFixed(2)}</td>
                            <td className="py-1 pr-2 text-right">{Number(a.thickness_cm).toFixed(2)}</td>
                            <td className="py-1 pr-2 text-right">{Number(a.m2).toFixed(2)}</td>
                            <td className="py-1 text-right">{Number(a.m3).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-semibold">
                          <td colSpan={4} className="py-1 pr-2">Totais</td>
                          <td className="py-1 pr-2 text-right">{detalheExtra.areas.reduce((s: number, a: any) => s + (Number(a.m2) || 0), 0).toFixed(2)}</td>
                          <td className="py-1 text-right">{detalheExtra.areas.reduce((s: number, a: any) => s + (Number(a.m3) || 0), 0).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Bits — só para Fresadora */}
              {selecionado.equipment_type === "Fresadora" && (
              <div className="space-y-1">
                <p className="text-xs font-semibold">Bits Lançados</p>
                {detalheExtra.bits.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhum bit registrado.</p>
                  : detalheExtra.bits.map((b: any, i: number) => (
                    <p key={i} className="text-xs">{b.quantity}x {b.brand} — {b.status}{b.horimeter ? ` — Horímetro ${b.horimeter}` : ""}</p>
                  ))
                }
              </div>
              )}

              {/* Abastecimento */}
              <div className="space-y-1">
                <p className="text-xs font-semibold">Abastecimento</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p><span className="text-muted-foreground">Tipo:</span> {selecionado.fuel_type || "-"}</p>
                  <p><span className="text-muted-foreground">Litros:</span> {selecionado.fuel_liters ?? "-"}</p>
                  <p><span className="text-muted-foreground">Horímetro:</span> {selecionado.fuel_meter ?? "-"}</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => handleEditarLancamento(selecionado)}
                disabled={editandoId === selecionado.id}
              >
                {editandoId === selecionado.id && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
                Editar Lançamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmáção de Exclusão */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open && !deletando) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Excluir lançamento?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong>{confirmDelete?.label}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)} disabled={deletando}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1 gap-2" onClick={handleDeletar} disabled={deletando}>
                {deletando && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}

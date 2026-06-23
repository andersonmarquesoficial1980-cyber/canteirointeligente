import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import logoCi from "@/assets/logo-workflux.png";

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

interface Lancamento {
  id: string;
  created_at: string | null;
  date: string | null;
  equipment_fleet: string | null;
  equipment_type: string | null;
  work_status: string | null;
  period: string | null;
  operator_name: string | null;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  observations: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  fuel_liters: number | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

const FILTER_KEY = "meusLancamentos_filtros";

function salvarFiltros(filtros: Record<string, string>) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(filtros)); } catch {}
}

function restaurarFiltros(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function MeusLancamentos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aba, setAba] = useState<"equipamentos" | "rdos" | "ocorrencias">("equipamentos");
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [rdos, setRdos] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; tipo: "equipamento" | "rdo"; label: string } | null>(null);
  const [deletando, setDeletando] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [frotas, setFrotas] = useState<string[]>([]);

  // Inicializa filtros a partir do sessionStorage (preserva após edição)
  const filtrosSalvos = restaurarFiltros();
  const [tipoEquipamento, setTipoEquipamento] = useState(filtrosSalvos.tipoEquipamento || "todos");
  const [frotaSelecionada, setFrotaSelecionada] = useState(filtrosSalvos.frotaSelecionada || "todas");
  const [dataInicio, setDataInicio] = useState(filtrosSalvos.dataInicio || "");
  const [dataFim, setDataFim] = useState(filtrosSalvos.dataFim || "");
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [detalheExtra, setDetalheExtra] = useState<{ areas: any[]; bits: any[]; times: any[]; horas: number | null }>({ areas: [], bits: [], times: [], horas: null });

  const abrirDetalhe = async (item: Lancamento) => {
    setSelecionado(item);
    setEditandoId(null);
    setDetalheExtra({ areas: [], bits: [], times: [], horas: null });
    const [{ data: areas }, { data: bits }, { data: times }] = await Promise.all([
      supabase.from('equipment_production_areas').select('*').eq('diary_id', item.id),
      supabase.from('bit_entries').select('*').eq('diary_id', item.id),
      supabase.from('equipment_time_entries').select('*').eq('diary_id', item.id),
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
    setDetalheExtra({ areas: areas || [], bits: bits || [], times: sortedTimes, horas: horasTotal > 0 ? Math.round(horasTotal * 10) / 10 : null });
  };

  const handleDeletar = async () => {
    if (!confirmDelete) return;
    setDeletando(true);
    try {
      if (confirmDelete.tipo === "equipamento") {
        await (supabase as any).from("equipment_diaries").delete().eq("id", confirmDelete.id);
        setLancamentos(prev => prev.filter(l => l.id !== confirmDelete.id));
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
      }
    } finally {
      setDeletando(false);
      setConfirmDelete(null);
    }
  };

  const handleEditarLancamento = async (item: Lancamento) => {
    // Salva filtros ativos antes de sair para edição
    salvarFiltros({ tipoEquipamento, frotaSelecionada, dataInicio, dataFim });
    setEditandoId(item.id);
    await new Promise((resolve) => setTimeout(resolve, 200));
    navigate(
      `/equipamentos/diario?edit=${item.id}&tipo=${encodeURIComponent(
        item.equipment_type || "",
      )}&frota=${encodeURIComponent(item.equipment_fleet || "")}`,
    );
  };

  const carregar = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setLancamentos([]);
      setTipos([]);
      setLoading(false);
      return;
    }

    // Verificar perfil do usuário — admin vê todos os lançamentos da empresa
    const { data: profileData } = await supabase
      .from("profiles")
      .select("perfil, role, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdminUser = (profileData as any)?.perfil === "Administrador" || (profileData as any)?.role === "superadmin";
    const companyId = (profileData as any)?.company_id;
    setIsAdmin(isAdminUser);
    const isAdmin = isAdminUser;

    let query = (supabase as any)
      .from("equipment_diaries")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    // Operador: filtra pelos próprios lançamentos
    // Admin: filtra por empresa
    if (isAdmin && companyId) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("user_id", user.id);
    }

    if (tipoEquipamento !== "todos") {
      query = query.eq("equipment_type", tipoEquipamento);
    }
    if (frotaSelecionada !== "todas") {
      query = query.eq("equipment_fleet", frotaSelecionada);
    }
    if (dataInicio) {
      query = query.gte("date", dataInicio);
    }
    if (dataFim) {
      query = query.lte("date", dataFim);
    }

    const [{ data: rows }, { data: tiposRows }, { data: frotasRows }] = await Promise.all([
      query,
      isAdmin && companyId
        ? (supabase as any).from("equipment_diaries").select("equipment_type").eq("company_id", companyId).not("equipment_type", "is", null)
        : (supabase as any).from("equipment_diaries").select("equipment_type").eq("user_id", user.id).not("equipment_type", "is", null),
      isAdmin && companyId
        ? (supabase as any).from("equipment_diaries").select("equipment_fleet, equipment_type").eq("company_id", companyId).not("equipment_fleet", "is", null)
        : (supabase as any).from("equipment_diaries").select("equipment_fleet, equipment_type").eq("user_id", user.id).not("equipment_fleet", "is", null),
    ]);

    setLancamentos((rows || []) as Lancamento[]);

    // Buscar RDOs
    let rdoQuery = (supabase as any)
      .from("rdo_diarios")
      .select("id,data,obra_nome,tipo_rdo,responsavel,turno,clima,user_id")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });
    if (isAdmin && companyId) {
      // admin vê todos da empresa — rdo_diarios não tem company_id, filtra por user_ids da empresa
      // fallback: busca todos (RLS cuida do escopo)
    } else {
      rdoQuery = rdoQuery.eq("user_id", user.id);
    }
    if (dataInicio) rdoQuery = rdoQuery.gte("data", dataInicio);
    if (dataFim) rdoQuery = rdoQuery.lte("data", dataFim);
    const { data: rdoRows } = await rdoQuery;
    setRdos(rdoRows || []);

    // Buscar ocorrências do próprio usuário
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
    setOcorrencias(ocorrRows || []);

    const tiposUnicos = Array.from(
      new Set(((tiposRows || []) as any[]).map((r) => r.equipment_type).filter(Boolean)),
    ) as string[];
    setTipos(tiposUnicos.sort((a, b) => a.localeCompare(b)));

    // Frotas filtradas pelo tipo selecionado
    const frotasFiltradas = ((frotasRows || []) as any[])
      .filter((r) => tipoEquipamento === "todos" || r.equipment_type === tipoEquipamento)
      .map((r) => r.equipment_fleet)
      .filter(Boolean);
    const frotasUnicas = Array.from(new Set(frotasFiltradas)) as string[];
    setFrotas(frotasUnicas.sort((a: string, b: string) => a.localeCompare(b)));
    setLoading(false);
  };

  // Resetar frota ao mudar tipo
  useEffect(() => {
    setFrotaSelecionada("todas");
  }, [tipoEquipamento]);

  // Persiste filtros no sessionStorage sempre que mudam
  useEffect(() => {
    salvarFiltros({ tipoEquipamento, frotaSelecionada, dataInicio, dataFim });
  }, [tipoEquipamento, frotaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    carregar();
  }, [tipoEquipamento, frotaSelecionada, dataInicio, dataFim]);

  const resumo = useMemo(() => {
    return `${lancamentos.length} lançamento${lancamentos.length === 1 ? "" : "s"}`;
  }, [lancamentos]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            {isAdmin ? "Lançamentos — Todos" : "Meus Lançamentos"}
          </span>
          <span className="block text-[11px] text-primary-foreground/80">{resumo}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
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
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Frota</span>
              <Select
                value={frotaSelecionada}
                onValueChange={setFrotaSelecionada}
                disabled={frotas.length === 0}
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
                        onClick={() => navigate(`/visualizar-rdo/${rdo.id}`)}>
                        <p className="text-sm font-display font-bold text-primary">OGS {rdo.obra_nome} • {fmtRdoDate}</p>
                        <p className="text-xs text-muted-foreground">Tipo: {rdo.tipo_rdo || '-'} • Responsável: {rdo.responsavel || '-'}</p>
                        <p className="text-xs text-muted-foreground">Turno: {rdo.turno || '-'} • Clima: {rdo.clima || '-'}</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">RDO</span>
                        <button
                          onClick={() => navigate(`/obras/rdo?edit=${rdo.id}`)}
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

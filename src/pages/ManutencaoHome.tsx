import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Wrench, ChevronRight, AlertTriangle, Clock, CheckCircle, Loader2, Tv, HardHat, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import NovaOSModal from "@/components/manutencao/NovaOSModal";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";

interface OS {
  id: string;
  numero_os: number;
  equipment_fleet: string;
  equipment_type: string;
  tipo: string;
  prioridade: string;
  status: string;
  titulo: string;
  descricao: string;
  solicitante_nome: string;
  mecanico_nome: string;
  data_abertura: string;
  data_prevista: string;
}

interface ProgPendente {
  id: string;
  data: string;
  equipe: string;
  responsavel: string | null;
  ogs: string | null;
  cliente: string | null;
  local: string | null;
  periodo: string;
  tipo_servico: string | null;
  equipamentos_designados: string[] | null;
  engenheiro_responsavel: string | null;
  obs: string | null;
  confirmado_manutencao: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  aberta:           { label: "Aberta",           color: "bg-red-50 text-red-700 border-red-200",     icon: AlertTriangle },
  em_andamento:     { label: "Em Andamento",      color: "bg-blue-50 text-blue-700 border-blue-200",   icon: Wrench },
  aguardando_peca:  { label: "Aguard. Peça",      color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  concluida:        { label: "Concluída",          color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle },
  cancelada:        { label: "Cancelada",          color: "bg-gray-50 text-gray-500 border-gray-200",  icon: Clock },
};

const PRIORIDADE_COLOR: Record<string, string> = {
  baixa:   "bg-gray-100 text-gray-600",
  normal:  "bg-blue-100 text-blue-700",
  alta:    "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ManutencaoHome() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [osList, setOsList] = useState<OS[]>([]);
  const [progsPendentes, setProgsPendentes] = useState<ProgPendente[]>([]);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [modalNovaOS, setModalNovaOS] = useState(false);

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const [{ data: os }, { data: progs }] = await Promise.all([
      supabase.from("manutencao_os").select("*").order("created_at", { ascending: false }),
      // Programações de hoje e amanhã aguardando confirmação da manutenção
      (supabase as any)
        .from("ci_programacoes")
        .select("id,data,equipe,responsavel,ogs,cliente,local,periodo,tipo_servico,equipamentos_designados,engenheiro_responsavel,obs,confirmado_manutencao")
        .in("data", [hoje, amanha])
        .eq("status_programacao", "AGUARDANDO_MANUTENCAO")
        .eq("confirmado_manutencao", false)
        .order("data")
        .order("equipe"),
    ]);

    if (os) setOsList(os);
    if (progs) setProgsPendentes(progs);
    setLoading(false);
  }

  const osFiltradas = filtroStatus === "todas"
    ? osList.filter(o => o.status !== "concluida" && o.status !== "cancelada")
    : filtroStatus === "historico"
    ? osList.filter(o => o.status === "concluida" || o.status === "cancelada")
    : osList.filter(o => o.status === filtroStatus);

  const counts = {
    aberta: osList.filter(o => o.status === "aberta").length,
    em_andamento: osList.filter(o => o.status === "em_andamento").length,
    aguardando_peca: osList.filter(o => o.status === "aguardando_peca").length,
  };

  async function confirmarProgramacao(id: string, confirmar: boolean) {
    setConfirmandoId(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("nome_completo").eq("user_id", user?.id).single();
    const nome = (prof as any)?.nome_completo || user?.email || "Manutenção";

    await (supabase as any).from("ci_programacoes").update({
      confirmado_manutencao: confirmar,
      confirmado_por: confirmar ? nome : null,
      confirmado_em: confirmar ? new Date().toISOString() : null,
      status_programacao: confirmar ? "CONFIRMADO" : "AGUARDANDO_MANUTENCAO",
      obs_manutencao: confirmar ? null : "Bloqueado pela Manutenção",
    }).eq("id", id);

    setConfirmandoId(null);
    buscarDados();
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">WF Manutenção</span>
          <span className="block text-[11px] text-primary-foreground/80">Ordens de Serviço</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/manutencao/ocorrencias")} className="bg-white/10 hover:bg-white/20 text-white border-white/30 gap-1">
          <AlertTriangle className="w-4 h-4" /> Ocorrências
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/manutencao/fila")} className="bg-white/10 hover:bg-white/20 text-white border-white/30 gap-1">
          <Tv className="w-4 h-4" /> Fila de Manutenção
        </Button>
        <Button size="sm" onClick={() => setModalNovaOS(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          <Plus className="w-4 h-4" /> Nova OS
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* ── PROGRAMAÇÕES PENDENTES (aparece sempre que houver) ── */}
        {progsPendentes.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HardHat className="w-4 h-4 text-amber-500" />
              Programações Aguardando Confirmação
              <span className="text-xs bg-amber-100 text-amber-700 font-bold rounded-full px-2 py-0.5">{progsPendentes.length}</span>
            </h2>
            {progsPendentes.map(prog => {
              const equips = prog.equipamentos_designados || [];
              const dataLabel = prog.data === new Date().toISOString().split("T")[0] ? "HOJE" : "AMANHÃ";
              const isConfirmando = confirmandoId === prog.id;
              return (
                <div key={prog.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 rounded px-1.5">{dataLabel}</span>
                        {prog.tipo_servico && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5">{prog.tipo_servico}</span>}
                      </div>
                      <p className="text-sm font-bold text-foreground mt-1">{prog.equipe}</p>
                      {prog.responsavel && <p className="text-xs text-muted-foreground">Enc: {prog.responsavel}</p>}
                    </div>
                    <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
                  </div>

                  <div className="space-y-1">
                    {prog.ogs && (
                      <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">OGS</span><span className="text-xs font-semibold">{prog.ogs} · {prog.cliente}</span></div>
                    )}
                    {prog.local && (
                      <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">Local</span><span className="text-xs">{prog.local}</span></div>
                    )}
                    <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">Período</span><span className="text-xs font-medium">{prog.periodo}</span></div>
                    {prog.engenheiro_responsavel && (
                      <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">Eng.</span><span className="text-xs">{prog.engenheiro_responsavel}</span></div>
                    )}
                  </div>

                  {equips.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Equipamentos solicitados</p>
                      <div className="flex flex-wrap gap-1">
                        {equips.map(f => (
                          <span key={f} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-0.5">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {prog.obs && <p className="text-xs text-muted-foreground italic">{prog.obs}</p>}

                  {/* Ações da Manutenção */}
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                      onClick={() => confirmarProgramacao(prog.id, true)}
                      disabled={isConfirmando}
                    >
                      {isConfirmando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Confirmar equipamentos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 border-red-300 text-red-600 text-xs font-bold"
                      onClick={() => confirmarProgramacao(prog.id, false)}
                      disabled={isConfirmando}
                    >
                      {isConfirmando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Reportar problema
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo rápido */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Abertas", value: counts.aberta, color: "text-red-700 bg-red-50 border-red-200" },
            { label: "Em Andamento", value: counts.em_andamento, color: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "Aguard. Peça", value: counts.aguardando_peca, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border p-2 text-center ${item.color}`}>
              <p className="text-xl font-display font-bold">{item.value}</p>
              <p className="text-[10px] font-medium leading-tight">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "todas", label: "Ativas" },
            { key: "aberta", label: "Abertas" },
            { key: "em_andamento", label: "Em Andamento" },
            { key: "aguardando_peca", label: "Aguard. Peça" },
            { key: "historico", label: "Histórico" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltroStatus(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filtroStatus === f.key ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : osFiltradas.length === 0 ? (
          <div className="text-center py-10">
            <Wrench className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma OS encontrada</p>
            <Button onClick={() => setModalNovaOS(true)} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Abrir OS</Button>
          </div>
        ) : (
          osFiltradas.map(os => {
            const cfg = STATUS_CONFIG[os.status] || STATUS_CONFIG.aberta;
            const Icon = cfg.icon;
            return (
              <button
                key={os.id}
                onClick={() => navigate(`/manutencao/os/${os.id}`)}
                className="w-full text-left rdo-card hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground">OS #{os.numero_os}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORIDADE_COLOR[os.prioridade] || PRIORIDADE_COLOR.normal}`}>
                        {os.prioridade}
                      </span>
                    </div>
                    <p className="font-display font-bold text-sm">{os.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{os.equipment_fleet} — {os.equipment_type}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {os.mecanico_nome && <span>🔧 {os.mecanico_nome}</span>}
                      <span>📅 {fmtDate(os.data_abertura)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>

      <NovaOSModal open={modalNovaOS} onClose={() => setModalNovaOS(false)} onSaved={buscarDados} />
    </div>
  );
}

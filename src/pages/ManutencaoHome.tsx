import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Wrench, FileText, Fuel, ChevronRight, AlertTriangle, Clock, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import NovaOSModal from "@/components/manutencao/NovaOSModal";

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

interface DocVencendo {
  equipment_fleet: string;
  tipo_documento: string;
  data_vencimento: string;
  dias_restantes: number;
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
  const [aba, setAba] = useState<"os" | "docs">("os");
  const [osList, setOsList] = useState<OS[]>([]);
  const [docsVencendo, setDocsVencendo] = useState<DocVencendo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [modalNovaOS, setModalNovaOS] = useState(false);

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const [{ data: os }, { data: docs }] = await Promise.all([
      supabase.from("manutencao_os").select("*").order("created_at", { ascending: false }),
      supabase.from("manutencao_documentos").select("*").not("data_vencimento", "is", null),
    ]);
    if (os) setOsList(os);
    if (docs) {
      const hoje = new Date();
      const vencendo = docs
        .map(d => ({
          ...d,
          dias_restantes: Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .filter(d => d.dias_restantes <= 30)
        .sort((a, b) => a.dias_restantes - b.dias_restantes);
      setDocsVencendo(vencendo);
    }
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

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">WF Manutenção</span>
          <span className="block text-[11px] text-primary-foreground/80">Ordens de Serviço & Documentos</span>
        </div>
        <Button size="sm" onClick={() => setModalNovaOS(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          <Plus className="w-4 h-4" /> Nova OS
        </Button>
      </header>

      {/* Abas */}
      <div className="flex border-b border-border bg-white">
        <button onClick={() => setAba("os")} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "os" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <Wrench className="w-4 h-4" /> Ordens de Serviço
          {counts.aberta + counts.em_andamento + counts.aguardando_peca > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {counts.aberta + counts.em_andamento + counts.aguardando_peca}
            </span>
          )}
        </button>
        <button onClick={() => setAba("docs")} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "docs" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
          <FileText className="w-4 h-4" /> Documentos
          {docsVencendo.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {docsVencendo.length}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Resumo rápido */}
        {aba === "os" && (
          <>
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
          </>
        )}

        {/* Documentos */}
        {aba === "docs" && (
          <>
            {docsVencendo.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <p className="text-sm font-bold text-orange-700 mb-2">⚠️ {docsVencendo.length} documento{docsVencendo.length !== 1 ? "s" : ""} vencendo em breve</p>
                {docsVencendo.slice(0, 3).map((d, i) => (
                  <p key={i} className="text-xs text-orange-600">
                    {d.equipment_fleet} — {d.tipo_documento}: {d.dias_restantes <= 0 ? "⛔ VENCIDO" : `${d.dias_restantes} dias`}
                  </p>
                ))}
              </div>
            )}

            {isAdmin && (
              <Button onClick={() => navigate("/manutencao/documentos/novo")} className="w-full h-11 gap-2 rounded-xl font-display font-bold">
                <Plus className="w-4 h-4" /> Adicionar Documento
              </Button>
            )}

            <Button onClick={() => navigate("/manutencao/documentos")} variant="outline" className="w-full h-11 gap-2 rounded-xl font-semibold">
              <FileText className="w-4 h-4" /> Ver Todos os Documentos
            </Button>

            <Button onClick={() => navigate("/manutencao/consumo")} variant="outline" className="w-full h-11 gap-2 rounded-xl font-semibold">
              <Fuel className="w-4 h-4" /> Consumo de Diesel
            </Button>
          </>
        )}
      </div>

      <NovaOSModal open={modalNovaOS} onClose={() => setModalNovaOS(false)} onSaved={buscarDados} />
    </div>
  );
}

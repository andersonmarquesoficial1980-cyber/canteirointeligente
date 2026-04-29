import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Plus, RefreshCw, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemandas, type Demanda } from "@/hooks/useDemandas";
import NovaDemandaModal from "@/components/demandas/NovaDemandaModal";
import logoCi from "@/assets/logo-workflux.png";
import { getSetorLabel, getStatusLabel, getTipoMeta, getUrgenciaMeta, SETORES_DESTINATARIOS, URGENCIAS } from "@/lib/demandas";

type SetorFiltro = "todos" | "manutencao" | "programador" | "rh" | "engenharia" | "admin";
type UrgenciaFiltro = "todas" | "baixa" | "normal" | "alta" | "urgente";

function isAberta(status: Demanda["status"]) {
  return status === "pendente" || status === "aberta" || status === "aceita" || status === "em_execucao";
}

function horasAguardando(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

function CardDemanda({ demanda, onClick }: { demanda: Demanda; onClick: () => void }) {
  const tipo = getTipoMeta(demanda.tipo);
  const urgencia = getUrgenciaMeta(demanda.urgencia);
  const aguardando = isAberta(demanda.status) ? horasAguardando(demanda.created_at) : 0;

  let esperaClass = "";
  if (aguardando >= 8) esperaClass = "text-red-600";
  else if (aguardando >= 4) esperaClass = "text-orange-600";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 hover:border-primary/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-tight truncate">{tipo.icon} {demanda.titulo}</p>
          <p className="text-xs text-muted-foreground">{getSetorLabel(demanda.destinatario_setor)}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Badge className={`text-xs border ${urgencia.badgeClass}`}>{urgencia.label}</Badge>
          <Badge variant="outline" className="text-[11px]">{getStatusLabel(demanda.status)}</Badge>
        </div>
      </div>

      {demanda.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
        <span><strong>Solicitante:</strong> {demanda.solicitante_nome}</span>
        {demanda.equipamento && <span><strong>Equipamento:</strong> {demanda.equipamento}</span>}
      </div>

      {isAberta(demanda.status) && aguardando >= 1 && (
        <p className={`text-xs font-semibold ${esperaClass || "text-muted-foreground"}`}>
          ⏰ Aguardando há {aguardando}h
        </p>
      )}
    </button>
  );
}

export default function DemandasHome() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [setorFiltro, setSetorFiltro] = useState<SetorFiltro>("todos");
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<UrgenciaFiltro>("todas");
  const { demandas, loading, criar, reload } = useDemandas();

  const demandasFiltradas = useMemo(() => {
    return demandas.filter((demanda) => {
      const bySetor = setorFiltro === "todos" ? true : demanda.destinatario_setor === setorFiltro;
      const byUrgencia = urgenciaFiltro === "todas" ? true : demanda.urgencia === urgenciaFiltro;
      return bySetor && byUrgencia;
    });
  }, [demandas, setorFiltro, urgenciaFiltro]);

  const abertasCount = useMemo(() => demandas.filter((d) => isAberta(d.status)).length, [demandas]);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">WF Demandas</h1>
            <p className="text-xs text-white/80">Abertas: {abertasCount}</p>
          </div>
          <button onClick={reload} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
          <Button
            onClick={() => navigate("/manutencao/fila")}
            size="sm"
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-1.5 font-bold rounded-lg"
          >
            <Tv className="w-4 h-4" /> Fila
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            size="sm"
            className="bg-white/20 border border-white/30 text-white hover:bg-white/30 gap-1.5 font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </header>

      <div className="px-4 pt-4 pb-2 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Setor destinatário</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSetorFiltro("todos")}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                setorFiltro === "todos"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              Todos
            </button>
            {SETORES_DESTINATARIOS.map((setor) => (
              <button
                key={setor.value}
                onClick={() => setSetorFiltro(setor.value)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  setorFiltro === setor.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {setor.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Urgência</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setUrgenciaFiltro("todas")}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                urgenciaFiltro === "todas"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              Todas
            </button>
            {URGENCIAS.map((urg) => (
              <button
                key={urg.value}
                onClick={() => setUrgenciaFiltro(urg.value)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  urgenciaFiltro === urg.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {urg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando...</p>
        ) : demandasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="text-sm">Nenhuma demanda encontrada</p>
            <Button onClick={() => setModalOpen(true)} size="sm" className="bg-header-gradient text-white font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Criar demanda
            </Button>
          </div>
        ) : (
          demandasFiltradas.map((demanda) => (
            <CardDemanda key={demanda.id} demanda={demanda} onClick={() => navigate(`/demandas/${demanda.id}`)} />
          ))
        )}
      </div>

      <NovaDemandaModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={criar} />
    </div>
  );
}

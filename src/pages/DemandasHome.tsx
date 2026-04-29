import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemandas, type Demanda } from "@/hooks/useDemandas";
import NovaDemandaModal from "@/components/demandas/NovaDemandaModal";
import logoCi from "@/assets/logo-workflux.png";
import { getSetorLabel, getStatusLabel, getTipoMeta, getUrgenciaMeta } from "@/lib/demandas";

type FiltroStatus = "todas" | "abertas" | "andamento" | "concluidas";

type FiltroSetor = "todos" | string;

function statusEhAberto(status: Demanda["status"]) {
  return status === "pendente" || status === "aberta" || status === "aceita" || status === "em_execucao";
}

function statusEhAndamento(status: Demanda["status"]) {
  return status === "aceita" || status === "em_execucao";
}

function horasSemResposta(d: Demanda) {
  if (d.resposta || d.respondido_at) return 0;
  const diff = Date.now() - new Date(d.created_at).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

function CardDemanda({ demanda, onClick }: { demanda: Demanda; onClick: () => void }) {
  const tipo = getTipoMeta(demanda.tipo);
  const urgencia = getUrgenciaMeta(demanda.urgencia);
  const semRespostaHoras = statusEhAberto(demanda.status) ? horasSemResposta(demanda) : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-tight truncate">{tipo.icon} {demanda.titulo}</p>
          <p className="text-xs text-muted-foreground">{getSetorLabel(demanda.destinatario_setor)}</p>
        </div>
        <Badge className={`text-xs border ${urgencia.badgeClass}`}>{urgencia.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[11px]">{getStatusLabel(demanda.status)}</Badge>
        <span>{demanda.solicitante_nome}</span>
        <span>•</span>
        <span>{new Date(demanda.created_at).toLocaleString("pt-BR")}</span>
      </div>

      {demanda.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>}

      {semRespostaHoras >= 4 && (
        <p className={`text-xs font-semibold ${semRespostaHoras >= 8 ? "text-red-600" : "text-orange-600"}`}>
          ⏰ Sem resposta há {semRespostaHoras}h
        </p>
      )}
    </button>
  );
}

export default function DemandasHome() {
  const navigate = useNavigate();
  const [novoOpen, setNovoOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroSetor, setFiltroSetor] = useState<FiltroSetor>("todos");
  const { demandas, loading, criar, criarMuitas, reload } = useDemandas();

  const abertasCount = useMemo(() => {
    return demandas.filter((d) => d.status === "pendente" || d.status === "aberta" || d.status === "em_execucao" || d.status === "aceita")
      .length;
  }, [demandas]);

  const setoresExistentes = useMemo(() => {
    const set = new Set<string>();
    demandas.forEach((d) => {
      if (d.destinatario_setor) set.add(d.destinatario_setor);
    });
    return Array.from(set.values());
  }, [demandas]);

  const demandasFiltradas = useMemo(() => {
    return demandas.filter((d) => {
      const okStatus =
        filtroStatus === "todas"
          ? true
          : filtroStatus === "abertas"
            ? statusEhAberto(d.status)
            : filtroStatus === "andamento"
              ? statusEhAndamento(d.status)
              : d.status === "concluida";

      const okSetor = filtroSetor === "todos" ? true : d.destinatario_setor === filtroSetor;
      return okStatus && okSetor;
    });
  }, [demandas, filtroStatus, filtroSetor]);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-bold text-white">Demandas</h1>
            <p className="text-xs text-white/80">{abertasCount} abertas</p>
          </div>

          <button onClick={reload} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>

          <Button
            onClick={() => setNovoOpen(true)}
            size="sm"
            className="bg-white/20 border border-white/30 text-white hover:bg-white/30 gap-1.5 font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" /> Nova Demanda
          </Button>
        </div>
      </header>

      <div className="px-4 pt-4 pb-2 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Status</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "todas", label: "Todas" },
              { id: "abertas", label: "Abertas" },
              { id: "andamento", label: "Em Andamento" },
              { id: "concluidas", label: "Concluídas" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFiltroStatus(item.id as FiltroStatus)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${
                  filtroStatus === item.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Setor destinatário</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroSetor("todos")}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
                filtroSetor === "todos" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              }`}
            >
              Todos
            </button>
            {setoresExistentes.map((setor) => (
              <button
                key={setor}
                onClick={() => setFiltroSetor(setor)}
                className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
                  filtroSetor === setor ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                }`}
              >
                {getSetorLabel(setor)}
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
            <Button onClick={() => setNovoOpen(true)} size="sm" className="bg-header-gradient text-white font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Criar demanda
            </Button>
          </div>
        ) : (
          demandasFiltradas.map((demanda) => (
            <CardDemanda key={demanda.id} demanda={demanda} onClick={() => navigate(`/demandas/${demanda.id}`)} />
          ))
        )}
      </div>

      <NovaDemandaModal open={novoOpen} onClose={() => setNovoOpen(false)} onCreate={criar} onCreateMany={criarMuitas} />
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemandas, type Demanda, type StatusDemanda } from "@/hooks/useDemandas";
import NovaDemandaModal from "@/components/demandas/NovaDemandaModal";
import logoCi from "@/assets/logo-ci.png";

const STATUS_LABELS: Record<StatusDemanda, string> = {
  pendente: "Pendente",
  aceita: "Aceita",
  em_execucao: "Em Execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_CLASSES: Record<StatusDemanda, string> = {
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  aceita: "bg-blue-100 text-blue-800 border-blue-200",
  em_execucao: "bg-green-100 text-green-800 border-green-200",
  concluida: "bg-gray-100 text-gray-600 border-gray-200",
  cancelada: "bg-red-100 text-red-800 border-red-200",
};

const PROXIMO_STATUS: Partial<Record<StatusDemanda, { next: StatusDemanda; label: string }>> = {
  pendente: { next: "aceita", label: "Marcar Aceita" },
  aceita: { next: "em_execucao", label: "Iniciar Execução" },
  em_execucao: { next: "concluida", label: "Concluir" },
};

const FILTROS: Array<{ value: StatusDemanda | "todas"; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "aceita", label: "Aceita" },
  { value: "em_execucao", label: "Em Execução" },
  { value: "concluida", label: "Concluída" },
];

function DemandaCard({ demanda, onAvancar }: { demanda: Demanda; onAvancar: (id: string, status: StatusDemanda) => void }) {
  const prox = PROXIMO_STATUS[demanda.status];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-bold text-base leading-tight">{demanda.titulo}</h3>
        <Badge className={`text-xs shrink-0 border ${STATUS_CLASSES[demanda.status]}`}>
          {STATUS_LABELS[demanda.status]}
        </Badge>
      </div>

      {demanda.descricao && (
        <p className="text-sm text-muted-foreground">{demanda.descricao}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><strong>Solicitante:</strong> {demanda.solicitante_nome}</span>
        <span><strong>Depto:</strong> {demanda.solicitante_departamento}</span>
        {demanda.funcionario_nome && <span><strong>Funcionário:</strong> {demanda.funcionario_nome}</span>}
        {demanda.equipamento && <span><strong>Equipamento:</strong> {demanda.equipamento}</span>}
        {demanda.data_prevista && <span><strong>Data:</strong> {new Date(demanda.data_prevista + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
        <span>
          <strong>Custo:</strong>{" "}
          <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
            {demanda.centro_de_custo}
          </span>
        </span>
      </div>

      {demanda.observacoes && (
        <p className="text-xs text-muted-foreground italic border-t pt-2">{demanda.observacoes}</p>
      )}

      {prox && (
        <Button
          size="sm"
          onClick={() => onAvancar(demanda.id, prox.next)}
          className="w-full bg-header-gradient text-white font-bold rounded-xl hover:opacity-90 text-xs h-8"
        >
          {prox.label}
        </Button>
      )}
    </div>
  );
}

export default function DemandasHome() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<StatusDemanda | "todas">("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const { demandas, loading, criar, atualizarStatus, reload } = useDemandas(
    filtro === "todas" ? undefined : filtro
  );

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">CI Demandas</h1>
            <p className="text-xs text-white/70">Gestão de Tarefas e Ordens de Serviço</p>
          </div>
          <button onClick={reload} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
          <Button
            onClick={() => setModalOpen(true)}
            size="sm"
            className="bg-white/20 border border-white/30 text-white hover:bg-white/30 gap-1.5 font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                filtro === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-8 space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando...</p>
        ) : demandas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="text-sm">Nenhuma demanda encontrada</p>
            <Button onClick={() => setModalOpen(true)} size="sm" className="bg-header-gradient text-white font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Criar primeira demanda
            </Button>
          </div>
        ) : (
          demandas.map(d => (
            <DemandaCard key={d.id} demanda={d} onAvancar={atualizarStatus} />
          ))
        )}
      </div>

      <NovaDemandaModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={criar} />
    </div>
  );
}

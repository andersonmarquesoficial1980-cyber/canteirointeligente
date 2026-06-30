import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Plus, RefreshCw, Pencil, Trash2, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemandas, type Demanda } from "@/hooks/useDemandas";
import NovaDemandaModal from "@/components/demandas/NovaDemandaModal";
import logoCi from "@/assets/logo-workflux.png";
import { getSetorLabel, getStatusLabel, getTipoMeta, getUrgenciaMeta, TRANSPORTE_HORARIOS } from "@/lib/demandas";

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

// ── Card com botões de ação ──────────────────────────────────────────────────
function CardDemanda({
  demanda,
  onClick,
  onEditar,
  onExcluir,
}: {
  demanda: Demanda;
  onClick: () => void;
  onEditar: (d: Demanda) => void;
  onExcluir: (d: Demanda) => void;
}) {
  const tipo = getTipoMeta(demanda.tipo);
  const urgencia = getUrgenciaMeta(demanda.urgencia);
  const semRespostaHoras = statusEhAberto(demanda.status) ? horasSemResposta(demanda) : 0;

  return (
    <div className="relative w-full text-left rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 overflow-hidden">
      {/* área clicável principal */}
      <button onClick={onClick} className="w-full text-left p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-16">
            <p className="font-display font-bold text-base leading-tight truncate">{tipo.icon} {demanda.titulo}</p>
            <p className="text-xs text-muted-foreground">{getSetorLabel(demanda.destinatario_setor)}</p>
          </div>
          <Badge className={`text-xs border ${urgencia.badgeClass} shrink-0`}>{urgencia.label}</Badge>
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

      {/* botões editar / excluir — canto inferior direito */}
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        <button
          onClick={e => { e.stopPropagation(); onEditar(demanda); }}
          className="p-1.5 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onExcluir(demanda); }}
          className="p-1.5 rounded-lg bg-muted hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Modal de confirmação de exclusão ─────────────────────────────────────────
function ConfirmarExclusao({
  demanda,
  onConfirmar,
  onCancelar,
  salvando,
}: {
  demanda: Demanda;
  onConfirmar: () => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  return (
    <Dialog open onOpenChange={onCancelar}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Excluir demanda?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A demanda <strong>"{demanda.titulo}"</strong> será removida permanentemente para todos os envolvidos.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancelar} className="flex-1" disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={salvando}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {salvando ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de edição de demanda de transporte ─────────────────────────────────
function EditarDemandaModal({
  demanda,
  onSalvar,
  onFechar,
  salvando,
}: {
  demanda: Demanda;
  onSalvar: (dados: Partial<Demanda>) => void;
  onFechar: () => void;
  salvando: boolean;
}) {
  const [origem, setOrigem] = useState(demanda.origem || "");
  const [destino, setDestino] = useState(demanda.destino || "");
  const [horario, setHorario] = useState(demanda.horario_transporte || "");
  const [observacoes, setObservacoes] = useState(demanda.observacoes || demanda.descricao || "");

  const ehTransporte = demanda.tipo === "transporte_equipamento" || demanda.destinatario_setor === "transporte_logistica";

  return (
    <Dialog open onOpenChange={onFechar}>
      <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> Editar demanda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {ehTransporte && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origem</Label>
                <Input
                  value={origem}
                  onChange={e => setOrigem(e.target.value)}
                  placeholder="Local de origem..."
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destino</Label>
                <Input
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  placeholder="Local de destino..."
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horário</Label>
                <Select value={horario} onValueChange={setHorario}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Selecione o horário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORTE_HORARIOS.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
              className="rounded-xl text-sm"
              placeholder="Informações adicionais..."
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onFechar} className="flex-1" disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={() => onSalvar({
                origem: origem || undefined,
                destino: destino || undefined,
                horario_transporte: horario || undefined,
                observacoes: observacoes || undefined,
                descricao: observacoes || undefined,
              })}
              disabled={salvando}
              className="flex-1 gap-1.5"
            >
              {salvando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><CheckCircle2 className="w-4 h-4" /> Salvar</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function DemandasHome() {
  const navigate = useNavigate();
  const [novoOpen, setNovoOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroSetor, setFiltroSetor] = useState<FiltroSetor>("todos");
  const { demandas, loading, criar, atualizar, excluir, reload } = useDemandas();

  // estado para editar/excluir
  const [demandaParaEditar, setDemandaParaEditar] = useState<Demanda | null>(null);
  const [demandaParaExcluir, setDemandaParaExcluir] = useState<Demanda | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [salvandoExclusao, setSalvandoExclusao] = useState(false);

  const abertasCount = useMemo(() => {
    return demandas.filter(d => statusEhAberto(d.status)).length;
  }, [demandas]);

  const setoresExistentes = useMemo(() => {
    const set = new Set<string>();
    demandas.forEach(d => { if (d.destinatario_setor) set.add(d.destinatario_setor); });
    return Array.from(set.values());
  }, [demandas]);

  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => {
      const okStatus =
        filtroStatus === "todas" ? true
        : filtroStatus === "abertas" ? statusEhAberto(d.status)
        : filtroStatus === "andamento" ? statusEhAndamento(d.status)
        : d.status === "concluida";
      const okSetor = filtroSetor === "todos" ? true : d.destinatario_setor === filtroSetor;
      return okStatus && okSetor;
    });
  }, [demandas, filtroStatus, filtroSetor]);

  async function handleSalvarEdicao(dados: Partial<Demanda>) {
    if (!demandaParaEditar) return;
    setSalvandoEdicao(true);
    const ok = await atualizar(demandaParaEditar.id, dados);
    setSalvandoEdicao(false);
    if (ok) setDemandaParaEditar(null);
  }

  async function handleConfirmarExclusao() {
    if (!demandaParaExcluir) return;
    setSalvandoExclusao(true);
    const ok = await excluir(demandaParaExcluir.id);
    setSalvandoExclusao(false);
    if (ok) setDemandaParaExcluir(null);
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={logoCi} alt="CI" className="w-8 h-8 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-bold text-white">Transporte & Logística</h1>
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

      {/* Filtros */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Status</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "todas", label: "Todas" },
              { id: "abertas", label: "Abertas" },
              { id: "andamento", label: "Em Andamento" },
              { id: "concluidas", label: "Concluídas" },
            ].map(item => (
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
            {setoresExistentes.map(setor => (
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

      {/* Lista */}
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
          demandasFiltradas.map(demanda => (
            <CardDemanda
              key={demanda.id}
              demanda={demanda}
              onClick={() => navigate(`/demandas/${demanda.id}`)}
              onEditar={d => setDemandaParaEditar(d)}
              onExcluir={d => setDemandaParaExcluir(d)}
            />
          ))
        )}
      </div>

      {/* Modal nova demanda */}
      <NovaDemandaModal open={novoOpen} onClose={() => setNovoOpen(false)} onCreate={criar} />

      {/* Modal edição */}
      {demandaParaEditar && (
        <EditarDemandaModal
          demanda={demandaParaEditar}
          onSalvar={handleSalvarEdicao}
          onFechar={() => setDemandaParaEditar(null)}
          salvando={salvandoEdicao}
        />
      )}

      {/* Modal confirmação de exclusão */}
      {demandaParaExcluir && (
        <ConfirmarExclusao
          demanda={demandaParaExcluir}
          onConfirmar={handleConfirmarExclusao}
          onCancelar={() => setDemandaParaExcluir(null)}
          salvando={salvandoExclusao}
        />
      )}
    </div>
  );
}

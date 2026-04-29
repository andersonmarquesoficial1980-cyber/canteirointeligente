import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useDemandaById, useDemandas } from "@/hooks/useDemandas";
import { supabase } from "@/integrations/supabase/client";
import { getSetorLabel, getStatusLabel, getTipoMeta, getUrgenciaMeta, type StatusDemanda } from "@/lib/demandas";

const STATUS_STEPS: Array<{ status: StatusDemanda; label: string }> = [
  { status: "pendente", label: "Pendente" },
  { status: "em_execucao", label: "Em Andamento" },
  { status: "concluida", label: "Concluída" },
];

function statusIndex(status?: string | null) {
  if (status === "pendente" || status === "aberta") return 0;
  if (status === "aceita" || status === "em_execucao") return 1;
  if (status === "concluida") return 2;
  return -1;
}

function isProbablyUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function safeJsonArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

export default function DetalhesDemanda() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { demanda, loading, reload } = useDemandaById(id);
  const { atualizarStatus, responderDemanda, marcarVisualizada } = useDemandas();

  const [resposta, setResposta] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingResposta, setSavingResposta] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Usuário");

  useEffect(() => {
    const hydrateUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !id) return;

      await marcarVisualizada(id, user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("user_id", user.id)
        .maybeSingle();

      if ((profile as any)?.nome_completo) setCurrentUserName((profile as any).nome_completo);
      else if (user.email) setCurrentUserName(user.email);
    };

    hydrateUser();
  }, [id]);

  useEffect(() => {
    if (!demanda) return;
    setResposta(demanda.resposta ?? "");
  }, [demanda]);

  const stepIndex = useMemo(() => statusIndex(demanda?.status), [demanda?.status]);

  const handleStatus = async (status: StatusDemanda) => {
    if (!demanda) return;
    setSavingStatus(true);
    await atualizarStatus(demanda.id, status);
    await reload();
    setSavingStatus(false);
  };

  const handleResponder = async () => {
    if (!demanda || !resposta.trim()) return;
    setSavingResposta(true);
    await responderDemanda(demanda.id, resposta.trim(), currentUserName);
    await reload();
    setSavingResposta(false);
  };

  const handleCancelar = async () => {
    if (!demanda) return;
    setSavingStatus(true);
    await atualizarStatus(demanda.id, "cancelada");
    await reload();
    setSavingStatus(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!demanda) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground">Demanda não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/demandas")}>Voltar</Button>
      </div>
    );
  }

  const tipoMeta = getTipoMeta(demanda.tipo);
  const urgenciaMeta = getUrgenciaMeta(demanda.urgencia);
  const equipamentos = safeJsonArray(demanda.equipamentos_json);
  const itensMaterial = safeJsonArray(demanda.itens_material);

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/demandas")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold text-white truncate">{demanda.titulo}</h1>
            <p className="text-xs text-white/80">Demanda #{demanda.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-sm">{tipoMeta.icon} {tipoMeta.label}</Badge>
            <Badge className={`border ${urgenciaMeta.badgeClass}`}>{urgenciaMeta.label}</Badge>
            <Badge variant="outline">{getSetorLabel(demanda.destinatario_setor)}</Badge>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Status</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_STEPS.map((step, idx) => {
                const active = idx <= stepIndex;
                const disabled = demanda.status === "cancelada" || savingStatus;
                return (
                  <Button
                    key={step.status}
                    variant={active ? "default" : "outline"}
                    className={active ? "bg-header-gradient text-white" : ""}
                    onClick={() => handleStatus(step.status)}
                    disabled={disabled}
                  >
                    {step.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Atual: {getStatusLabel(demanda.status)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Descrição</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{demanda.descricao || "Sem descrição."}</p>
        </section>

        {demanda.tipo === "manutencao" && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold">Dados da Manutenção</h2>
            <p className="text-sm"><strong>Equipamento:</strong> {demanda.equipamento || "-"}</p>
            <p className="text-sm"><strong>Problema:</strong> {demanda.descricao || "-"}</p>
            {demanda.foto_url && (
              <img src={demanda.foto_url} alt="Foto do problema" className="w-full max-h-80 object-contain rounded-xl border" />
            )}
          </section>
        )}

        {demanda.tipo === "transporte" && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Dados do Transporte</h2>

            {equipamentos.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Equipamentos</p>
                <ul className="text-sm space-y-1">
                  {equipamentos.map((e: any, idx) => (
                    <li key={idx}>• {e.frota || e.id} {e.tipo ? `(${e.tipo})` : ""}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm"><strong>Origem:</strong> {demanda.origem || "-"}</p>
            {isProbablyUrl(demanda.origem_maps) && (
              <a href={demanda.origem_maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                Abrir Maps origem <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <p className="text-sm"><strong>Destino:</strong> {demanda.destino || "-"}</p>
            {isProbablyUrl(demanda.destino_maps) && (
              <a href={demanda.destino_maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                Abrir Maps destino <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <p className="text-sm"><strong>Horário:</strong> {demanda.horario_transporte || "-"}</p>
          </section>
        )}

        {demanda.tipo === "rh" && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold">Dados RH</h2>
            <p className="text-sm"><strong>Sub-tipo:</strong> {demanda.sub_tipo || "-"}</p>
            {demanda.funcionario_nome && <p className="text-sm"><strong>Funcionário:</strong> {demanda.funcionario_nome}</p>}
            {demanda.funcao_solicitada && <p className="text-sm"><strong>Função solicitada:</strong> {demanda.funcao_solicitada}</p>}
            <p className="text-sm"><strong>Justificativa/Motivo:</strong> {demanda.descricao || "-"}</p>
            {demanda.observacoes && <p className="text-sm"><strong>Tipo:</strong> {demanda.observacoes}</p>}
          </section>
        )}

        {demanda.tipo === "material" && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Itens Solicitados</h2>
            {itensMaterial.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {itensMaterial.map((item: any, idx) => (
                  <li key={idx}>• {item.item} - {item.quantidade} {item.unidade}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem itens formatados.</p>
            )}
            {demanda.funcionario_solicitado_nome && (
              <p className="text-sm"><strong>Funcionário destinatário:</strong> {demanda.funcionario_solicitado_nome}</p>
            )}
          </section>
        )}

        {demanda.tipo === "tarefa" && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold">Tarefa da Equipe</h2>
            <p className="text-sm"><strong>Funcionário:</strong> {demanda.funcionario_nome || "-"}</p>
            <p className="text-sm"><strong>Data prevista:</strong> {demanda.data_prevista ? new Date(`${demanda.data_prevista}T12:00:00`).toLocaleDateString("pt-BR") : "-"}</p>
            <p className="text-sm"><strong>Horário:</strong> {demanda.horario_transporte || "-"}</p>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Resposta</h2>
          <Textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={5}
            placeholder="Descreva a resposta ao solicitante"
            disabled={demanda.status === "cancelada"}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleResponder}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={savingResposta || !resposta.trim() || demanda.status === "cancelada"}
            >
              {savingResposta ? "Enviando..." : "Responder e Concluir"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelar}
              disabled={savingStatus || demanda.status === "concluida" || demanda.status === "cancelada"}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Cancelar
            </Button>
          </div>

          {demanda.respondido_por && (
            <p className="text-xs text-muted-foreground">
              Última resposta por {demanda.respondido_por}
              {demanda.respondido_at ? ` em ${new Date(demanda.respondido_at).toLocaleString("pt-BR")}` : ""}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
          <p><strong>Solicitante:</strong> {demanda.solicitante_nome} ({demanda.solicitante_departamento})</p>
          <p><strong>Setor origem:</strong> {demanda.setor_origem || "-"}</p>
          <p><strong>Criada em:</strong> {new Date(demanda.created_at).toLocaleString("pt-BR")}</p>
        </section>
      </main>
    </div>
  );
}

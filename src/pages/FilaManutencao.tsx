import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Demanda } from "@/hooks/useDemandas";
import { getTipoMeta, getUrgenciaMeta, URGENCIA_ORDEM } from "@/lib/demandas";

function horasAbertas(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

export default function FilaManutencao() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [conclusaoAberta, setConclusaoAberta] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("demandas")
      .select("*")
      .eq("destinatario_setor", "manutencao")
      .not("status", "in", "(concluida,cancelada)")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar fila", description: error.message, variant: "destructive" });
    } else if (data) {
      setDemandas(data as Demanda[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const demandasOrdenadas = useMemo(() => {
    return [...demandas].sort((a, b) => {
      const aUrg = URGENCIA_ORDEM[(a.urgencia ?? "normal") as keyof typeof URGENCIA_ORDEM] ?? 2;
      const bUrg = URGENCIA_ORDEM[(b.urgencia ?? "normal") as keyof typeof URGENCIA_ORDEM] ?? 2;
      if (aUrg !== bUrg) return aUrg - bUrg;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [demandas]);

  const assumir = async (id: string) => {
    setSavingId(id);
    const { error } = await (supabase as any)
      .from("demandas")
      .update({ status: "em_execucao", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao assumir demanda", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Demanda assumida" });
      await load();
    }
    setSavingId(null);
  };

  const concluir = async (id: string) => {
    const texto = (resposta[id] ?? "").trim();
    if (!texto) return;

    setSavingId(id);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_completo")
      .eq("user_id", user?.id)
      .maybeSingle();

    const respondidoPor = (profile as any)?.nome_completo || user?.email || "Equipe Manutenção";

    const { error } = await (supabase as any)
      .from("demandas")
      .update({
        status: "concluida",
        resposta: texto,
        respondido_por: respondidoPor,
        respondido_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao concluir demanda", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Demanda concluída" });
      setConclusaoAberta(null);
      setResposta((prev) => ({ ...prev, [id]: "" }));
      await load();
    }
    setSavingId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/manutencao")} className="text-zinc-300 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Wrench className="w-8 h-8 text-yellow-400" />
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold">Fila de Manutenção</h1>
            <p className="text-base text-zinc-400">{demandasOrdenadas.length} demanda(s) aberta(s)</p>
          </div>
          <Button onClick={load} variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-4">
        {loading ? (
          <p className="text-lg text-zinc-400">Carregando fila...</p>
        ) : demandasOrdenadas.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-2xl font-semibold">Sem demandas pendentes na manutenção.</p>
          </div>
        ) : (
          demandasOrdenadas.map((demanda) => {
            const tipo = getTipoMeta(demanda.tipo);
            const urgencia = getUrgenciaMeta(demanda.urgencia);
            const horas = horasAbertas(demanda.created_at);

            return (
              <article key={demanda.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 max-w-4xl">
                    <h2 className="text-2xl font-display font-bold leading-tight">
                      {tipo.icon} {demanda.equipamento || demanda.titulo}
                    </h2>
                    <p className="text-lg text-zinc-300 whitespace-pre-wrap">{demanda.descricao || "Sem descrição"}</p>
                    {demanda.foto_url && (
                      <img src={demanda.foto_url} alt="Foto manutenção" className="mt-2 rounded-xl border border-zinc-700 max-h-72" />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${urgencia.badgeClass}`}>
                      {urgencia.label.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 text-base text-zinc-300">
                  <p><strong>Solicitante:</strong> {demanda.solicitante_nome}</p>
                  <p><strong>Status:</strong> {demanda.status === "em_execucao" || demanda.status === "aceita" ? "Em execução" : "Pendente"}</p>
                  <p><strong>Há:</strong> {horas}h</p>
                </div>

                {conclusaoAberta === demanda.id && (
                  <div className="space-y-2">
                    <Textarea
                      value={resposta[demanda.id] ?? ""}
                      onChange={(e) => setResposta((prev) => ({ ...prev, [demanda.id]: e.target.value }))}
                      rows={3}
                      className="bg-zinc-950 border-zinc-700 text-zinc-100 text-base"
                      placeholder="Descreva o que foi feito para concluir"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => assumir(demanda.id)}
                    disabled={savingId === demanda.id || demanda.status === "em_execucao" || demanda.status === "aceita"}
                    className="h-12 px-6 text-base bg-blue-600 hover:bg-blue-700"
                  >
                    Assumir
                  </Button>
                  {conclusaoAberta !== demanda.id ? (
                    <Button
                      onClick={() => setConclusaoAberta(demanda.id)}
                      variant="outline"
                      className="h-12 px-6 text-base border-green-500 text-green-300 hover:bg-green-950"
                    >
                      Concluir
                    </Button>
                  ) : (
                    <Button
                      onClick={() => concluir(demanda.id)}
                      disabled={savingId === demanda.id || !(resposta[demanda.id] ?? "").trim()}
                      className="h-12 px-6 text-base bg-green-600 hover:bg-green-700"
                    >
                      Confirmar Conclusão
                    </Button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}

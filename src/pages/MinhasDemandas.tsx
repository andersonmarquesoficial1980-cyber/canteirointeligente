import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Demanda, StatusDemanda } from "@/hooks/useDemandas";
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

export default function MinhasDemandas() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Busca demandas onde o perfil do usuário está atribuído
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data, error } = await (supabase as any)
      .from("demandas")
      .select("*")
      .eq("funcionario_id", profile?.id ?? user.id)
      .neq("status", "cancelada")
      .order("created_at", { ascending: false });

    if (!error && data) setDemandas(data as Demanda[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const avancarStatus = async (demanda: Demanda, novoStatus: StatusDemanda) => {
    setSaving(demanda.id);
    const update: any = { status: novoStatus, updated_at: new Date().toISOString() };
    if (novoStatus === "concluida" && observacoes[demanda.id]) {
      update.observacoes = observacoes[demanda.id];
    }
    const { error } = await (supabase as any).from("demandas").update(update).eq("id", demanda.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Status atualizado!" });
      await load();
    }
    setSaving(null);
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-50 bg-header-gradient px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img src={logoCi} alt="CI" className="w-10 h-10 rounded-full border-2 border-white/30 shadow-md" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-white">Minhas Tarefas</h1>
            <p className="text-xs text-white/70">Demandas atribuídas a você</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-8 space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando...</p>
        ) : demandas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">Nenhuma tarefa atribuída</p>
            <p className="text-xs text-center">Quando você receber uma demanda, ela aparecerá aqui.</p>
          </div>
        ) : (
          demandas.map(d => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold text-base leading-tight">{d.titulo}</h3>
                <Badge className={`text-xs shrink-0 border ${STATUS_CLASSES[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </Badge>
              </div>

              {d.descricao && <p className="text-sm text-muted-foreground">{d.descricao}</p>}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><strong>Solicitante:</strong> {d.solicitante_nome}</span>
                <span><strong>Depto:</strong> {d.solicitante_departamento}</span>
                {d.equipamento && <span><strong>Equipamento:</strong> {d.equipamento}</span>}
                {d.data_prevista && (
                  <span><strong>Data:</strong> {new Date(d.data_prevista + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                )}
              </div>

              {d.observacoes && (
                <p className="text-xs text-muted-foreground italic border-t pt-2">{d.observacoes}</p>
              )}

              {/* Ações por status */}
              {d.status === "pendente" && (
                <Button
                  size="sm"
                  onClick={() => avancarStatus(d, "aceita")}
                  disabled={saving === d.id}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs h-9"
                >
                  {saving === d.id ? "Atualizando..." : "✅ Confirmar Recebimento"}
                </Button>
              )}

              {d.status === "aceita" && (
                <Button
                  size="sm"
                  onClick={() => avancarStatus(d, "em_execucao")}
                  disabled={saving === d.id}
                  className="w-full bg-header-gradient text-white font-bold rounded-xl text-xs h-9"
                >
                  {saving === d.id ? "Atualizando..." : "▶️ Iniciar Execução"}
                </Button>
              )}

              {d.status === "em_execucao" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Observações ao concluir (opcional)..."
                    value={observacoes[d.id] ?? ""}
                    onChange={e => setObservacoes(prev => ({ ...prev, [d.id]: e.target.value }))}
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => avancarStatus(d, "concluida")}
                    disabled={saving === d.id}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs h-9"
                  >
                    {saving === d.id ? "Concluindo..." : "🏁 Concluir Tarefa"}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Plus, X, Loader2 } from "lucide-react";
import { useEquipes } from "@/hooks/useEquipes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EquipesManager() {
  const { equipes, membros, loading, refetch } = useEquipes();
  const [expandedEquipe, setExpandedEquipe] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [nomeNova, setNomeNova] = useState("");
  const [respNova, setRespNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  const handleCriar = async () => {
    if (!nomeNova.trim()) return;
    setSalvando(true);
    const { error } = await (supabase as any).from("ci_equipes").insert({
      nome: nomeNova.trim().toUpperCase(),
      responsavel: respNova.trim() || null,
      ativa: true,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao criar equipe", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Equipe criada!", description: nomeNova.trim().toUpperCase() });
    setNomeNova("");
    setRespNova("");
    setShowModal(false);
    refetch?.();
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando equipes...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Botão Nova Equipe */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Equipe
        </button>
      </div>

      {equipes.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma equipe encontrada. Crie a primeira equipe acima.
        </div>
      ) : (
        equipes.map(equipe => {
          const membrosEquipe = membros.filter(m => m.equipe === equipe);
          const responsavel = membrosEquipe[0]?.responsavel || "";
          const isExpanded = expandedEquipe === equipe;

          return (
            <div key={equipe} className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                onClick={() => setExpandedEquipe(isExpanded ? null : equipe)}
              >
                <Users className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{equipe}</p>
                  <p className="text-xs text-muted-foreground">
                    Responsável: {responsavel} · {membrosEquipe.length} funcionário(s)
                  </p>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-1 bg-muted/10">
                  {membrosEquipe
                    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                    .map(m => (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white border border-border px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{m.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {m.matricula} · {m.funcao}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modal Nova Equipe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Nova Equipe</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome da Equipe *</label>
                <input
                  value={nomeNova}
                  onChange={e => setNomeNova(e.target.value)}
                  placeholder="Ex: CBUQ05 - JOAO"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleCriar()}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Responsável</label>
                <input
                  value={respNova}
                  onChange={e => setRespNova(e.target.value)}
                  placeholder="Nome do responsável"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  onKeyDown={e => e.key === "Enter" && handleCriar()}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={salvando || !nomeNova.trim()}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

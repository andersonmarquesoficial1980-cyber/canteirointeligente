import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useEquipes } from "@/hooks/useEquipes";

export default function EquipesManager() {
  const { equipes, membros, loading } = useEquipes();
  const [expandedEquipe, setExpandedEquipe] = useState<string | null>(null);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando equipes...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm">
        <strong>ℹ️ As equipes são definidas em Gestão de Pessoas.</strong><br />
        Para alterar a equipe ou responsável de um funcionário, acesse o módulo <strong>Gestão de Pessoas → Ficha do Funcionário → Editar</strong>.
        Esta tela é apenas para visualização.
      </div>

      {equipes.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma equipe encontrada. Verifique os dados em Gestão de Pessoas.
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
    </div>
  );
}

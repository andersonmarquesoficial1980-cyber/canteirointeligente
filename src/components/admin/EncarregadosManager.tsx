/**
 * EncarregadosManager — Define quais funcionários são Encarregados/Responsáveis de Obra
 * Usa a tabela employees (is_encarregado flag). Sem banco duplicado.
 */
import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, HardHat, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  id: string;
  name: string;
  role: string;
  matricula: string;
  is_encarregado: boolean;
}

export default function EncarregadosManager() {
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, name, role, matricula, is_encarregado")
      .eq("status", "ativo")
      .order("name");
    setTodos((data || []).map((e: any) => ({
      id: e.id,
      name: e.name || "",
      role: e.role || "",
      matricula: e.matricula || "",
      is_encarregado: !!e.is_encarregado,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (func: Funcionario) => {
    setToggling(func.id);
    const novoValor = !func.is_encarregado;
    const { error } = await (supabase as any)
      .from("employees")
      .update({ is_encarregado: novoValor })
      .eq("id", func.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      setTodos(prev => prev.map(f => f.id === func.id ? { ...f, is_encarregado: novoValor } : f));
      toast({ title: novoValor ? "Marcado como encarregado" : "Removido dos encarregados", description: func.name });
    }
    setToggling(null);
  };

  const filtrados = todos.filter(f =>
    !busca || f.name.toLowerCase().includes(busca.toLowerCase()) ||
    f.role.toLowerCase().includes(busca.toLowerCase()) ||
    f.matricula.includes(busca)
  );

  const encarregados = filtrados.filter(f => f.is_encarregado);
  const demais = filtrados.filter(f => !f.is_encarregado);
  const totalMarcados = todos.filter(f => f.is_encarregado).length;

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando funcionários...</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm">
        <strong>ℹ️ Marque quem aparece no campo "Encarregado da Obra" no RDO.</strong><br />
        Os dados vêm direto do cadastro de funcionários — sem duplicação.
        <span className="ml-1 font-semibold">{totalMarcados} marcado{totalMarcados !== 1 ? "s" : ""}.</span>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, função ou matrícula..."
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Encarregados marcados */}
      {encarregados.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
            Encarregados / Responsáveis ({encarregados.length})
          </p>
          <div className="rounded-xl border border-green-200 overflow-hidden">
            {encarregados.map((func, i) => (
              <FuncRow
                key={func.id}
                func={func}
                toggling={toggling}
                onToggle={toggle}
                last={i === encarregados.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Demais funcionários */}
      {demais.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
            Outros funcionários ({demais.length})
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            {demais.map((func, i) => (
              <FuncRow
                key={func.id}
                func={func}
                toggling={toggling}
                onToggle={toggle}
                last={i === demais.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center space-y-2">
          <HardHat className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhum funcionário encontrado.</p>
        </div>
      )}
    </div>
  );
}

function FuncRow({ func, toggling, onToggle, last }: {
  func: Funcionario;
  toggling: string | null;
  onToggle: (f: Funcionario) => void;
  last: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-white hover:bg-muted/20 transition-colors ${!last ? "border-b border-border" : ""}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${func.is_encarregado ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
        {func.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{func.name}</p>
        <p className="text-xs text-muted-foreground">{func.role || "—"}{func.matricula ? ` · Mat. ${func.matricula}` : ""}</p>
      </div>
      <button
        onClick={() => onToggle(func)}
        disabled={toggling === func.id}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
          func.is_encarregado
            ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
        }`}
      >
        {toggling === func.id
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : func.is_encarregado
            ? <><Check className="w-3.5 h-3.5" /> Marcado</>
            : "Marcar"
        }
      </button>
    </div>
  );
}

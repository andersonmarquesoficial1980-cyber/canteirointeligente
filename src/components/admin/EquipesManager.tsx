import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Users, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipe {
  id: string;
  nome: string;
  responsavel: string | null;
  centro_custo: string | null;
  ativa: boolean;
}

interface Membro {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
  funcoes?: { nome: string } | null;
}

interface Employee {
  id: string;
  name: string;
  status: string;
}

interface CentroCusto {
  id: string;
  nome: string;
}

const EMPTY_FORM = { nome: "", responsavel: "", centro_custo: "" };

export default function EquipesManager() {
  const { toast } = useToast();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [membrosMap, setMembrosMap] = useState<Record<string, Membro[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEquipe, setExpandedEquipe] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: eqs }, { data: emps }, { data: ccs }] = await Promise.all([
      (supabase as any).from("ci_equipes").select("id, nome, responsavel, centro_custo, ativa").order("nome"),
      (supabase as any).from("employees").select("id, name, matricula, role, equipe, funcoes(nome)").eq("status", "ativo").order("name"),
      (supabase as any).from("ci_centros_custo").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    setEquipes(eqs || []);
    setEmployees(emps || []);
    setCentrosCusto(ccs || []);

    // Montar mapa de membros por equipe
    const map: Record<string, Membro[]> = {};
    for (const emp of (emps || [])) {
      if (emp.equipe) {
        if (!map[emp.equipe]) map[emp.equipe] = [];
        map[emp.equipe].push(emp);
      }
    }
    setMembrosMap(map);
    setLoading(false);
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setModalMode("new");
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(eq: Equipe) {
    setForm({ nome: eq.nome, responsavel: eq.responsavel || "", centro_custo: eq.centro_custo || "" });
    setModalMode("edit");
    setEditingId(eq.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      toast({ title: "Nome da equipe é obrigatório", variant: "destructive" });
      return;
    }
    setSalvando(true);

    const payload = {
      nome: form.nome.trim().toUpperCase(),
      responsavel: form.responsavel.trim() || null,
      centro_custo: form.centro_custo.trim() || null,
    };

    let error;
    if (modalMode === "edit" && editingId) {
      ({ error } = await (supabase as any).from("ci_equipes").update(payload).eq("id", editingId));
    } else {
      ({ error } = await (supabase as any).from("ci_equipes").insert({ ...payload, ativa: true }));
    }

    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar equipe", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: modalMode === "edit" ? "Equipe atualizada!" : "Equipe criada!", description: payload.nome });
    closeModal();
    load();
  }

  async function handleDeletar(eq: Equipe) {
    const membros = membrosMap[eq.nome]?.length || 0;
    const msg = membros > 0
      ? `Excluir a equipe "${eq.nome}"?\n\nAtenção: ${membros} funcionário(s) estão nesta equipe. O vínculo deles será preservado nos registros históricos, mas o campo equipe ficará sem correspondência no cadastro.\n\nEssa ação não pode ser desfeita.`
      : `Excluir a equipe "${eq.nome}"?\n\nEssa ação não pode ser desfeita.`;
    if (!window.confirm(msg)) return;
    setDeletando(eq.id);
    const { error } = await (supabase as any).from("ci_equipes").delete().eq("id", eq.id);
    setDeletando(null);
    if (error) {
      toast({ title: "Erro ao excluir equipe", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Equipe excluída", description: eq.nome });
    load();
  }

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando equipes...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Botão Nova Equipe */}
      <div className="flex justify-end">
        <button
          onClick={openNew}
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
          const membrosEquipe = membrosMap[equipe.nome] || [];
          const isExpanded = expandedEquipe === equipe.id;

          return (
            <div key={equipe.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  className="flex-1 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left rounded-lg -mx-1 px-1"
                  onClick={() => setExpandedEquipe(isExpanded ? null : equipe.id)}
                >
                  <Users className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{equipe.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {equipe.responsavel ? `Resp.: ${equipe.responsavel}` : "Sem responsável"}
                      {equipe.centro_custo ? ` · CC: ${equipe.centro_custo}` : ""}
                      {` · ${membrosEquipe.length} funcionário(s)`}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => openEdit(equipe)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                  title="Editar equipe"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDeletar(equipe)}
                  disabled={deletando === equipe.id}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                  title="Excluir equipe"
                >
                  {deletando === equipe.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                    : <Trash2 className="w-4 h-4 text-destructive" />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-1 bg-muted/10">
                  {membrosEquipe.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum membro nesta equipe.</p>
                  ) : (
                    membrosEquipe
                      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                      .map(m => (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white border border-border px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {m.matricula ? `Mat. ${m.matricula} · ` : ""}
                              {(m.funcoes as any)?.nome || m.role || ""}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modal Nova/Editar Equipe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">{modalMode === "edit" ? "Editar Equipe" : "Nova Equipe"}</h3>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nome da Equipe *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: CBUQ05 - JOAO"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Responsável</label>
                <select
                  value={form.responsavel}
                  onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Selecione —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Centro de Custo</label>
                <select
                  value={form.centro_custo}
                  onChange={e => setForm(p => ({ ...p, centro_custo: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Selecione —</option>
                  {centrosCusto.map(cc => (
                    <option key={cc.id} value={cc.nome}>{cc.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando || !form.nome.trim()}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : modalMode === "edit" ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {modalMode === "edit" ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

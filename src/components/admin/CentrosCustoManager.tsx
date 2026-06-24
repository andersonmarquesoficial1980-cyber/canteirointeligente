import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface CentroCusto {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export default function CentrosCustoManager() {
  const { toast } = useToast();
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialog, setDialog] = useState<{ open: boolean; mode: "new" | "edit" }>({ open: false, mode: "new" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("ci_centros_custo")
      .select("id, nome, ativo, created_at")
      .order("nome");
    if (error) {
      toast({ title: "Erro ao carregar centros de custo", description: error.message, variant: "destructive" });
    } else {
      setCentros(data || []);
    }
    setLoading(false);
  }

  function openNew() {
    setNome("");
    setEditingId(null);
    setDialog({ open: true, mode: "new" });
  }

  function openEdit(cc: CentroCusto) {
    setNome(cc.nome);
    setEditingId(cc.id);
    setDialog({ open: true, mode: "edit" });
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    let error;
    if (dialog.mode === "edit" && editingId) {
      ({ error } = await (supabase as any)
        .from("ci_centros_custo")
        .update({ nome: nome.trim().toUpperCase() })
        .eq("id", editingId));
    } else {
      ({ error } = await (supabase as any)
        .from("ci_centros_custo")
        .insert({ nome: nome.trim().toUpperCase(), ativo: true }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: dialog.mode === "edit" ? "Centro de Custo atualizado!" : "Centro de Custo criado!" });
    setDialog(p => ({ ...p, open: false }));
    load();
  }

  async function handleExcluir(cc: CentroCusto) {
    if (!window.confirm(`Excluir "${cc.nome}" permanentemente?\n\nEssa ação não pode ser desfeita.`)) return;
    setDeleting(cc.id);
    const { error } = await (supabase as any).from("ci_centros_custo").delete().eq("id", cc.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Centro de Custo excluído" });
      load();
    }
    setDeleting(null);
  }

  async function handleToggleAtivo(cc: CentroCusto) {
    const { error } = await (supabase as any)
      .from("ci_centros_custo")
      .update({ ativo: !cc.ativo })
      .eq("id", cc.id);
    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } else {
      setCentros(prev => prev.map(c => c.id === cc.id ? { ...c, ativo: !c.ativo } : c));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando centros de custo...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-1.5 rounded-xl">
          <Plus className="w-4 h-4" /> Novo Centro de Custo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{centros.length} centro(s) de custo</p>

      <div className="space-y-2">
        {centros.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum centro de custo cadastrado. Crie o primeiro acima.
          </div>
        ) : (
          centros.map(cc => (
            <div key={cc.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={cc.ativo}
                  onCheckedChange={() => handleToggleAtivo(cc)}
                  aria-label={cc.ativo ? "Desativar" : "Ativar"}
                />
                <div>
                  <p className="text-sm font-medium">{cc.nome}</p>
                  <p className="text-xs text-muted-foreground">{cc.ativo ? "Ativo" : "Inativo"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(cc)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleExcluir(cc)}
                  disabled={deleting === cc.id}
                >
                  {deleting === cc.id
                    ? <span className="w-4 h-4 inline-block animate-spin border-2 border-destructive border-t-transparent rounded-full" />
                    : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "new" ? "Novo Centro de Custo" : "Editar Centro de Custo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: OPERACIONAL DE OBRAS"
                className="h-10 rounded-xl"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSalvar()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(p => ({ ...p, open: false }))}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={saving || !nome.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {dialog.mode === "new" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

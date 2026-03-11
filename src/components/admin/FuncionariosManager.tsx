import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Search } from "lucide-react";

interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
}

export default function FuncionariosManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<Funcionario[]>([]);
  const [search, setSearch] = useState("");
  const [filterFuncao, setFilterFuncao] = useState("TODAS");

  // Add form
  const [matricula, setMatricula] = useState("");
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editFuncao, setEditFuncao] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("funcionarios" as any)
      .select("*")
      .order("nome", { ascending: true });
    if (data) setItems(data as any as Funcionario[]);
  };

  useEffect(() => { load(); }, []);

  const funcoes = useMemo(() =>
    [...new Set(items.map(f => f.funcao))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items]
  );

  const filtered = useMemo(() => {
    let list = items;
    if (filterFuncao !== "TODAS") {
      list = list.filter(f => f.funcao === filterFuncao);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f => f.nome.toLowerCase().includes(s) || f.matricula.includes(s));
    }
    return list;
  }, [items, filterFuncao, search]);

  const handleAdd = async () => {
    if (!matricula.trim() || !nome.trim() || !funcao.trim()) {
      toast({ title: "Atenção", description: "Preencha Matrícula, Nome e Função.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("funcionarios" as any).insert({
      matricula: matricula.trim(),
      nome: nome.trim().toUpperCase(),
      funcao: funcao.trim().toUpperCase(),
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Funcionário adicionado!" });
    setMatricula(""); setNome(""); setFuncao("");
    await load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("funcionarios" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Removido!" });
    await load();
  };

  const openEdit = (f: Funcionario) => {
    setEditing(f);
    setEditNome(f.nome);
    setEditFuncao(f.funcao);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editNome.trim() || !editFuncao.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("funcionarios" as any)
      .update({ nome: editNome.trim().toUpperCase(), funcao: editFuncao.trim().toUpperCase() } as any)
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Atualizado!" });
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Adicionar Funcionário</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Matrícula *</Label>
            <Input value={matricula} onChange={e => setMatricula(e.target.value)} className="h-11 bg-secondary border-border" placeholder="001234" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="NOME COMPLETO" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Função *</Label>
          <Input value={funcao} onChange={e => setFuncao(e.target.value)} className="h-11 bg-secondary border-border" placeholder="AJUDANTE GERAL" />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      {/* Search & filter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9 bg-secondary border-border" placeholder="Buscar..." />
        </div>
        <Select value={filterFuncao} onValueChange={setFilterFuncao}>
          <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[250px]">
            <SelectItem value="TODAS">Todas as funções</SelectItem>
            {funcoes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} funcionário(s)</p>

      {/* List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.map(f => (
          <div key={f.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-foreground truncate">{f.nome}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{f.matricula}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{f.funcao}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => openEdit(f)} className="text-muted-foreground hover:text-foreground p-1.5">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(f.id)} className="text-destructive p-1.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário encontrado.</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matrícula</Label>
              <Input value={editing?.matricula || ""} disabled className="h-11 bg-muted border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Função</Label>
              <Input value={editFuncao} onChange={e => setEditFuncao(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full h-11">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

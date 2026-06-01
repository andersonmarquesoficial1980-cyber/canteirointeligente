import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Search } from "lucide-react";

interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  status: string;
}

export default function FuncionariosManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<Funcionario[]>([]);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editFuncao, setEditFuncao] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, matricula, name, role, status")
      .order("name", { ascending: true });
    if (data) setItems(data.map((f: any) => ({ id: f.id, matricula: f.matricula ?? "", nome: f.name, funcao: f.role ?? "", status: f.status })));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(f =>
      !q || f.nome.toLowerCase().includes(q) || f.funcao.toLowerCase().includes(q) || f.matricula?.includes(q)
    );
  }, [items, search]);

  const openEdit = (f: Funcionario) => {
    setEditing(f);
    setEditNome(f.nome);
    setEditFuncao(f.funcao);
  };

  const saveEdit = async () => {
    if (!editing || !editNome.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("employees")
      .update({ name: editNome.trim().toUpperCase(), role: editFuncao.trim().toUpperCase() })
      .eq("id", editing.id);
    if (!error) {
      toast({ title: "Funcionário atualizado!" });
      setEditing(null);
      load();
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Funcionários são gerenciados em <strong>Gestão de Pessoas</strong>. Aqui você pode consultar e editar nome/função.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-10 rounded-xl" />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} funcionário(s)</p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.map(f => (
          <div key={f.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2">
            <div>
              <p className="text-sm font-medium">{f.nome}</p>
              <p className="text-xs text-muted-foreground">{f.funcao} {f.matricula ? `· Mat. ${f.matricula}` : ""}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Funcionário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label>
                <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-10 rounded-xl mt-1" />
              </div>
              <div><Label className="text-xs">Função</Label>
                <Input value={editFuncao} onChange={e => setEditFuncao(e.target.value)} className="h-10 rounded-xl mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

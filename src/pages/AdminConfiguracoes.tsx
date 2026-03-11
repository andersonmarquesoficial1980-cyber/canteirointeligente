import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import FuncionariosManager from "@/components/admin/FuncionariosManager";

const VINCULO_OPTIONS = ["CAUQ", "INFRA", "CANTEIRO", "TODOS"];
const TIPO_USO_OPTIONS = ["Nota Fiscal", "Transporte", "Ambos"];
const CATEGORIAS_EQUIP = ["PEQUENO PORTE", "FRESA/BOB", "VIBRO/ROLO", "LINHA AMARELA", "USINAGEM", "VEÍCULOS EM GERAL"];

// Generic CRUD hook for simple tables
function useCrudTable(tableName: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(tableName as any).select("*").order("created_at", { ascending: false });
    if (!error && data) setItems(data as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (item: any) => {
    console.log(`[CRUD] Tentando adicionar em "${tableName}":`, item);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", description: "Faça login novamente para continuar.", variant: "destructive" });
        return false;
      }
      const { error } = await supabase.from(tableName as any).insert(item);
      if (error) {
        console.error(`[CRUD] Erro ao inserir em "${tableName}":`, error);
        toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
        return false;
      }
      console.log(`[CRUD] Inserido com sucesso em "${tableName}"`);
      toast({ title: "✅ Adicionado com sucesso!" });
      await load();
      return true;
    } catch (err: any) {
      console.error(`[CRUD] Exceção em "${tableName}":`, err);
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from(tableName as any).delete().eq("id", id);
      if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Removido!" });
      await load();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
  };

  return { items, loading, add, remove, reload: load };
}

// Simple entity form with nome + vinculo_rdo
function EntityManager({ tableName, label }: { tableName: string; label: string }) {
  const { items, add, remove } = useCrudTable(tableName);
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!nome.trim()) { 
      toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); 
      return; 
    }
    const ok = await add({ nome: nome.trim(), vinculo_rdo: vinculo });
    if (ok) { setNome(""); setVinculo("TODOS"); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder={`Novo ${label}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
          <Select value={vinculo} onValueChange={setVinculo}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.vinculo_rdo}</span>
            </div>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>}
      </div>
    </div>
  );
}

// Machines manager (includes frota, categoria, vinculo_rdo)
function MaquinasManager() {
  const { items, add, remove } = useCrudTable("maquinas_frota");
  const { toast } = useToast();
  const [frota, setFrota] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!frota.trim() || !nome.trim()) {
      toast({ title: "Atenção", description: "Preencha Frota e Nome.", variant: "destructive" });
      return;
    }
    const ok = await add({ frota: frota.trim(), nome: nome.trim(), tipo: tipo.trim(), categoria, empresa: empresa.trim(), vinculo_rdo: vinculo, status: "ativo" });
    if (ok) { setFrota(""); setNome(""); setTipo(""); setCategoria(""); setEmpresa(""); setVinculo("TODOS"); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Frota *</Label>
            <Input value={frota} onChange={e => setFrota(e.target.value)} className="h-11 bg-secondary border-border" placeholder="FA12" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome/Modelo *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="WIRTGEN W200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Input value={tipo} onChange={e => setTipo(e.target.value)} className="h-11 bg-secondary border-border" placeholder="FRESADORA" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Input value={empresa} onChange={e => setEmpresa(e.target.value)} className="h-11 bg-secondary border-border" placeholder="PRÓPRIO" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{CATEGORIAS_EQUIP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
            <Select value={vinculo} onValueChange={setVinculo}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Máquina</Button>
      </div>

      <div className="space-y-2">
        {items.map((m: any) => (
          <div key={m.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{m.frota} — {m.tipo || m.categoria} ({m.nome})</p>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{m.categoria}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{m.vinculo_rdo || "TODOS"}</span>
              </div>
            </div>
            <button onClick={() => remove(m.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Email config
function EmailConfig() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<string[]>([""]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes_relatorio").select("*").limit(1).single().then(({ data }) => {
      if (data) {
        setConfigId(data.id);
        const arr = (data.emails_destino as string[]) || [];
        setEmails(arr.length > 0 ? arr : [""]);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const validEmails = emails.filter(e => e.trim().length > 0);
    try {
      if (configId) {
        const { error } = await supabase.from("configuracoes_relatorio").update({ emails_destino: validEmails, updated_at: new Date().toISOString() }).eq("id", configId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configuracoes_relatorio").insert({ emails_destino: validEmails });
        if (error) throw error;
      }
      toast({ title: "✅ E-mails salvos!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm text-muted-foreground">E-mails que receberão o relatório ao enviar um RDO.</p>
        {emails.map((email, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail {idx + 1}</Label>
              <Input type="email" value={email} onChange={e => { const u = [...emails]; u[idx] = e.target.value; setEmails(u); }} className="h-11 bg-secondary border-border" placeholder="exemplo@empresa.com.br" />
            </div>
            {emails.length > 1 && (
              <button onClick={() => setEmails(emails.filter((_, i) => i !== idx))} className="text-destructive p-2 mt-5"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={() => setEmails([...emails, ""])} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar E-mail</Button>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base gap-2 font-semibold">
        <Save className="w-5 h-5" /> {saving ? "Salvando..." : "Salvar E-mails"}
      </Button>
    </div>
  );
}

// Users manager
function UsersManager() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState("Apontador");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setUsers(data as any[]);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const response = await supabase.functions.invoke("create-user", {
        body: { email: email.trim(), password, nome_completo: nome.trim(), perfil },
      });
      const { data: result, error: invokeError } = response;
      if (invokeError) {
        let msg = "Erro ao criar usuário";
        if (result?.error) msg = result.error;
        else if (typeof invokeError === "object" && invokeError.message) {
          try { const parsed = JSON.parse(invokeError.message); if (parsed?.error) msg = parsed.error; } catch { msg = invokeError.message; }
        }
        throw new Error(msg);
      }
      if (result?.error) throw new Error(result.error);
      toast({ title: "✅ Usuário cadastrado com sucesso!" });
      setNome(""); setEmail(""); setPassword(""); setPerfil("Apontador");
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setEditNome(u.nome_completo);
    setEditPerfil(u.perfil);
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const body: any = { action: "update", user_id: editing.user_id };
      if (editNome.trim() && editNome !== editing.nome_completo) body.nome_completo = editNome.trim();
      if (editPerfil && editPerfil !== editing.perfil) body.perfil = editPerfil;
      if (editPassword.trim()) body.password = editPassword;

      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", { body });
      if (invokeError || result?.error) throw new Error(result?.error || invokeError?.message || "Erro ao atualizar");

      toast({ title: "✅ Usuário atualizado!" });
      setEditing(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSavingEdit(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: { action: "delete", user_id: deleting.user_id },
      });
      if (invokeError || result?.error) throw new Error(result?.error || invokeError?.message || "Erro ao excluir");

      toast({ title: "✅ Usuário excluído!" });
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setDeletingLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Criar Novo Usuário</p>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome Completo *</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Nome do funcionário" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">E-mail *</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 bg-secondary border-border" placeholder="email@empresa.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Mínimo 6 caracteres" minLength={6} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrador">Administrador</SelectItem>
              <SelectItem value="Apontador">Apontador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="w-full h-11 gap-2">
          <Plus className="w-4 h-4" /> {creating ? "Criando..." : "Criar Usuário"}
        </Button>
      </div>

      <p className="text-sm font-semibold text-foreground">Usuários Cadastrados</p>
      <div className="space-y-2">
        {users.map((u: any) => (
          <div key={u.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-foreground truncate">{u.nome_completo}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{u.perfil}</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-foreground p-1.5">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleting(u)} className="text-destructive p-1.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input value={editing?.email || ""} disabled className="h-11 bg-muted border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
              <Select value={editPerfil} onValueChange={setEditPerfil}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Apontador">Apontador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nova Senha (deixe vazio para manter)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full h-11">
              {savingEdit ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome_completo}</strong> ({deleting?.email})? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletingLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// OGS Manager
function OgsManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [numero, setNumero] = useState("");
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");

  const load = async () => {
    const { data } = await supabase.from("ogs_reference").select("*").order("numero_ogs", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!numero.trim() || !cliente.trim() || !endereco.trim()) {
      toast({ title: "Atenção", description: "Preencha OGS, Cliente e Endereço.", variant: "destructive" });
      return;
    }
    console.log("[OGS] Tentando adicionar:", { numero, cliente, endereco });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("ogs_reference").insert({ numero_ogs: numero.trim(), cliente: cliente.trim(), endereco: endereco.trim() } as any);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      setEndereco("");
      toast({ title: "✅ Endereço adicionado!" });
      await load();
    } catch (err: any) {
      console.error("[OGS] Exceção:", err);
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("ogs_reference").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Adicione endereços a uma OGS. Uma mesma OGS pode ter vários endereços.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nº OGS</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} className="h-11 bg-secondary border-border" placeholder="OGS-001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Input value={cliente} onChange={e => setCliente(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Nome do Cliente" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Endereço / Rua</Label>
          <Input value={endereco} onChange={e => setEndereco(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Rua X, Trecho Y" />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Endereço</Button>
      </div>

      <div className="space-y-2">
        {items.map((o: any) => (
          <div key={o.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{o.numero_ogs} — {o.cliente}</p>
              <p className="text-xs text-muted-foreground">{o.endereco}</p>
            </div>
            <button onClick={() => handleDelete(o.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Material manager with tipo_uso
function MaterialManager() {
  const { items, add, remove } = useCrudTable("materiais");
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");
  const [tipoUso, setTipoUso] = useState("Nota Fiscal");

  const handleAdd = async () => {
    if (!nome.trim()) {
      toast({ title: "Atenção", description: "Preencha o nome do material.", variant: "destructive" });
      return;
    }
    const ok = await add({ nome: nome.trim(), vinculo_rdo: vinculo, tipo_uso: tipoUso });
    if (ok) { setNome(""); setVinculo("TODOS"); setTipoUso("Nota Fiscal"); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Novo Material" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
            <Select value={vinculo} onValueChange={setVinculo}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de Uso</Label>
            <Select value={tipoUso} onValueChange={setTipoUso}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_USO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.vinculo_rdo}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{item.tipo_uso || "Nota Fiscal"}</span>
              </div>
            </div>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>}
      </div>
    </div>
  );
}

export default function AdminConfiguracoes() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin) { navigate("/"); return null; }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">⚙️ Gerenciamento</h1>
            <p className="text-xs text-muted-foreground">Administração Centralizada</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4">
        <Tabs defaultValue="maquinas" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary p-1 rounded-xl">
            <TabsTrigger value="maquinas" className="text-xs flex-1 min-w-[80px]">Máquinas</TabsTrigger>
            <TabsTrigger value="funcionarios" className="text-xs flex-1 min-w-[80px]">Funcionários</TabsTrigger>
            <TabsTrigger value="tipos_servico" className="text-xs flex-1 min-w-[80px]">Serviços</TabsTrigger>
            <TabsTrigger value="materiais" className="text-xs flex-1 min-w-[80px]">Materiais</TabsTrigger>
            <TabsTrigger value="empreiteiros" className="text-xs flex-1 min-w-[80px]">Empreiteiros</TabsTrigger>
            <TabsTrigger value="fornecedores" className="text-xs flex-1 min-w-[80px]">Fornecedores</TabsTrigger>
            <TabsTrigger value="usinas" className="text-xs flex-1 min-w-[80px]">Usinas</TabsTrigger>
            <TabsTrigger value="ogs" className="text-xs flex-1 min-w-[80px]">OGS</TabsTrigger>
            <TabsTrigger value="usuarios" className="text-xs flex-1 min-w-[80px]">Usuários</TabsTrigger>
            <TabsTrigger value="emails" className="text-xs flex-1 min-w-[80px]">E-mails</TabsTrigger>
          </TabsList>

          <TabsContent value="maquinas"><MaquinasManager /></TabsContent>
          <TabsContent value="funcionarios"><FuncionariosManager /></TabsContent>
          <TabsContent value="tipos_servico"><EntityManager tableName="tipos_servico" label="Tipo de Serviço" /></TabsContent>
          <TabsContent value="materiais"><MaterialManager /></TabsContent>
          <TabsContent value="empreiteiros"><EntityManager tableName="empreiteiros" label="Empreiteiro" /></TabsContent>
          <TabsContent value="fornecedores"><EntityManager tableName="fornecedores" label="Fornecedor" /></TabsContent>
          <TabsContent value="usinas"><EntityManager tableName="usinas" label="Usina" /></TabsContent>
          <TabsContent value="ogs"><OgsManager /></TabsContent>
          <TabsContent value="usuarios"><UsersManager /></TabsContent>
          <TabsContent value="emails"><EmailConfig /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

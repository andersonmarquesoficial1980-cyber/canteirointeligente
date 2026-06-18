import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Search, Eye, EyeOff, FileSpreadsheet, LogIn, UserMinus, UserCheck, Loader2 } from "lucide-react";
import { startImpersonation } from "@/hooks/useImpersonation";
import { Badge } from "@/components/ui/badge";

const LOGIN_DOMAIN = "@workflux.app";

const PERFIL_PERMISSIONS: Record<string, Record<string, boolean>> = {
  "Administrador":      { is_admin: true,  modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: true,  modulo_carreteiros: true,  modulo_programador: true,  modulo_demandas: true,  modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: true,  modulo_relatorios: true,  modulo_dashboard: true  },
  "Gerente":            { is_admin: true,  modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: true,  modulo_carreteiros: true,  modulo_programador: false, modulo_demandas: true,  modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: true,  modulo_relatorios: true,  modulo_dashboard: true  },
  "Engenheiro":         { is_admin: false, modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: true,  modulo_dashboard: false },
  "Segurança":          { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: true,  modulo_relatorios: false, modulo_dashboard: false },
  "Manutenção":         { is_admin: false, modulo_obras: false, modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
  "Gestão de Pessoas":  { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: true,  modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
  "Gestão de Frotas":   { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: false, modulo_carreteiros: true,  modulo_programador: false, modulo_demandas: true,  modulo_manutencao: false, modulo_abastecimento: true,  modulo_documentos: false, modulo_relatorios: true,  modulo_dashboard: false },
  "Apontador":          { is_admin: false, modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
  "Operador":           { is_admin: false, modulo_obras: false, modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
  "Usuário":            { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
};

export default function UsersManager() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState("Apontador");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deactivating, setDeactivating] = useState<any | null>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [togglingExport, setTogglingExport] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("nome_completo", { ascending: true });
    if (data) setUsers(data as any[]);
  };

  useEffect(() => { load(); }, []);

  const filteredUsers = users
    .filter(u => showInactive ? true : u.status !== "inativo")
    .filter(u => {
      if (!buscaUsuario.trim()) return true;
      const q = buscaUsuario.toLowerCase();
      return (
        (u.nome_completo || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.perfil || "").toLowerCase().includes(q)
      );
    });

  const handleCreate = async () => {
    if (!nome.trim() || !login.trim() || !password.trim()) {
      toast({ title: "Preencha nome, login e senha", variant: "destructive" });
      return;
    }
    setCreating(true);
    const loginValue = login.trim().toLowerCase();
    const authEmail = loginValue.includes("@") ? loginValue : `${loginValue}${LOGIN_DOMAIN}`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: { email: authEmail, password, nome_completo: nome.trim(), perfil, login_original: loginValue },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (invokeError || result?.error) throw new Error(result?.error || invokeError?.message || "Erro ao criar usuário");

      const newUserId = result?.user_id;
      if (newUserId && PERFIL_PERMISSIONS[perfil]) {
        await supabase.from("user_permissions").upsert({
          user_id: newUserId,
          ...PERFIL_PERMISSIONS[perfil],
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      toast({ title: "✅ Usuário criado!", description: `${nome.trim()} (${authEmail})` });
      setNome(""); setLogin(""); setPassword(""); setPerfil("Apontador");
      await load();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleToggleExport = async (u: any) => {
    setTogglingExport(u.user_id);
    const newVal = !u.can_export;
    const { error } = await supabase.from("profiles").update({ can_export: newVal } as any).eq("user_id", u.user_id);
    if (!error) {
      toast({ title: newVal ? "✅ Exportação liberada" : "🔒 Exportação bloqueada", description: u.nome_completo });
      await load();
    } else {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setTogglingExport(null);
  };

  const handleUnlock = async (userId: string, email: string) => {
    setUnlocking(userId);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: { action: "unlock", user_id: userId },
      });
      if (invokeError || result?.error) throw new Error(result?.error || invokeError?.message || "Erro ao desbloquear");
      toast({ title: "✅ Usuário desbloqueado!", description: `${email} pode fazer login novamente.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setUnlocking(null); }
  };

  const handleImpersonate = async (u: any) => {
    if (!window.confirm(`Entrar como "${u.nome_completo}"?\n\nVocê verá o sistema exatamente como esse usuário. Um banner amarelo ficará visível para voltar ao admin.`)) return;
    setImpersonating(u.user_id);
    try {
      const result = await startImpersonation(u.user_id, u.nome_completo, u.email || "");
      if (!result.success) {
        toast({ title: "Erro ao entrar como usuário", description: result.error, variant: "destructive" });
        setImpersonating(null);
        return;
      }
      window.location.replace("/");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setImpersonating(null);
    }
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setEditNome(u.nome_completo);
    setEditEmail(u.email || "");
    setEditPerfil(u.perfil || "Apontador");
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      // 1. Atualizar nome e perfil diretamente no profiles
      const profileUpdate: any = {};
      if (editNome.trim()) profileUpdate.nome_completo = editNome.trim();
      if (editPerfil) profileUpdate.perfil = editPerfil;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", editing.user_id);
        if (profileError) throw new Error(profileError.message);
      }

      // 2. Trocar senha se informada (usa admin-reset-password)
      if (editPassword.trim()) {
        if (editPassword.trim().length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres");
        const { data: resetResult, error: resetError } = await supabase.functions.invoke("admin-reset-password", {
          body: { user_id: editing.user_id, new_password: editPassword.trim() },
        });
        if (resetError || resetResult?.error) throw new Error(resetResult?.error || resetError?.message || "Erro ao trocar senha");
      }

      // 3. Atualizar permissões conforme novo perfil
      if (PERFIL_PERMISSIONS[editPerfil]) {
        await supabase.from("user_permissions").upsert({
          user_id: editing.user_id,
          ...PERFIL_PERMISSIONS[editPerfil],
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      toast({ title: "✅ Usuário atualizado!" });
      setEditing(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSavingEdit(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivating) return;
    setDeactivatingLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && deactivating.user_id === user.id) {
        toast({ title: "Bloqueado", description: "Você não pode desativar sua própria conta.", variant: "destructive" });
        setDeactivating(null);
        setDeactivatingLoading(false);
        return;
      }
      if (!deactivating.id) {
        toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" });
        setDeactivating(null);
        setDeactivatingLoading(false);
        return;
      }
      const newStatus = deactivating.status === "inativo" ? "ativo" : "inativo";
      const { error } = await supabase.from("profiles").update({ status: newStatus } as any).eq("id", deactivating.id);
      if (error) throw error;
      toast({ title: newStatus === "inativo" ? "✅ Usuário desativado!" : "✅ Usuário reativado!" });
      setDeactivating(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setDeactivatingLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Formulário de criação */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Criar Novo Usuário</p>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome Completo *</Label>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="h-11 bg-secondary border-border"
            placeholder="Nome do funcionário"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Login (usuário) *</Label>
          <Input
            type="text"
            value={login}
            onChange={e => setLogin(e.target.value)}
            className="h-11 bg-secondary border-border"
            placeholder="usuario ou email@empresa.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-11 bg-secondary border-border pr-10"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrador">Administrador</SelectItem>
              <SelectItem value="Gerente">Gerente</SelectItem>
              <SelectItem value="Engenheiro">Engenheiro</SelectItem>
              <SelectItem value="Segurança">Segurança</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Gestão de Pessoas">Gestão de Pessoas</SelectItem>
              <SelectItem value="Gestão de Frotas">Gestão de Frotas</SelectItem>
              <SelectItem value="Apontador">Apontador</SelectItem>
              <SelectItem value="Operador">Operador / Motorista</SelectItem>
              <SelectItem value="Usuário">Usuário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="w-full h-11 gap-2">
          <Plus className="w-4 h-4" /> {creating ? "Criando..." : "Criar Usuário"}
        </Button>
      </div>

      {/* Cabeçalho lista */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Usuários Cadastrados <span className="text-muted-foreground font-normal">({filteredUsers.length})</span></p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Mostrar Desativados
        </label>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={buscaUsuario} onChange={e => setBuscaUsuario(e.target.value)} placeholder="Buscar usuário..." className="pl-9 h-10 rounded-xl" />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filteredUsers.map(u => {
          const isInactive = u.status === "inativo";
          return (
            <div key={u.user_id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${isInactive ? "opacity-50 bg-muted border-border" : "bg-card border-border"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.nome_completo}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.perfil || "—"}</Badge>
                  {u.can_export && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Export</Badge>}
                  {isInactive && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inativo</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-foreground p-1.5" title="Editar usuário">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleExport(u)}
                  disabled={togglingExport === u.user_id}
                  className={u.can_export ? "text-green-600 hover:text-green-700 p-1.5" : "text-muted-foreground hover:text-foreground p-1.5"}
                  title={u.can_export ? "Exportação liberada (clique pra bloquear)" : "Liberar exportação PDF/Excel"}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleUnlock(u.user_id, u.email || u.nome_completo)}
                  disabled={unlocking === u.user_id}
                  className="text-amber-500 hover:text-amber-600 p-1.5"
                  title="Desbloquear usuário"
                >
                  {unlocking === u.user_id
                    ? <span className="w-4 h-4 inline-block animate-spin border-2 border-amber-500 border-t-transparent rounded-full" />
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                  }
                </button>
                <button
                  onClick={() => handleImpersonate(u)}
                  disabled={impersonating === u.user_id}
                  className="text-blue-500 hover:text-blue-600 p-1.5"
                  title="Entrar como este usuário"
                >
                  {impersonating === u.user_id
                    ? <span className="w-4 h-4 inline-block animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />
                    : <LogIn className="w-4 h-4" />}
                </button>
                <button onClick={() => setDeactivating(u)} className={isInactive ? "text-green-600 p-1.5" : "text-destructive p-1.5"} title={isInactive ? "Reativar" : "Desativar"}>
                  {isInactive ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
        {filteredUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>}
      </div>

      {/* Dialog editar */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-11 bg-secondary border-border" placeholder="novo@email.com" />
              {editEmail.trim().toLowerCase() !== (editing?.email || "").toLowerCase() && editEmail.trim() && (
                <p className="text-[10px] text-yellow-600">⚠️ E-mail será alterado de <strong>{editing?.email}</strong> para <strong>{editEmail}</strong></p>
              )}
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
                  <SelectItem value="Gerente">Gerente</SelectItem>
                  <SelectItem value="Engenheiro">Engenheiro</SelectItem>
                  <SelectItem value="Segurança">Segurança</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Gestão de Pessoas">Gestão de Pessoas</SelectItem>
                  <SelectItem value="Gestão de Frotas">Gestão de Frotas</SelectItem>
                  <SelectItem value="Apontador">Apontador</SelectItem>
                  <SelectItem value="Operador">Operador / Motorista</SelectItem>
                  <SelectItem value="Usuário">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nova Senha (deixe em branco para manter)</Label>
              <div className="relative">
                <Input type={showEditPwd ? "text" : "password"} value={editPassword} onChange={e => setEditPassword(e.target.value)} className="h-11 bg-secondary border-border pr-10" placeholder="Nova senha" autoComplete="new-password" />
                <button type="button" onClick={() => setShowEditPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog desativar */}
      <AlertDialog open={!!deactivating} onOpenChange={open => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deactivating?.status === "inativo" ? "Reativar usuário?" : "Desativar usuário?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.status === "inativo"
                ? `${deactivating?.nome_completo} voltará a ter acesso ao sistema.`
                : `${deactivating?.nome_completo} perderá o acesso ao sistema. Você pode reativar depois.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivatingLoading}>
              {deactivatingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (deactivating?.status === "inativo" ? "Reativar" : "Desativar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

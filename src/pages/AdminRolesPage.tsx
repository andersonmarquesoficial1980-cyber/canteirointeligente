import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  ADMIN_PANEL_SECTIONS,
  ADMIN_PERMISSION_ACTIONS,
  adminSectionResource,
} from "@/lib/adminRoles";

// Types
interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AdminPermission {
  id: string;
  role_id: string;
  resource: string;
  action: string;
  is_sector_scoped: boolean | null;
  sector_filter: string | null;
  created_at: string | null;
}

interface UserAdminRole {
  id: string;
  employee_id: string;
  role_id: string;
  scope_sector: string | null;
  scope_obra: string | null;
  is_active: boolean | null;
  assigned_at: string | null;
  assigned_by: string | null;
  revoked_at: string | null;
  company_id: string | null;
}

interface Profile {
  user_id: string;
  email: string;
  nome_completo: string | null;
  company_id: string | null;
}

// Abas de Roles
function RolesTab() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", is_system_role: false, active: true });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("admin_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(`Erro ao carregar roles: ${error.message}`);
      } else {
        setRoles(data || []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleOpenDialog = (role?: AdminRole) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        is_system_role: role.is_system_role || false,
        active: role.active ?? true,
      });
    } else {
      setEditingRole(null);
      setFormData({ name: "", description: "", is_system_role: false, active: true });
    }
    setIsDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingRole) {
        const { error } = await supabase
          .from("admin_roles")
          .update({
            name: formData.name,
            description: formData.description || null,
            is_system_role: formData.is_system_role,
            active: formData.active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRole.id);

        if (error) throw error;
        toast.success("Role atualizado com sucesso");
      } else {
        const { error } = await supabase.from("admin_roles").insert({
          name: formData.name,
          description: formData.description || null,
          is_system_role: formData.is_system_role,
          active: formData.active,
        });

        if (error) throw error;
        toast.success("Role criado com sucesso");
      }

      setIsDialogOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar role");
    }
  };

  const handleDeleteRole = async (id: string) => {
    const role = roles.find((r) => r.id === id);
    if (role?.is_system_role) {
      toast.error("Roles de sistema não podem ser excluídos");
      setDeleteConfirm(null);
      return;
    }

    try {
      const { error } = await supabase.from("admin_roles").delete().eq("id", id);

      if (error) throw error;
      toast.success("Role deletado com sucesso");
      setDeleteConfirm(null);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao deletar role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Roles</h2>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novo Role
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Nenhum role criado ainda
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Role</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Sistema</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-semibold">{role.name}</TableCell>
                  <TableCell className="text-sm">{role.description || "-"}</TableCell>
                  <TableCell>{role.is_system_role ? "✓" : "✗"}</TableCell>
                  <TableCell>{role.active ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {role.created_at ? new Date(role.created_at).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(role)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!role.is_system_role}
                      title={role.is_system_role ? "Role de sistema não pode ser excluído" : "Excluir role"}
                      onClick={() => {
                        if (role.is_system_role) {
                          toast.error("Roles de sistema não podem ser excluídos");
                          return;
                        }
                        setDeleteConfirm(role.id);
                      }}
                    >
                      <Trash2 className={`w-4 h-4 ${role.is_system_role ? "text-gray-300" : "text-red-500"}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar Role" : "Criar Novo Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Atualize os dados do role" : "Preencha os dados do novo role"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Administrador"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Acesso total ao sistema"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_system_role"
                checked={formData.is_system_role}
                onChange={(e) => setFormData({ ...formData, is_system_role: e.target.checked })}
              />
              <Label htmlFor="is_system_role">É um Role de Sistema</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <Label htmlFor="active">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Role</AlertDialogTitle>
            <AlertDialogDescription>
              {roles.find((r) => r.id === deleteConfirm)?.is_system_role
                ? "Este é um role de sistema e não pode ser excluído."
                : "Tem certeza que deseja deletar este role? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!roles.find((r) => r.id === deleteConfirm)?.is_system_role}
              onClick={() => {
                if (deleteConfirm) handleDeleteRole(deleteConfirm);
              }}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:hover:bg-gray-400"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Abas de Permissões
function PermissionsTab() {
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<AdminPermission | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    role_id: "",
    resource: "",
    action: "",
    is_sector_scoped: false,
    sector_filter: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [permissionsRes, rolesRes] = await Promise.all([
        supabase
          .from("admin_permissions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("admin_roles").select("*"),
      ]);

      if (permissionsRes.error) throw permissionsRes.error;
      if (rolesRes.error) throw rolesRes.error;

      setPermissions(permissionsRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (permission?: AdminPermission) => {
    if (permission) {
      setEditingPermission(permission);
      setFormData({
        role_id: permission.role_id,
        resource: permission.resource,
        action: permission.action,
        is_sector_scoped: permission.is_sector_scoped || false,
        sector_filter: permission.sector_filter || "",
      });
    } else {
      setEditingPermission(null);
      setFormData({ role_id: "", resource: "", action: "", is_sector_scoped: false, sector_filter: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSavePermission = async () => {
    if (!formData.role_id || !formData.resource || !formData.action) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      if (editingPermission) {
        const { error } = await supabase
          .from("admin_permissions")
          .update({
            role_id: formData.role_id,
            resource: formData.resource,
            action: formData.action,
            is_sector_scoped: formData.is_sector_scoped,
            sector_filter: formData.is_sector_scoped ? formData.sector_filter : null,
          })
          .eq("id", editingPermission.id);

        if (error) throw error;
        toast.success("Permissão atualizada com sucesso");
      } else {
        const { error } = await supabase.from("admin_permissions").insert({
          role_id: formData.role_id,
          resource: formData.resource,
          action: formData.action,
          is_sector_scoped: formData.is_sector_scoped,
          sector_filter: formData.is_sector_scoped ? formData.sector_filter : null,
        });

        if (error) throw error;
        toast.success("Permissão criada com sucesso");
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar permissão");
    }
  };

  const handleDeletePermission = async (id: string) => {
    try {
      const { error } = await supabase.from("admin_permissions").delete().eq("id", id);

      if (error) throw error;
      toast.success("Permissão deletada com sucesso");
      setDeleteConfirm(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao deletar permissão");
    }
  };

  const getRoleName = (roleId: string) => {
    return roles.find((r) => r.id === roleId)?.name || roleId;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Permissões</h2>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Permissão
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : permissions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Nenhuma permissão criada ainda
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Scoped</TableHead>
                <TableHead>Filtro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-semibold">{getRoleName(perm.role_id)}</TableCell>
                  <TableCell>{perm.resource}</TableCell>
                  <TableCell>{perm.action}</TableCell>
                  <TableCell>{perm.is_sector_scoped ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{perm.sector_filter || "-"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(perm)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirm(perm.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPermission ? "Editar Permissão" : "Criar Nova Permissão"}</DialogTitle>
            <DialogDescription>
              {editingPermission ? "Atualize a permissão" : "Crie uma nova permissão para um role"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="role_id">Role *</Label>
              <select
                id="role_id"
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="resource">Recurso *</Label>
              <select
                id="resource"
                value={formData.resource}
                onChange={(e) => setFormData({ ...formData, resource: e.target.value, action: "" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um recurso</option>
                <option value="all">🔓 Todos os recursos</option>
                <optgroup label="Painel de Controle (seções)">
                  {ADMIN_PANEL_SECTIONS.map((section) => (
                    <option key={section} value={adminSectionResource(section)}>
                      {`🧩 ${section}`}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Recursos legados">
                  <option value="rdo_diarios">📋 RDOs (Relatórios Diários de Obra)</option>
                  <option value="equipment_diaries">🚜 Equipamentos (Lançamentos de Equip.)</option>
                  <option value="ocorrencias">⚠️ Ocorrências</option>
                  <option value="funcionarios">👷 Funcionários</option>
                </optgroup>
              </select>
            </div>

            <div>
              <Label htmlFor="action">Ação *</Label>
              <select
                id="action"
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione uma ação</option>
                {ADMIN_PERMISSION_ACTIONS.map((action) => (
                  <option key={action.key} value={action.key}>
                    {action.label}
                  </option>
                ))}
                <option value="view_all">👁️ Ver todos (legado)</option>
                <option value="view_own">👤 Ver apenas os próprios (legado)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_sector_scoped"
                checked={formData.is_sector_scoped}
                onChange={(e) => setFormData({ ...formData, is_sector_scoped: e.target.checked })}
              />
              <Label htmlFor="is_sector_scoped">Setor (Escopo)</Label>
            </div>

            {formData.is_sector_scoped && (
              <div>
                <Label htmlFor="sector_filter">Filtro de Setor</Label>
                <Input
                  id="sector_filter"
                  value={formData.sector_filter}
                  onChange={(e) => setFormData({ ...formData, sector_filter: e.target.value })}
                  placeholder="Ex: construção"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermission}>
              {editingPermission ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Permissão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta permissão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) handleDeletePermission(deleteConfirm);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Abas de Atribuições
function AssignmentsTab() {
  const [assignments, setAssignments] = useState<UserAdminRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [draftByUser, setDraftByUser] = useState<Record<string, string[]>>({});
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const companyId = currentProfile?.company_id;
      if (!companyId) throw new Error("company_id do usuário atual não encontrado.");

      const [assignmentsRes, profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("user_admin_roles")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("user_id, email, nome_completo, company_id")
          .eq("company_id", companyId)
          .order("nome_completo"),
        supabase
          .from("admin_roles")
          .select("*")
          .eq("active", true)
          .or(`company_id.is.null,company_id.eq.${companyId}`)
          .order("name"),
      ]);

      if (assignmentsRes.error) throw assignmentsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const assignmentsData = assignmentsRes.data || [];
      const profilesData = profilesRes.data || [];
      const rolesData = rolesRes.data || [];

      setAssignments(assignmentsData);
      setProfiles(profilesData);
      setRoles(rolesData);

      const initialDraft: Record<string, string[]> = {};
      for (const p of profilesData) {
        const roleIds = assignmentsData
          .filter((a) => (a.user_id && a.user_id === p.user_id) || a.employee_id === p.user_id)
          .map((a) => a.role_id);
        initialDraft[p.user_id] = Array.from(new Set(roleIds));
      }
      setDraftByUser(initialDraft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRole = (userId: string, roleId: string) => {
    setDraftByUser((prev) => {
      const current = new Set(prev[userId] || []);
      if (current.has(roleId)) current.delete(roleId);
      else current.add(roleId);
      return { ...prev, [userId]: Array.from(current) };
    });
  };

  const setAllRoles = (userId: string, enabled: boolean) => {
    setDraftByUser((prev) => ({
      ...prev,
      [userId]: enabled ? roles.map((r) => r.id) : [],
    }));
  };

  const saveUserAssignments = async (profile: Profile) => {
    const userId = profile.user_id;
    const companyId = profile.company_id;
    if (!companyId) {
      toast.error("company_id do usuário não encontrado");
      return;
    }

    setSavingUser(userId);
    try {
      const desired = new Set(draftByUser[userId] || []);
      const current = new Set(
        assignments
          .filter((a) => (a.user_id && a.user_id === userId) || a.employee_id === userId)
          .map((a) => a.role_id)
      );

      const toAdd = Array.from(desired).filter((r) => !current.has(r));
      const toRemove = Array.from(current).filter((r) => !desired.has(r));

      if (toAdd.length > 0) {
        const rows = toAdd.map((roleId) => ({
          user_id: userId,
          employee_id: userId,
          role_id: roleId,
          company_id: companyId,
          is_active: true,
          revoked_at: null,
        }));

        const { error: upsertError } = await (supabase as any)
          .from("user_admin_roles")
          .upsert(rows, { onConflict: "user_id,role_id" });

        if (upsertError) throw upsertError;
      }

      if (toRemove.length > 0) {
        const { error: deactivateError } = await (supabase as any)
          .from("user_admin_roles")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .in("role_id", toRemove)
          .eq("is_active", true);

        if (deactivateError) throw deactivateError;
      }

      toast.success(`Acessos de ${profile.nome_completo || profile.email} atualizados`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar atribuições");
    } finally {
      setSavingUser(null);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.nome_completo || "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Atribuições por Usuário (Fremix)</h2>
      </div>

      <Input
        placeholder="Buscar usuário por nome ou e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredProfiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">Nenhum usuário encontrado</CardContent>
        </Card>
      ) : (
        filteredProfiles.map((profile) => {
          const selected = new Set(draftByUser[profile.user_id] || []);
          const enabledCount = selected.size;
          const isSaving = savingUser === profile.user_id;

          return (
            <Card key={profile.user_id}>
              <CardHeader>
                <CardTitle className="text-base">{profile.nome_completo || profile.email}</CardTitle>
                <CardDescription>
                  {profile.email} • {enabledCount} role{enabledCount === 1 ? "" : "s"} ativo{enabledCount === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setAllRoles(profile.user_id, true)}
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 underline"
                    onClick={() => setAllRoles(profile.user_id, false)}
                  >
                    Desmarcar todos
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {roles.map((role) => {
                    const checked = selected.has(role.id);
                    return (
                      <label key={role.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(profile.user_id, role.id)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.is_system_role ? (
                          <span className="text-[10px] text-blue-600 ml-auto">Sistema</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 ml-auto">Custom</span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => saveUserAssignments(profile)} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar Acessos
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// Componente Principal
export default function AdminRolesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Administração de Roles</h1>
          <p className="text-gray-600">Gerencie roles, permissões e atribuições de acesso</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Painel de Controle</CardTitle>
            <CardDescription>
              Selecione uma aba para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="roles" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="permissions">Permissões</TabsTrigger>
                <TabsTrigger value="assignments">Atribuições</TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="space-y-4">
                <RolesTab />
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <PermissionsTab />
              </TabsContent>

              <TabsContent value="assignments" className="space-y-4">
                <AssignmentsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  ADMIN_SECTION_GROUPS,
  adminSectionLabel,
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
  user_id?: string | null;
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

interface UserAdminPanelAccess {
  user_id: string;
  company_id: string;
  can_access_panel: boolean;
  allowed_sections: string[] | null;
}

interface UserAdminPermission {
  user_id: string;
  company_id: string;
  resource: string;
  action: string;
}

const ADMIN_ROLE_LABELS: Record<string, string> = {
  Super_Admin: "Administrador Geral (Super Admin)",
  RDO_Admin: "Administrador de RDO",
  Equipment_Admin: "Administrador de Equipamentos",
  Fuel_Admin: "Administrador de Abastecimento",
  Maintenance_Admin: "Administrador de Manutenção",
  HR_Admin: "Administrador de RH",
};

const getAdminRoleLabel = (roleName: string) => ADMIN_ROLE_LABELS[roleName] || roleName;

const userPermKey = (section: string, action: string) => `${section}::${action}`;
const userPermParse = (key: string) => {
  const [section, action] = key.split("::");
  return { section, action };
};

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
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [showAdvancedRoleConfig, setShowAdvancedRoleConfig] = useState(false);
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

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setPermissions([]);
        setRoles([]);
        setCompanyId(null);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const cid = profileData?.company_id || null;
      setCompanyId(cid);

      if (!cid) {
        setPermissions([]);
        setRoles([]);
        return;
      }

      const [permissionsRes, rolesRes] = await Promise.all([
        supabase
          .from("admin_permissions")
          .select("*")
          .eq("company_id", cid)
          .order("created_at", { ascending: false }),
        supabase.from("admin_roles").select("*").eq("company_id", cid),
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
    if (!companyId) {
      toast.error("Empresa não identificada para salvar permissões");
      return;
    }
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
          .eq("id", editingPermission.id)
          .eq("company_id", companyId);

        if (error) throw error;
        toast.success("Permissão atualizada com sucesso");
      } else {
        const { error } = await supabase.from("admin_permissions").insert({
          company_id: companyId,
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
      const detail = err instanceof Error ? err.message : "Erro ao salvar permissão";
      toast.error(`Erro ao atualizar permissão: ${detail}`);
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

  const selectedRolePermissions = permissions.filter((p) => p.role_id === selectedRoleId);

  const hasPermission = (section: string, action: string) => {
    const resource = adminSectionResource(section);
    return selectedRolePermissions.some((p) => p.resource === resource && p.action === action);
  };

  const toggleMatrixPermission = async (section: string, action: string, enabled: boolean) => {
    if (!companyId) {
      toast.error("Empresa não identificada para atualizar permissões");
      return;
    }
    if (!selectedRoleId) {
      toast.error("Selecione um role primeiro");
      return;
    }

    const resource = adminSectionResource(section);
    setSavingMatrix(true);

    try {
      if (enabled) {
        const { error } = await supabase.from("admin_permissions").upsert(
          {
            company_id: companyId,
            role_id: selectedRoleId,
            resource,
            action,
            is_sector_scoped: false,
            sector_filter: null,
          },
          { onConflict: "role_id,resource,action" }
        );

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("admin_permissions")
          .delete()
          .eq("company_id", companyId)
          .eq("role_id", selectedRoleId)
          .eq("resource", resource)
          .eq("action", action);

        if (error) throw error;
      }

      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar permissão");
    } finally {
      setSavingMatrix(false);
    }
  };

  const setAllSectionPermissions = async (enabled: boolean) => {
    if (!companyId) {
      toast.error("Empresa não identificada para atualizar permissões");
      return;
    }
    if (!selectedRoleId) {
      toast.error("Selecione um role primeiro");
      return;
    }

    setSavingMatrix(true);
    try {
      if (enabled) {
        const rows = ADMIN_PANEL_SECTIONS.flatMap((section) =>
          ADMIN_PERMISSION_ACTIONS.map((action) => ({
            company_id: companyId,
            role_id: selectedRoleId,
            resource: adminSectionResource(section),
            action: action.key,
            is_sector_scoped: false,
            sector_filter: null,
          }))
        );

        const { error } = await (supabase as any)
          .from("admin_permissions")
          .upsert(rows, { onConflict: "role_id,resource,action" });

        if (error) throw error;
      } else {
        const resources = ADMIN_PANEL_SECTIONS.map((section) => adminSectionResource(section));
        const { error } = await (supabase as any)
          .from("admin_permissions")
          .delete()
          .eq("company_id", companyId)
          .eq("role_id", selectedRoleId)
          .in("resource", resources);

        if (error) throw error;
      }

      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar permissões em lote");
    } finally {
      setSavingMatrix(false);
    }
  };

  const selectedRoleName = roles.find((r) => r.id === selectedRoleId)?.name || "";

  const formatResourceLabel = (resource: string) => {
    if (resource.startsWith("admin_section.")) {
      return adminSectionLabel(resource.replace("admin_section.", ""));
    }

    const legados: Record<string, string> = {
      all: "Todos os recursos",
      rdo_diarios: "RDOs",
      equipment_diaries: "Equipamentos",
      ocorrencias: "Ocorrências",
      funcionarios: "Funcionários",
    };
    return legados[resource] || resource;
  };

  const formatActionLabel = (actionKey: string) => {
    const found = ADMIN_PERMISSION_ACTIONS.find((a) => a.key === actionKey);
    if (found) return found.label;
    if (actionKey === "view_all") return "👁️ Ver todos";
    if (actionKey === "view_own") return "👤 Ver próprios";
    return actionKey;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Permissões</h2>
          <p className="text-sm text-muted-foreground">
            Esta aba é avançada (por tipo de role). Para operação do dia a dia, use primeiro Atribuições (por usuário).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedRoleConfig((prev) => !prev)}
          >
            {showAdvancedRoleConfig ? "Ocultar configuração avançada" : "Mostrar configuração avançada por role"}
          </Button>
          {showAdvancedRoleConfig && (
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nova Permissão
            </Button>
          )}
        </div>
      </div>

      {!showAdvancedRoleConfig ? (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">
            Configuração por role está oculta para evitar ajustes indevidos. Clique em
            <span className="font-semibold"> Mostrar configuração avançada por role</span> quando realmente precisar.
          </CardContent>
        </Card>
      ) : (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração rápida por role (PT-BR)</CardTitle>
          <CardDescription>
            Selecione um role e marque exatamente o que ele pode fazer em cada área do Painel de Controle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="selected-role">Role para configurar</Label>
              <select
                id="selected-role"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um role</option>
                {roles
                  .filter((r) => r.active !== false)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {getAdminRoleLabel(role.name)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedRoleName ? `Configurando: ${getAdminRoleLabel(selectedRoleName)}` : "Nenhum role selecionado"}
            </div>
          </div>

          {selectedRoleId && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={savingMatrix} onClick={() => setAllSectionPermissions(true)}>
                  Marcar tudo (todas as áreas + ações)
                </Button>
                <Button size="sm" variant="outline" disabled={savingMatrix} onClick={() => setAllSectionPermissions(false)}>
                  Limpar tudo
                </Button>
              </div>

              {ADMIN_SECTION_GROUPS.map((group) => (
                <Card key={group.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{group.label}</CardTitle>
                    <CardDescription>
                      Clique nas ações para definir o que este role pode fazer em cada área.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.sections.map((section) => (
                      <div key={section} className="rounded-md border p-3 space-y-2">
                        <div className="font-medium text-sm">{adminSectionLabel(section)}</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {ADMIN_PERMISSION_ACTIONS.map((action) => {
                            const checked = hasPermission(section, action.key);
                            return (
                              <label key={`${section}-${action.key}`} className="flex items-center gap-2 rounded border px-2 py-1 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={savingMatrix}
                                  onChange={(e) => toggleMatrixPermission(section, action.key, e.target.checked)}
                                  className="h-3.5 w-3.5"
                                />
                                <span>{action.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <TableHead>Role (perfil admin)</TableHead>
                <TableHead>Área / Recurso</TableHead>
                <TableHead>Ação permitida</TableHead>
                <TableHead>Escopo por setor</TableHead>
                <TableHead>Filtro de setor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-semibold">{getAdminRoleLabel(getRoleName(perm.role_id))}</TableCell>
                  <TableCell>{formatResourceLabel(perm.resource)}</TableCell>
                  <TableCell>{formatActionLabel(perm.action)}</TableCell>
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
        </>
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
                    {getAdminRoleLabel(role.name)}
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
                      {`🧩 ${adminSectionLabel(section)}`}
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
  const [panelAccessByUser, setPanelAccessByUser] = useState<Record<string, { canAccess: boolean; sections: string[] }>>({});
  const [userPermissionsByUser, setUserPermissionsByUser] = useState<Record<string, string[]>>({});
  const [explicitUserPerms, setExplicitUserPerms] = useState<Record<string, boolean>>({});
  const [permRows, setPermRows] = useState<UserAdminPermission[]>([]);
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

      const [assignmentsRes, profilesRes, rolesRes, panelAccessRes, rolePermsRes, userPermsRes] = await Promise.all([
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
        (supabase as any)
          .from("user_admin_panel_access")
          .select("user_id, company_id, can_access_panel, allowed_sections")
          .eq("company_id", companyId),
        supabase
          .from("admin_permissions")
          .select("role_id, resource, action")
          .eq("company_id", companyId),
        (supabase as any)
          .from("user_admin_permissions")
          .select("user_id, company_id, resource, action")
          .eq("company_id", companyId),
      ]);

      if (assignmentsRes.error) throw assignmentsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (panelAccessRes.error) throw panelAccessRes.error;
      if (rolePermsRes.error) throw rolePermsRes.error;
      if (userPermsRes.error) throw userPermsRes.error;

      const assignmentsData = assignmentsRes.data || [];
      const profilesData = profilesRes.data || [];
      const rolesData = rolesRes.data || [];
      const panelRows = (panelAccessRes.data || []) as UserAdminPanelAccess[];
      const rolePerms = rolePermsRes.data || [];
      const userPermsRows = (userPermsRes.data || []) as UserAdminPermission[];

      setAssignments(assignmentsData);
      setProfiles(profilesData);
      setRoles(rolesData);
      setPermRows(userPermsRows);

      const initialDraft: Record<string, string[]> = {};
      const initialPanel: Record<string, { canAccess: boolean; sections: string[] }> = {};
      const initialUserPerms: Record<string, string[]> = {};
      const initialExplicit: Record<string, boolean> = {};

      for (const p of profilesData) {
        const roleIds = assignmentsData
          .filter((a) => a.employee_id === p.user_id)
          .map((a) => a.role_id);
        initialDraft[p.user_id] = Array.from(new Set(roleIds));

        const panel = panelRows.find((r) => r.user_id === p.user_id);
        initialPanel[p.user_id] = {
          canAccess: panel?.can_access_panel ?? true,
          sections: Array.isArray(panel?.allowed_sections)
            ? (panel?.allowed_sections as string[]).filter((s) => ADMIN_PANEL_SECTIONS.includes(s as any))
            : [...ADMIN_PANEL_SECTIONS],
        };

        const explicitRows = userPermsRows.filter((row) => row.user_id === p.user_id);
        const explicitKeys = explicitRows
          .map((row) => {
            if (!row.resource?.startsWith("admin_section.")) return null;
            const section = row.resource.replace("admin_section.", "");
            if (!ADMIN_PANEL_SECTIONS.includes(section as any)) return null;
            return userPermKey(section, row.action);
          })
          .filter(Boolean) as string[];

        if (explicitKeys.length > 0) {
          initialUserPerms[p.user_id] = Array.from(new Set(explicitKeys));
          initialExplicit[p.user_id] = true;
        } else {
          const derived = new Set<string>();
          const userRoleIds = initialDraft[p.user_id] || [];
          rolePerms
            .filter((rp: any) => userRoleIds.includes(rp.role_id))
            .forEach((rp: any) => {
              const resource = String(rp.resource || "");
              const action = String(rp.action || "");
              if (resource === "all" && action === "manage") {
                ADMIN_PANEL_SECTIONS.forEach((section) => {
                  ADMIN_PERMISSION_ACTIONS.forEach((a) => derived.add(userPermKey(section, a.key)));
                });
                return;
              }
              if (resource.startsWith("admin_section.")) {
                const section = resource.replace("admin_section.", "");
                if (ADMIN_PANEL_SECTIONS.includes(section as any)) {
                  derived.add(userPermKey(section, action));
                }
              }
            });

          initialUserPerms[p.user_id] = Array.from(derived);
          initialExplicit[p.user_id] = false;
        }
      }
      setDraftByUser(initialDraft);
      setPanelAccessByUser(initialPanel);
      setUserPermissionsByUser(initialUserPerms);
      setExplicitUserPerms(initialExplicit);
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

  const setPanelAccessEnabled = (userId: string, enabled: boolean) => {
    setPanelAccessByUser((prev) => ({
      ...prev,
      [userId]: {
        canAccess: enabled,
        sections: prev[userId]?.sections?.length ? prev[userId].sections : [...ADMIN_PANEL_SECTIONS],
      },
    }));
  };

  const togglePanelSection = (userId: string, section: string) => {
    setPanelAccessByUser((prev) => {
      const current = new Set(prev[userId]?.sections || []);
      if (current.has(section)) current.delete(section);
      else current.add(section);

      return {
        ...prev,
        [userId]: {
          canAccess: prev[userId]?.canAccess ?? true,
          sections: Array.from(current),
        },
      };
    });
  };

  const setAllPanelSections = (userId: string, enabled: boolean) => {
    setPanelAccessByUser((prev) => ({
      ...prev,
      [userId]: {
        canAccess: prev[userId]?.canAccess ?? true,
        sections: enabled ? [...ADMIN_PANEL_SECTIONS] : [],
      },
    }));
  };

  const toggleUserPermission = (userId: string, section: string, action: string) => {
    setUserPermissionsByUser((prev) => {
      const current = new Set(prev[userId] || []);
      const key = userPermKey(section, action);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [userId]: Array.from(current) };
    });
    setExplicitUserPerms((prev) => ({ ...prev, [userId]: true }));
  };

  const setAllUserPermissions = (userId: string, enabled: boolean) => {
    const all = ADMIN_PANEL_SECTIONS.flatMap((section) =>
      ADMIN_PERMISSION_ACTIONS.map((a) => userPermKey(section, a.key))
    );
    setUserPermissionsByUser((prev) => ({
      ...prev,
      [userId]: enabled ? all : [],
    }));
    setExplicitUserPerms((prev) => ({ ...prev, [userId]: true }));
  };

  const setAllSectionActionsForUser = (userId: string, section: string, enabled: boolean) => {
    setUserPermissionsByUser((prev) => {
      const current = new Set(prev[userId] || []);
      ADMIN_PERMISSION_ACTIONS.forEach((a) => {
        const key = userPermKey(section, a.key);
        if (enabled) current.add(key);
        else current.delete(key);
      });
      return { ...prev, [userId]: Array.from(current) };
    });
    setExplicitUserPerms((prev) => ({ ...prev, [userId]: true }));
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
          .filter((a) => a.employee_id === userId)
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
          .eq("employee_id", userId)
          .in("role_id", toRemove)
          .eq("is_active", true);

        if (deactivateError) throw deactivateError;
      }

      const panelDraft = panelAccessByUser[userId] || {
        canAccess: true,
        sections: [...ADMIN_PANEL_SECTIONS],
      };

      const desiredKeysForSections = new Set(userPermissionsByUser[userId] || []);
      const sectionsFromPermissions = Array.from(desiredKeysForSections)
        .map((k) => userPermParse(k).section)
        .filter((s): s is string => !!s && ADMIN_PANEL_SECTIONS.includes(s as any));

      // Guarda anti-frustração: se marcou permissões detalhadas de uma seção,
      // a seção também fica visível no painel automaticamente.
      const finalAllowedSections = panelDraft.canAccess
        ? Array.from(new Set([...(panelDraft.sections || []), ...sectionsFromPermissions]))
        : [];

      const { error: panelAccessError } = await (supabase as any)
        .from("user_admin_panel_access")
        .upsert(
          {
            company_id: companyId,
            user_id: userId,
            can_access_panel: panelDraft.canAccess,
            allowed_sections: finalAllowedSections,
          },
          { onConflict: "company_id,user_id" }
        );

      if (panelAccessError) throw panelAccessError;

      const previousRows = permRows.filter((row) => row.user_id === userId);
      const desiredKeys = new Set(userPermissionsByUser[userId] || []);
      const previousKeys = new Set(
        previousRows
          .filter((row) => row.resource.startsWith("admin_section."))
          .map((row) => userPermKey(row.resource.replace("admin_section.", ""), row.action))
      );

      const changed =
        desiredKeys.size !== previousKeys.size ||
        Array.from(desiredKeys).some((k) => !previousKeys.has(k));

      if (changed || explicitUserPerms[userId]) {
        const { error: deletePermsError } = await (supabase as any)
          .from("user_admin_permissions")
          .delete()
          .eq("company_id", companyId)
          .eq("user_id", userId);
        if (deletePermsError) throw deletePermsError;

        // Integridade de ACL: se o usuário tem qualquer ação numa seção,
        // garantimos também 'view' para evitar seção invisível/inconsistente.
        const normalizedKeys = new Set<string>(Array.from(desiredKeys));
        Array.from(desiredKeys).forEach((key) => {
          const { section, action } = userPermParse(key);
          if (!section || !action) return;
          if (!ADMIN_PANEL_SECTIONS.includes(section as any)) return;
          if (action !== "view") normalizedKeys.add(userPermKey(section, "view"));
        });

        const rowsToInsert = Array.from(normalizedKeys)
          .map((key) => {
            const { section, action } = userPermParse(key);
            if (!section || !action || !ADMIN_PANEL_SECTIONS.includes(section as any)) return null;
            return {
              company_id: companyId,
              user_id: userId,
              resource: adminSectionResource(section),
              action,
            };
          })
          .filter(Boolean);

        if (rowsToInsert.length > 0) {
          const { error: insertPermsError } = await (supabase as any)
            .from("user_admin_permissions")
            .insert(rowsToInsert);
          if (insertPermsError) throw insertPermsError;
        }
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
                        <span className="text-sm font-medium">{getAdminRoleLabel(role.name)}</span>
                        {role.is_system_role ? (
                          <span className="text-[10px] text-blue-600 ml-auto">Sistema</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 ml-auto">Custom</span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Painel de Controle</p>
                      <p className="text-xs text-gray-600">Permitir acesso e escolher as áreas visíveis deste usuário</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={panelAccessByUser[profile.user_id]?.canAccess ?? true}
                        onChange={(e) => setPanelAccessEnabled(profile.user_id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      Permitir painel
                    </label>
                  </div>

                  {(panelAccessByUser[profile.user_id]?.canAccess ?? true) && (
                    <>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-xs text-primary underline"
                          onClick={() => setAllPanelSections(profile.user_id, true)}
                        >
                          Marcar todas as áreas
                        </button>
                        <button
                          type="button"
                          className="text-xs text-gray-500 underline"
                          onClick={() => setAllPanelSections(profile.user_id, false)}
                        >
                          Desmarcar todas as áreas
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ADMIN_PANEL_SECTIONS.map((section) => {
                          const checked = (panelAccessByUser[profile.user_id]?.sections || []).includes(section);
                          return (
                            <label key={`${profile.user_id}-${section}`} className="flex items-center gap-2 rounded-md border bg-white p-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePanelSection(profile.user_id, section)}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">{adminSectionLabel(section)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg border bg-white p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Permissões detalhadas por usuário</p>
                      <p className="text-xs text-gray-600">
                        Aqui você define ação por ação para este usuário. Isso sobrepõe o padrão do role.
                        Ao marcar uma ação de seção, a seção entra automaticamente na visibilidade do painel.
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${explicitUserPerms[profile.user_id] ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {explicitUserPerms[profile.user_id] ? "Personalizado" : "Baseado no role"}
                    </span>
                  </div>

                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setAllUserPermissions(profile.user_id, true)}
                    >
                      Marcar tudo
                    </button>
                    <button
                      type="button"
                      className="text-gray-500 underline"
                      onClick={() => setAllUserPermissions(profile.user_id, false)}
                    >
                      Limpar tudo
                    </button>
                  </div>

                  <div className="space-y-3">
                    {ADMIN_SECTION_GROUPS.map((group) => (
                      <div key={`${profile.user_id}-${group.key}`} className="rounded-md border p-2 bg-slate-50">
                        <p className="text-xs font-semibold mb-2">{group.label}</p>
                        <div className="space-y-2">
                          {group.sections.map((section) => {
                            const selectedPerms = new Set(userPermissionsByUser[profile.user_id] || []);
                            const allSectionChecked = ADMIN_PERMISSION_ACTIONS.every((a) =>
                              selectedPerms.has(userPermKey(section, a.key))
                            );

                            return (
                              <div key={`${profile.user_id}-${section}`} className="rounded border bg-white p-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium">{adminSectionLabel(section)}</span>
                                  <button
                                    type="button"
                                    className="text-[11px] text-primary underline"
                                    onClick={() => setAllSectionActionsForUser(profile.user_id, section, !allSectionChecked)}
                                  >
                                    {allSectionChecked ? "Desmarcar seção" : "Marcar seção"}
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                  {ADMIN_PERMISSION_ACTIONS.map((action) => {
                                    const key = userPermKey(section, action.key);
                                    const checked = selectedPerms.has(key);
                                    return (
                                      <label key={key} className="flex items-center gap-1.5 text-[11px] rounded border px-2 py-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleUserPermission(profile.user_id, section, action.key)}
                                          className="h-3.5 w-3.5"
                                        />
                                        <span>{action.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
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
            <Tabs defaultValue="assignments" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="assignments">Atribuições (por usuário)</TabsTrigger>
                <TabsTrigger value="permissions">Permissões (por role)</TabsTrigger>
                <TabsTrigger value="roles">Catálogo de Roles</TabsTrigger>
              </TabsList>

              <TabsContent value="assignments" className="space-y-4">
                <AssignmentsTab />
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <PermissionsTab />
              </TabsContent>

              <TabsContent value="roles" className="space-y-4">
                <RolesTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

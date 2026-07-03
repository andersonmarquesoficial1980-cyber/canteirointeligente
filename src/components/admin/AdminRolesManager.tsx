import { useState } from "react";
import { useAdminRoles } from "@/hooks/useAdminRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";

export function AdminRolesManager() {
  const {
    roles,
    rolesLoading,
    permissions,
    userRoles,
    userRolesLoading,
    auditLog,
    createRole,
    createRoleLoading,
    addPermission,
    addPermissionLoading,
    assignRole,
    assignRoleLoading,
    revokeRole,
    revokeRoleLoading,
  } = useAdminRoles();

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedResource, setSelectedResource] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [showAuditLog, setShowAuditLog] = useState(false);

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    createRole({ name: newRoleName, description: newRoleDesc });
    setNewRoleName("");
    setNewRoleDesc("");
  };

  const handleAddPermission = () => {
    if (!selectedRole || !selectedResource || !selectedAction) return;
    addPermission({
      role_id: selectedRole,
      resource: selectedResource,
      action: selectedAction,
      is_sector_scoped: !!selectedSector,
      sector_filter: selectedSector,
    });
    setSelectedRole("");
    setSelectedResource("");
    setSelectedAction("");
    setSelectedSector("");
  };

  const handleAssignRole = () => {
    if (!selectedEmployee || !selectedRole) return;
    assignRole({
      employee_id: selectedEmployee,
      role_id: selectedRole,
      scope_sector: selectedSector,
    });
    setSelectedEmployee("");
    setSelectedRole("");
    setSelectedSector("");
  };

  const RESOURCES = [
    "rdo_diarios",
    "equipamentos",
    "abastecimentos",
    "manutencao",
    "employees",
    "relatarios",
  ];

  const ACTIONS = ["view", "create", "edit", "delete"];

  const SECTORS = ["rdo", "equipment", "fuel", "maintenance", "hr"];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="assignments">Atribuições</TabsTrigger>
        </TabsList>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Roles</CardTitle>
              <CardDescription>
                Crie tipos de admin com nomes únicos por empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do role (ex: RDO_Admin)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  disabled={createRoleLoading}
                />
                <Button
                  onClick={handleCreateRole}
                  disabled={createRoleLoading || !newRoleName.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Role
                </Button>
              </div>
              <Textarea
                placeholder="Descrição do role (opcional)"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                disabled={createRoleLoading}
                className="max-h-20"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roles Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : roles.length === 0 ? (
                <p className="text-muted-foreground">Nenhum role criado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Sistema?</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role: any) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell className="text-sm">
                          {role.description || "-"}
                        </TableCell>
                        <TableCell>
                          {role.is_system_role ? (
                            <Badge variant="secondary">Sistema</Badge>
                          ) : (
                            <Badge>Custom</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {role.active ? (
                            <Badge variant="default">Ativo</Badge>
                          ) : (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERMISSIONS TAB */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Permissão</CardTitle>
              <CardDescription>
                Combine role + resource + action para definir permissões granulares
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Recurso</Label>
                  <Select value={selectedResource} onValueChange={setSelectedResource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione recurso" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Ação</Label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ação" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Setor (opcional)</Label>
                  <Select value={selectedSector} onValueChange={setSelectedSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os setores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {SECTORS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAddPermission}
                disabled={
                  addPermissionLoading ||
                  !selectedRole ||
                  !selectedResource ||
                  !selectedAction
                }
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Permissão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permissões Existentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Setor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm: any) => {
                    const role = roles.find((r: any) => r.id === perm.role_id);
                    return (
                      <TableRow key={perm.id}>
                        <TableCell className="font-medium">
                          {role?.name || "N/A"}
                        </TableCell>
                        <TableCell>{perm.resource}</TableCell>
                        <TableCell>
                          <Badge>{perm.action}</Badge>
                        </TableCell>
                        <TableCell>
                          {perm.sector_filter || "Todos"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSIGNMENTS TAB */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atribuir Role a Usuário</CardTitle>
              <CardDescription>
                Atribua roles admin a employees com escopo opcional por setor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Funcionário</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Começar a digitar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* TODO: Fetch employees from API */}
                      <SelectItem value="demo">Demo Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Setor (opcional - para limitar escopo)</Label>
                  <Select value={selectedSector} onValueChange={setSelectedSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Acesso a todos setores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os setores</SelectItem>
                      {SECTORS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAssignRole}
                disabled={assignRoleLoading || !selectedEmployee || !selectedRole}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Atribuir Role
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Atribuições Ativas</CardTitle>
                  <CardDescription>
                    Funcionários com roles admin atribuídos
                  </CardDescription>
                </div>
                <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      Auditoria
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Log de Auditoria</DialogTitle>
                      <DialogDescription>
                        Todas as ações de admin realizadas
                      </DialogDescription>
                    </DialogHeader>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admin</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Recurso</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {log.employees?.name || "N/A"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.action}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.resource}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {userRolesLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : userRoles.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma atribuição ativa</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Atribuído em</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((ur: any) => (
                      <TableRow key={ur.id}>
                        <TableCell className="font-medium">
                          {ur.employees?.name || "N/A"}
                        </TableCell>
                        <TableCell>{ur.admin_roles?.name || "N/A"}</TableCell>
                        <TableCell>
                          {ur.scope_sector ? (
                            <Badge>{ur.scope_sector}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Todos</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(ur.assigned_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogAction className="hidden" />
                            <AlertDialogCancel asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeRole(ur.id)}
                                disabled={revokeRoleLoading}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Revogar
                              </Button>
                            </AlertDialogCancel>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeRole(ur.id)}
                                disabled={revokeRoleLoading}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Revogar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revogar Role?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja revogar o role{" "}
                                  <strong>{ur.admin_roles?.name}</strong> de{" "}
                                  <strong>{ur.employees?.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogAction
                                onClick={() => revokeRole(ur.id)}
                              >
                                Revogar
                              </AlertDialogAction>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

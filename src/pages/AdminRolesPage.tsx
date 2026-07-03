import { AdminRolesManager } from "@/components/admin/AdminRolesManager";

export default function AdminRolesPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Roles Admin</h1>
        <p className="text-muted-foreground mt-2">
          Configure roles de administrador com permissões granulares por setor
        </p>
      </div>
      <AdminRolesManager />
    </div>
  );
}

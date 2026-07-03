import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useUserProfile } from "./useUserProfile";

export function useAdminRoles() {
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all admin roles for company
  const rolesQuery = useQuery({
    queryKey: ["admin_roles", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("admin_roles")
        .select("*")
        .eq("company_id", profile.company_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch permissions for a role
  const permissionsQuery = useQuery({
    queryKey: ["admin_permissions", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("admin_permissions")
        .select("*")
        .eq("company_id", profile.company_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch user role assignments
  const userRolesQuery = useQuery({
    queryKey: ["user_admin_roles", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("user_admin_roles")
        .select("*, admin_roles(name, description), employees(name, matricula)")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch audit log
  const auditLogQuery = useQuery({
    queryKey: ["admin_audit_log", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*, employees(name)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Create admin role
  const createRoleMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
    }) => {
      if (!profile?.company_id) throw new Error("No company_id");
      const { data: role, error } = await supabase
        .from("admin_roles")
        .insert({
          company_id: profile.company_id,
          name: data.name,
          description: data.description,
          is_system_role: false,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_roles"] });
      toast({
        title: "Sucesso",
        description: "Role criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add permission to role
  const addPermissionMutation = useMutation({
    mutationFn: async (data: {
      role_id: string;
      resource: string;
      action: string;
      is_sector_scoped?: boolean;
      sector_filter?: string;
    }) => {
      if (!profile?.company_id) throw new Error("No company_id");
      const { data: perm, error } = await supabase
        .from("admin_permissions")
        .insert({
          company_id: profile.company_id,
          role_id: data.role_id,
          resource: data.resource,
          action: data.action,
          is_sector_scoped: data.is_sector_scoped || false,
          sector_filter: data.sector_filter,
        })
        .select()
        .single();
      if (error) throw error;
      return perm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_permissions"] });
      toast({
        title: "Sucesso",
        description: "Permissão adicionada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign role to user
  const assignRoleMutation = useMutation({
    mutationFn: async (data: {
      employee_id: string;
      role_id: string;
      scope_sector?: string;
      scope_obra?: string;
    }) => {
      if (!profile?.company_id) throw new Error("No company_id");
      const { data: assignment, error } = await supabase
        .from("user_admin_roles")
        .insert({
          company_id: profile.company_id,
          employee_id: data.employee_id,
          role_id: data.role_id,
          scope_sector: data.scope_sector,
          scope_obra: data.scope_obra,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_admin_roles"] });
      toast({
        title: "Sucesso",
        description: "Usuário atribuído ao role",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Revoke role from user
  const revokeRoleMutation = useMutation({
    mutationFn: async (userRoleId: string) => {
      const { error } = await supabase
        .from("user_admin_roles")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", userRoleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_admin_roles"] });
      toast({
        title: "Sucesso",
        description: "Role revogado do usuário",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    roles: rolesQuery.data || [],
    rolesLoading: rolesQuery.isLoading,
    permissions: permissionsQuery.data || [],
    permissionsLoading: permissionsQuery.isLoading,
    userRoles: userRolesQuery.data || [],
    userRolesLoading: userRolesQuery.isLoading,
    auditLog: auditLogQuery.data || [],
    auditLogLoading: auditLogQuery.isLoading,
    createRole: createRoleMutation.mutate,
    createRoleLoading: createRoleMutation.isPending,
    addPermission: addPermissionMutation.mutate,
    addPermissionLoading: addPermissionMutation.isPending,
    assignRole: assignRoleMutation.mutate,
    assignRoleLoading: assignRoleMutation.isPending,
    revokeRole: revokeRoleMutation.mutate,
    revokeRoleLoading: revokeRoleMutation.isPending,
  };
}

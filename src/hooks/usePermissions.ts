import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Permissions {
  is_admin: boolean;
  modulo_obras: boolean;
  modulo_equipamentos: boolean;
  modulo_rh: boolean;
  modulo_carreteiros: boolean;
  modulo_programador: boolean;
  modulo_demandas: boolean;
  modulo_manutencao: boolean;
  modulo_abastecimento: boolean;
  modulo_documentos: boolean;
  modulo_relatorios: boolean;
  modulo_dashboard: boolean;
  modulo_encarregado: boolean;
  modulo_sst: boolean;
  modulo_engenharia: boolean;
  modulo_gestao_frotas: boolean;
  modulo_gestao_pessoas: boolean;
  modulo_suprimentos: boolean;
  modulo_medicoes: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  is_admin: false,
  modulo_obras: false,
  modulo_equipamentos: false,
  modulo_rh: false,
  modulo_carreteiros: false,
  modulo_programador: false,
  modulo_demandas: false,
  modulo_manutencao: false,
  modulo_abastecimento: false,
  modulo_documentos: false,
  modulo_relatorios: false,
  modulo_dashboard: false,
  modulo_encarregado: false,
  modulo_sst: false,
  modulo_engenharia: false,
  modulo_gestao_frotas: false,
  modulo_gestao_pessoas: false,
  modulo_suprimentos: false,
  modulo_medicoes: false,
};

// Admin tem acesso a tudo
const ADMIN_PERMISSIONS: Permissions = Object.fromEntries(
  Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true])
) as Permissions;

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Verificar se é admin pelo hook existente
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("user_id", user.id)
        .single();

      // Buscar permissões específicas do user_permissions (fonte de verdade)
      const { data: perms, error: permsError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // has_role('admin') = anderson@fremix.com.br ou user_roles → acesso total
      // is_admin em user_permissions = admin de empresa → respeita user_permissions
      if (profile?.role === "admin" || profile?.role === "superadmin") {
        setPermissions(ADMIN_PERMISSIONS);
      } else if (perms) {
        setPermissions(perms as unknown as Permissions);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
        if (permsError) console.warn("[usePermissions] erro:", permsError.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  return { permissions, loading };
}

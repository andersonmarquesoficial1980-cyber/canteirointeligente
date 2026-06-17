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

      if (profile?.role === "admin") {
        setPermissions(ADMIN_PERMISSIONS);
        setLoading(false);
        return;
      }

      // Buscar permissões específicas
      const { data: perms, error: permsError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (perms) {
        setPermissions(perms as Permissions);
      } else {
        // Sem registro = sem acesso (exceto se for admin)
        setPermissions(DEFAULT_PERMISSIONS);
        if (permsError) console.warn("[usePermissions] erro ao buscar permissões:", permsError.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  return { permissions, loading };
}

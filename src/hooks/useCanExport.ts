import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyModules } from "./useCompanyModules";

/**
 * Retorna true se o usuário atual pode exportar relatórios (PDF/Excel).
 * Admin sempre pode. Outros perfis dependem da flag can_export no banco.
 */
export function useCanExport() {
  const { isSuperAdmin } = useCompanyModules();
  const [canExport, setCanExport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) { setCanExport(true); setLoading(false); return; }

    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id;
      if (!userId) { setCanExport(false); setLoading(false); return; }

      supabase
        .from("profiles")
        .select("can_export, perfil")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data: profile }) => {
          const isAdmin = profile?.perfil === "Administrador";
          setCanExport(isAdmin || Boolean(profile?.can_export));
          setLoading(false);
        });
    });
  }, [isSuperAdmin]);

  return { canExport, loading };
}

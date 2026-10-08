import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions, type Permissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { supabase } from "@/integrations/supabase/client";
import { HUB_MODULES } from "@/config/navigation";

// Mesmo recorte do Home: apenas centralizado para a navegação desktop.
// Não concede permissões, não altera contratos e não substitui guards de rota/RLS.
export function useHubAccess() {
  const { isAdmin } = useIsAdmin();
  const { permissions, loading: loadingPerms, semPerfil } = usePermissions();
  const { hasModule, loading: loadingModules, isSuperAdmin, companyLogo } = useCompanyModules();
  const [panelAccessAllowed, setPanelAccessAllowed] = useState(true);
  const [loadingPanelAccess, setLoadingPanelAccess] = useState(true);
  useEffect(() => {
    let mounted = true;

    const loadPanelAccess = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (mounted) setLoadingPanelAccess(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.company_id) {
          if (mounted) {
            setPanelAccessAllowed(true);
            setLoadingPanelAccess(false);
          }
          return;
        }

        const { data } = await (supabase as SupabaseClient)
          .from("user_admin_panel_access")
          .select("can_access_panel")
          .eq("company_id", profile.company_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (mounted) {
          setPanelAccessAllowed(data?.can_access_panel !== false);
          setLoadingPanelAccess(false);
        }
      } catch {
        if (mounted) {
          setPanelAccessAllowed(true);
          setLoadingPanelAccess(false);
        }
      }
    };

    loadPanelAccess();
    return () => {
      mounted = false;
    };
  }, []);
  const loading = loadingPerms || loadingModules || loadingPanelAccess;
  const modules = loading ? [] : HUB_MODULES
          .filter(mod => {
            // adminOnly: acesso ao painel por 3 caminhos
            // 1) superadmin global
            // 2) admin legado (is_admin em user_permissions)
            // 3) admin por Admin Roles (useIsAdmin/has_role)
            const hasAdminAccess = isAdmin || isSuperAdmin || permissions?.is_admin === true;
            if (mod.adminOnly && !hasAdminAccess) return false;
            // Módulo admin: libera só quem tem permissão explícita
            if (mod.id === "admin") return hasAdminAccess && panelAccessAllowed;
            // Super-admin (dono do Workflux) vê tudo
            // Admin da empresa vê módulos contratados pela empresa
            if (!hasModule(mod.id)) return false;
            // Admin legado da empresa: não depende de flags individuais modulo_* no Home
            if (permissions?.is_admin === true) return true;
            // Usuário comum: filtrar por permissão individual
            const permMap: Record<string, keyof Permissions> = {
              obras: "modulo_obras",
              equipamentos: "modulo_equipamentos",
              rh: "modulo_rh",
              carreteiros: "modulo_carreteiros",
              programador: "modulo_programador",
              demandas: "modulo_demandas",
              manutencao: "modulo_manutencao",
              abastecimento: "modulo_abastecimento",
              documentos: "modulo_documentos",
              relatorios: "modulo_relatorios",
              dashboard: "modulo_dashboard",
              encarregado: "modulo_encarregado",
              sst: "modulo_sst",
              engenharia: "modulo_engenharia",
              "gestao-frotas": "modulo_gestao_frotas",
              "gestao-pessoas": "modulo_gestao_pessoas",
              suprimentos: "modulo_suprimentos",
              medicoes: "modulo_medicoes",
              orcamentos: "modulo_orcamentos",
              planejamento: "modulo_planejamento",
            };
            if (!permissions) return false;
            const permKey = permMap[mod.id];
            // Módulos novos podem iniciar com gate apenas por company_modules
            // (liberação por cliente no Super Admin), antes da permissão individual.
            if (!permKey) return true;
            return permissions[permKey] === true;
          });
  return { modules, loading, semPerfil, isSuperAdmin, companyLogo };
}
export type HubAccess = ReturnType<typeof useHubAccess>;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna a lista de módulos contratados pela empresa do usuário logado.
 * Super-admin (role = 'superadmin') tem acesso a tudo.
 */
export function useCompanyModules() {
  const [modules, setModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Busca perfil do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Super-admin (dono do Workflux) vê tudo
      if ((profile as any)?.role === "superadmin") {
        setIsSuperAdmin(true);
        setModules(null); // null = sem restrição
        setLoading(false);
        return;
      }

      const companyId = (profile as any)?.company_id;
      if (!companyId) {
        setModules([]);
        setLoading(false);
        return;
      }

      // Busca módulos contratados e dados da empresa
      const [{ data: mods }, { data: comp }] = await Promise.all([
        supabase
          .from("company_modules")
          .select("modulo")
          .eq("company_id", companyId)
          .eq("ativo", true),
        supabase
          .from("companies")
          .select("logo_url")
          .eq("id", companyId)
          .maybeSingle()
      ]);

      if (comp?.logo_url) {
        setCompanyLogo(comp.logo_url);
      }

      setModules((mods ?? []).map((m: any) => m.modulo));
      setLoading(false);
    }
    load();
  }, []);

  /**
   * Retorna true se o módulo está liberado para o usuário/empresa.
   */
  function hasModule(moduleId: string): boolean {
    if (isSuperAdmin || modules === null) return true; // super-admin vê tudo
    return modules.includes(moduleId);
  }

  return { modules, loading, isSuperAdmin, hasModule, companyLogo };
}

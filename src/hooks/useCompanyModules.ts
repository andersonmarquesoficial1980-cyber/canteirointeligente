import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, getUserId, peekForUser } from "@/lib/sessionCache";

/**
 * Retorna a lista de módulos contratados pela empresa do usuário logado.
 * Super-admin (role = 'superadmin') tem acesso a tudo.
 */
type ModulesResult = { isSuperAdmin: boolean; modules: string[] | null; logo: string | null };

async function loadCompanyModules(userId: string): Promise<ModulesResult> {
  // Busca perfil do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("user_id", userId)
    .maybeSingle();

  // Super-admin (dono do Workflux) vê tudo
  if ((profile as any)?.role === "superadmin") return { isSuperAdmin: true, modules: null, logo: null };

  const companyId = (profile as any)?.company_id;
  if (!companyId) return { isSuperAdmin: false, modules: [], logo: null };

  // Busca módulos contratados e dados da empresa
  const [{ data: mods }, { data: comp }] = await Promise.all([
    supabase.from("company_modules").select("modulo").eq("company_id", companyId).eq("ativo", true),
    supabase.from("companies").select("logo_url").eq("id", companyId).maybeSingle(),
  ]);
  return {
    isSuperAdmin: false,
    modules: (mods ?? []).map((m: any) => m.modulo),
    logo: comp?.logo_url ?? null,
  };
}

export function useCompanyModules() {
  const initial = peekForUser<ModulesResult>("companyModules");
  const [modules, setModules] = useState<string[] | null>(initial?.modules ?? null);
  const [loading, setLoading] = useState(!initial);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initial?.isSuperAdmin ?? false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(initial?.logo ?? null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const userId = await getUserId();
      if (!userId) { if (alive) setLoading(false); return; }
      const r = await cachedFetch(`companyModules:${userId}`, () => loadCompanyModules(userId));
      if (!alive) return;
      setIsSuperAdmin(r.isSuperAdmin);
      setModules(r.modules);
      setCompanyLogo(r.logo);
      setLoading(false);
    }
    load().catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  /**
   * Retorna true se o módulo está liberado para o usuário/empresa.
   */
  function hasModule(moduleId: string): boolean {
    if (isSuperAdmin) return true; // super-admin vê tudo
    if (modules === null) return false; // ainda carregando — não mostra nada
    return modules.includes(moduleId);
  }

  return { modules, loading, isSuperAdmin, hasModule, companyLogo };
}

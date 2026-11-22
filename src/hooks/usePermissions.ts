import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, getUserId, peekForUser } from "@/lib/sessionCache";

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
  modulo_orcamentos: boolean;
  modulo_planejamento: boolean;
  modulo_refeicoes: boolean;
  refeicoes_gestor: boolean;
  vagas_gestor: boolean;
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
  modulo_orcamentos: false,
  modulo_planejamento: false,
  modulo_refeicoes: false,
  refeicoes_gestor: false,
  vagas_gestor: false,
};

// Admin tem acesso a tudo
const ADMIN_PERMISSIONS: Permissions = Object.fromEntries(
  Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true])
) as unknown as Permissions;

type PermissionsResult = { permissions: Permissions; semPerfil: boolean } | null;

async function loadPermissions(userId: string): Promise<PermissionsResult> {
  // Verificar se é admin pelo hook existente
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("user_id", userId)
    .single();

  // Usuário existe no Auth mas não tem profile ainda — situação de novo cadastro pendente
  if (!profile) return { permissions: DEFAULT_PERMISSIONS, semPerfil: true };

  // Buscar permissões específicas do user_permissions (fonte de verdade)
  const { data: perms, error: permsError } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Somente o owner superadmin pode ignorar concessões individuais.
  // role='admin' legado não pode restaurar acesso que foi retirado no painel.
  if (profile?.role === "superadmin") return { permissions: ADMIN_PERMISSIONS, semPerfil: false };
  if (perms) return { permissions: perms as unknown as Permissions, semPerfil: false };
  if (permsError) console.warn("[usePermissions] erro:", permsError.message);
  return { permissions: DEFAULT_PERMISSIONS, semPerfil: false };
}

export function usePermissions() {
  const initial = peekForUser<PermissionsResult>("permissions");
  const [permissions, setPermissions] = useState<Permissions | null>(initial?.permissions ?? null);
  const [loading, setLoading] = useState(!initial);
  const [semPerfil, setSemPerfil] = useState(initial?.semPerfil ?? false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const userId = await getUserId();
      if (!userId) { if (alive) setLoading(false); return; }
      const result = await cachedFetch(`permissions:${userId}`, () => loadPermissions(userId));
      if (!alive || !result) return;
      setSemPerfil(result.semPerfil);
      setPermissions(result.permissions);
      setLoading(false);
    }
    load().catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return { permissions, loading, semPerfil };
}

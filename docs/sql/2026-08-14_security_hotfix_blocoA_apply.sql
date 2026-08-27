-- Workflux Security Hotfix Bloco A (sem downtime)
-- Escopo: fechar exposição crítica sem quebrar fluxos
-- Data: 2026-08-14

BEGIN;

-- 1) Ativar RLS nas tabelas críticas que estavam OFF
ALTER TABLE public.employee_name_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_diaries_cleanup_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_apontador_engenheiro_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_api_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wf_api_clients ENABLE ROW LEVEL SECURITY;

-- 2) Remover acesso anônimo direto (anon)
REVOKE ALL ON TABLE public.employee_name_aliases FROM anon;
REVOKE ALL ON TABLE public.equipment_diaries_cleanup_backup FROM anon;
REVOKE ALL ON TABLE public.rdo_apontador_engenheiro_map FROM anon;
REVOKE ALL ON TABLE public.subscriptions FROM anon;
REVOKE ALL ON TABLE public.wf_api_access_logs FROM anon;
REVOKE ALL ON TABLE public.wf_api_clients FROM anon;

-- 3) Policies de isolamento por company_id (authenticated + superadmin)
DROP POLICY IF EXISTS employee_name_aliases_company_isolation ON public.employee_name_aliases;
CREATE POLICY employee_name_aliases_company_isolation
ON public.employee_name_aliases
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS equipment_diaries_cleanup_backup_company_isolation ON public.equipment_diaries_cleanup_backup;
CREATE POLICY equipment_diaries_cleanup_backup_company_isolation
ON public.equipment_diaries_cleanup_backup
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS rdo_apontador_engenheiro_map_company_isolation ON public.rdo_apontador_engenheiro_map;
CREATE POLICY rdo_apontador_engenheiro_map_company_isolation
ON public.rdo_apontador_engenheiro_map
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS subscriptions_company_isolation ON public.subscriptions;
CREATE POLICY subscriptions_company_isolation
ON public.subscriptions
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS wf_api_access_logs_company_isolation ON public.wf_api_access_logs;
CREATE POLICY wf_api_access_logs_company_isolation
ON public.wf_api_access_logs
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

DROP POLICY IF EXISTS wf_api_clients_company_isolation ON public.wf_api_clients;
CREATE POLICY wf_api_clients_company_isolation
ON public.wf_api_clients
FOR ALL TO authenticated
USING (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
)
WITH CHECK (
  company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  OR is_super_admin()
);

-- 4) Corrigir vazamento global de perfis
DROP POLICY IF EXISTS profiles_select ON public.profiles;

-- 5) Corrigir bug de policy (profiles.id -> profiles.user_id)
DROP POLICY IF EXISTS "Enable read for authenticated users within company" ON public.suprimentos_frete_historico;
CREATE POLICY "Enable read for authenticated users within company"
ON public.suprimentos_frete_historico
FOR SELECT TO public
USING (
  company_id IN (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable insert for authenticated users within company" ON public.suprimentos_frete_historico;
CREATE POLICY "Enable insert for authenticated users within company"
ON public.suprimentos_frete_historico
FOR INSERT TO public
WITH CHECK (
  company_id IN (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
);

COMMIT;

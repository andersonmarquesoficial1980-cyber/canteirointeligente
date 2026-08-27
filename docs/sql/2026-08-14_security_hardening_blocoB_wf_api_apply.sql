-- Workflux Security Hardening Bloco B (wf_api_*)
-- Objetivo: restringir acesso de runtime autenticado às tabelas de clientes/logs da API
-- Mantém service_role funcionando (bypass de RLS)

BEGIN;

-- =============================
-- wf_api_clients
-- =============================
DROP POLICY IF EXISTS wf_api_clients_company_isolation ON public.wf_api_clients;
DROP POLICY IF EXISTS wf_api_clients_select_admin ON public.wf_api_clients;
DROP POLICY IF EXISTS wf_api_clients_write_admin ON public.wf_api_clients;

CREATE POLICY wf_api_clients_select_admin
ON public.wf_api_clients
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil IN ('Administrador', 'Gerente')
        )
    )
  )
);

CREATE POLICY wf_api_clients_write_admin
ON public.wf_api_clients
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil = 'Administrador'
        )
    )
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil = 'Administrador'
        )
    )
  )
);

-- =============================
-- wf_api_access_logs
-- =============================
DROP POLICY IF EXISTS wf_api_access_logs_company_isolation ON public.wf_api_access_logs;
DROP POLICY IF EXISTS wf_api_access_logs_select_admin ON public.wf_api_access_logs;
DROP POLICY IF EXISTS wf_api_access_logs_write_admin ON public.wf_api_access_logs;

CREATE POLICY wf_api_access_logs_select_admin
ON public.wf_api_access_logs
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil IN ('Administrador', 'Gerente')
        )
    )
  )
);

CREATE POLICY wf_api_access_logs_write_admin
ON public.wf_api_access_logs
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil = 'Administrador'
        )
    )
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role IN ('admin', 'superadmin')
          OR p.perfil = 'Administrador'
        )
    )
  )
);

COMMIT;

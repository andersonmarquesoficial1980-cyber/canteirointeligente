BEGIN;

-- Recriar policies wf_api_clients com superadmin explícito via profiles
DROP POLICY IF EXISTS wf_api_clients_select_admin ON public.wf_api_clients;
DROP POLICY IF EXISTS wf_api_clients_write_admin ON public.wf_api_clients;

CREATE POLICY wf_api_clients_select_admin
ON public.wf_api_clients
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil IN ('Administrador','Gerente'))
    )
  )
);

CREATE POLICY wf_api_clients_write_admin
ON public.wf_api_clients
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil = 'Administrador')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil = 'Administrador')
    )
  )
);

-- Recriar policies wf_api_access_logs com superadmin explícito via profiles
DROP POLICY IF EXISTS wf_api_access_logs_select_admin ON public.wf_api_access_logs;
DROP POLICY IF EXISTS wf_api_access_logs_write_admin ON public.wf_api_access_logs;

CREATE POLICY wf_api_access_logs_select_admin
ON public.wf_api_access_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil IN ('Administrador','Gerente'))
    )
  )
);

CREATE POLICY wf_api_access_logs_write_admin
ON public.wf_api_access_logs
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil = 'Administrador')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.role = 'admin' OR p.perfil = 'Administrador')
    )
  )
);

COMMIT;

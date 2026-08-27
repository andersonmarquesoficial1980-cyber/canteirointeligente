BEGIN;

-- Hardening multiempresa: company_modules
-- Regra: superadmin gerencia ativação de módulos; usuários comuns apenas leem escopo próprio.

DROP POLICY IF EXISTS company_modules_auth ON public.company_modules;

CREATE POLICY company_modules_select_scope
ON public.company_modules
FOR SELECT TO authenticated
USING (
  public.auth_profile_is_superadmin()
  OR company_id = public.auth_profile_company_id()
);

CREATE POLICY company_modules_write_superadmin
ON public.company_modules
FOR ALL TO authenticated
USING (public.auth_profile_is_superadmin())
WITH CHECK (public.auth_profile_is_superadmin());

COMMIT;

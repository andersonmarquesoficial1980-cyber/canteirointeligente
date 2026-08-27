BEGIN;

-- Helper functions (SECURITY DEFINER) to avoid RLS recursion in profiles policies
CREATE OR REPLACE FUNCTION public.auth_profile_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_profile_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_profile_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.role = 'admin' OR p.perfil = 'Administrador')
  );
$$;

-- Recreate policies using helper functions only (no direct subquery on profiles)
DROP POLICY IF EXISTS select_all_profiles_admin ON public.profiles;
CREATE POLICY select_all_profiles_admin
ON public.profiles
FOR SELECT TO authenticated
USING (
  public.auth_profile_is_superadmin()
  OR (
    public.auth_profile_is_admin()
    AND company_id = public.auth_profile_company_id()
  )
);

DROP POLICY IF EXISTS admin_update_profiles ON public.profiles;
CREATE POLICY admin_update_profiles
ON public.profiles
FOR UPDATE TO authenticated
USING (
  public.auth_profile_is_superadmin()
  OR (
    public.auth_profile_is_admin()
    AND company_id = public.auth_profile_company_id()
  )
)
WITH CHECK (
  public.auth_profile_is_superadmin()
  OR (
    public.auth_profile_is_admin()
    AND company_id = public.auth_profile_company_id()
  )
);

DROP POLICY IF EXISTS admin_delete_profiles ON public.profiles;
CREATE POLICY admin_delete_profiles
ON public.profiles
FOR DELETE TO authenticated
USING (
  public.auth_profile_is_superadmin()
  OR (
    public.auth_profile_is_admin()
    AND company_id = public.auth_profile_company_id()
  )
);

DROP POLICY IF EXISTS admin_insert_profiles ON public.profiles;
CREATE POLICY admin_insert_profiles
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.auth_profile_is_superadmin()
  OR (
    public.auth_profile_is_admin()
    AND company_id = public.auth_profile_company_id()
  )
);

COMMIT;

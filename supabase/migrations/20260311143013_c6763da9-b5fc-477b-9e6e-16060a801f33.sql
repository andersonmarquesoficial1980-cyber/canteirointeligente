-- FIX: Change profiles & user_roles SELECT policies from RESTRICTIVE to PERMISSIVE
-- RESTRICTIVE requires ALL policies to pass; we need ANY (PERMISSIVE)

-- PROFILES: drop all existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_all_profiles_admin" ON public.profiles;
DROP POLICY IF EXISTS "insert_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;

CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "select_all_profiles_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "insert_profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

-- USER_ROLES: drop all existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "select_own_role" ON public.user_roles;
DROP POLICY IF EXISTS "admin_select_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_insert_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_update_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_delete_roles" ON public.user_roles;

CREATE POLICY "select_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admin_select_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "admin_insert_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "admin_update_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "admin_delete_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

-- DIARIES: add admin override for SELECT
DROP POLICY IF EXISTS "select_diaries" ON public.diaries;
DROP POLICY IF EXISTS "select_diaries_admin" ON public.diaries;
DROP POLICY IF EXISTS "insert_diaries" ON public.diaries;
DROP POLICY IF EXISTS "update_diaries" ON public.diaries;

CREATE POLICY "select_diaries" ON public.diaries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "select_diaries_admin" ON public.diaries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "insert_diaries" ON public.diaries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_diaries" ON public.diaries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
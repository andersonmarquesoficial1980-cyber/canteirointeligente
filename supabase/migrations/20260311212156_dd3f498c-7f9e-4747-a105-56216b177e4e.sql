-- Fix: allow all authenticated users to SELECT from funcionarios
DROP POLICY IF EXISTS "select_funcionarios" ON public.funcionarios;
CREATE POLICY "select_funcionarios" ON public.funcionarios
  FOR SELECT TO authenticated USING (true);

-- Allow admin to UPDATE and DELETE profiles
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admin to INSERT/UPDATE/DELETE user_roles
DROP POLICY IF EXISTS "admin_insert_user_roles" ON public.user_roles;
CREATE POLICY "admin_insert_user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_update_user_roles" ON public.user_roles;
CREATE POLICY "admin_update_user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_delete_user_roles" ON public.user_roles;
CREATE POLICY "admin_delete_user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix 1: PRIVILEGE ESCALATION - only admins can insert user_roles
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

-- Fix 2: EXPOSED_SENSITIVE_DATA - restrict profiles SELECT to own row or admin
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::text));

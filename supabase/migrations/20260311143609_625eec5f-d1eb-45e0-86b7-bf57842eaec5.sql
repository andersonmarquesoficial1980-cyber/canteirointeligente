-- Drop ALL existing policies on profiles and user_roles, then recreate as simple PERMISSIVE

-- PROFILES: drop everything
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

-- PROFILES: simple permissive policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::text));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::text));

-- USER_ROLES: simple permissive policies
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::text));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::text));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::text));
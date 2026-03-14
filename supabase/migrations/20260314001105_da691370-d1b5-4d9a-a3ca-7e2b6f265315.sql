-- 1. Add company_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT NULL;

-- 2. Fix overly-permissive SELECT policy on profiles
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

-- Users can see their own full profile
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can see all profiles
CREATE POLICY "select_all_profiles_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

-- Allow INSERT for profile auto-creation (edge function or trigger)
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
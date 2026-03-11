-- Fix rdo_diarios RLS: owner-based SELECT + admin override, strict INSERT
DROP POLICY IF EXISTS "select_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "insert_rdo_diarios" ON public.rdo_diarios;

-- SELECT: owner sees own, admin sees all
CREATE POLICY "select_own_rdo_diarios" ON public.rdo_diarios
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "select_all_rdo_diarios_admin" ON public.rdo_diarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

-- INSERT: user_id must match auth.uid(), no NULLs allowed
CREATE POLICY "insert_rdo_diarios" ON public.rdo_diarios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
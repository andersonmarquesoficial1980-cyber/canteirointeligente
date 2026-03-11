-- Fix funcionarios: restrict SELECT to admin only (PII protection)
DROP POLICY IF EXISTS "select_funcionarios" ON public.funcionarios;
CREATE POLICY "select_funcionarios" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));
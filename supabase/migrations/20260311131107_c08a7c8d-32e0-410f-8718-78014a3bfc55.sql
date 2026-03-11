
-- Fix: restrict SELECT on configuracoes_relatorio to admins only
DROP POLICY IF EXISTS "Authenticated users can select configuracoes_relatorio" ON public.configuracoes_relatorio;
CREATE POLICY "Admins can select configuracoes_relatorio"
  ON public.configuracoes_relatorio
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::text));

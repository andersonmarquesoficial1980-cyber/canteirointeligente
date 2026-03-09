
-- Fix 1: Restrict configuracoes_relatorio INSERT/UPDATE to admins only
DROP POLICY IF EXISTS "Authenticated users can insert configuracoes_relatorio" ON public.configuracoes_relatorio;
DROP POLICY IF EXISTS "Authenticated users can update configuracoes_relatorio" ON public.configuracoes_relatorio;

CREATE POLICY "Admins can insert configuracoes_relatorio" ON public.configuracoes_relatorio
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update configuracoes_relatorio" ON public.configuracoes_relatorio
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Fix 2: Restrict rdo_diarios UPDATE to record owner only
DROP POLICY IF EXISTS "Authenticated users can update rdo_diarios" ON public.rdo_diarios;

CREATE POLICY "Users can update own rdo_diarios" ON public.rdo_diarios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

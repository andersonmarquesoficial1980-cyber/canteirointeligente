
-- Fix rdo_diarios INSERT: allow any authenticated user to insert their own rows
DROP POLICY IF EXISTS "insert_rdo_diarios" ON public.rdo_diarios;
CREATE POLICY "insert_rdo_diarios" ON public.rdo_diarios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix rdo_producao INSERT: allow any authenticated user
DROP POLICY IF EXISTS "insert_rdo_producao" ON public.rdo_producao;
CREATE POLICY "insert_rdo_producao" ON public.rdo_producao
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix rdo_efetivo INSERT: allow any authenticated user
DROP POLICY IF EXISTS "insert_rdo_efetivo" ON public.rdo_efetivo;
CREATE POLICY "insert_rdo_efetivo" ON public.rdo_efetivo
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix rdo_mancha_areia INSERT: allow any authenticated user
DROP POLICY IF EXISTS "insert_rdo_mancha_areia" ON public.rdo_mancha_areia;
CREATE POLICY "insert_rdo_mancha_areia" ON public.rdo_mancha_areia
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix rdo_temperatura_espalhamento INSERT: allow any authenticated user
DROP POLICY IF EXISTS "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento;
CREATE POLICY "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix rdo_banho_ligacao INSERT: allow any authenticated user
DROP POLICY IF EXISTS "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao;
CREATE POLICY "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Add UPDATE policy for rdo_diarios (owner + admin)
DROP POLICY IF EXISTS "update_own_rdo_diarios" ON public.rdo_diarios;
CREATE POLICY "update_own_rdo_diarios" ON public.rdo_diarios
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

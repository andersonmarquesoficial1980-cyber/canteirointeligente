
-- Tighten sub-table INSERT policies to check ownership via rdo_diarios
DROP POLICY IF EXISTS "insert_rdo_producao" ON public.rdo_producao;
CREATE POLICY "insert_rdo_producao" ON public.rdo_producao
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_producao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "insert_rdo_efetivo" ON public.rdo_efetivo;
CREATE POLICY "insert_rdo_efetivo" ON public.rdo_efetivo
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_efetivo.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "insert_rdo_mancha_areia" ON public.rdo_mancha_areia;
CREATE POLICY "insert_rdo_mancha_areia" ON public.rdo_mancha_areia
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_mancha_areia.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento;
CREATE POLICY "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_temperatura_espalhamento.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao;
CREATE POLICY "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_banho_ligacao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

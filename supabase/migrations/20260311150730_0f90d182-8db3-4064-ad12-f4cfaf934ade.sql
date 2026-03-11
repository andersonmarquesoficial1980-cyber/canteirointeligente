
-- Fix cross-ownership on RDO child tables (rdo_diarios children)
-- rdo_producao
DROP POLICY IF EXISTS "select_rdo_producao" ON public.rdo_producao;
DROP POLICY IF EXISTS "insert_rdo_producao" ON public.rdo_producao;
CREATE POLICY "select_rdo_producao" ON public.rdo_producao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_producao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_rdo_producao" ON public.rdo_producao FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_producao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

-- rdo_efetivo
DROP POLICY IF EXISTS "select_rdo_efetivo" ON public.rdo_efetivo;
DROP POLICY IF EXISTS "insert_rdo_efetivo" ON public.rdo_efetivo;
CREATE POLICY "select_rdo_efetivo" ON public.rdo_efetivo FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_efetivo.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_rdo_efetivo" ON public.rdo_efetivo FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_efetivo.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

-- rdo_mancha_areia
DROP POLICY IF EXISTS "select_rdo_mancha_areia" ON public.rdo_mancha_areia;
DROP POLICY IF EXISTS "insert_rdo_mancha_areia" ON public.rdo_mancha_areia;
CREATE POLICY "select_rdo_mancha_areia" ON public.rdo_mancha_areia FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_mancha_areia.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_rdo_mancha_areia" ON public.rdo_mancha_areia FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_mancha_areia.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

-- rdo_temperatura_espalhamento
DROP POLICY IF EXISTS "select_rdo_temperatura" ON public.rdo_temperatura_espalhamento;
DROP POLICY IF EXISTS "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento;
CREATE POLICY "select_rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_temperatura_espalhamento.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_temperatura_espalhamento.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

-- rdo_banho_ligacao
DROP POLICY IF EXISTS "select_rdo_banho_ligacao" ON public.rdo_banho_ligacao;
DROP POLICY IF EXISTS "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao;
CREATE POLICY "select_rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_banho_ligacao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rdo_diarios WHERE rdo_diarios.id = rdo_banho_ligacao.rdo_id AND (rdo_diarios.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

-- fueling_entries (references diaries, not rdo_diarios)
DROP POLICY IF EXISTS "select_fueling_entries" ON public.fueling_entries;
DROP POLICY IF EXISTS "insert_fueling_entries" ON public.fueling_entries;
CREATE POLICY "select_fueling_entries" ON public.fueling_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = fueling_entries.diary_id AND (diaries.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));
CREATE POLICY "insert_fueling_entries" ON public.fueling_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = fueling_entries.diary_id AND (diaries.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::text))));

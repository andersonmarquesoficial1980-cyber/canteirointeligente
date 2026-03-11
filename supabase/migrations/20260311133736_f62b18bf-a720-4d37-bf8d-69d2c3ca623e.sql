
-- ========================================================
-- RESET TOTAL: Drop ALL existing RLS policies, then recreate as PERMISSIVE
-- ========================================================

-- 1. DROP ALL EXISTING POLICIES ON ALL TABLES
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ========================================================
-- 2. RECREATE ALL POLICIES AS PERMISSIVE
-- ========================================================

-- ---- bit_entries (owner-based via diaries) ----
CREATE POLICY "select_bit_entries" ON public.bit_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = bit_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "insert_bit_entries" ON public.bit_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = bit_entries.diary_id AND diaries.user_id = auth.uid()));

-- ---- checklist_entries (owner-based via diaries) ----
CREATE POLICY "select_checklist_entries" ON public.checklist_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = checklist_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "insert_checklist_entries" ON public.checklist_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = checklist_entries.diary_id AND diaries.user_id = auth.uid()));

-- ---- configuracoes_relatorio (admin only) ----
CREATE POLICY "select_configuracoes_relatorio" ON public.configuracoes_relatorio FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_configuracoes_relatorio" ON public.configuracoes_relatorio FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_configuracoes_relatorio" ON public.configuracoes_relatorio FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_configuracoes_relatorio" ON public.configuracoes_relatorio FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- diaries (owner-based) ----
CREATE POLICY "select_diaries" ON public.diaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "insert_diaries" ON public.diaries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_diaries" ON public.diaries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ---- empreiteiros (read all, write admin) ----
CREATE POLICY "select_empreiteiros" ON public.empreiteiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_empreiteiros" ON public.empreiteiros FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_empreiteiros" ON public.empreiteiros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_empreiteiros" ON public.empreiteiros FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- fornecedores (read all, write admin) ----
CREATE POLICY "select_fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- fueling_entries (auth read/insert) ----
CREATE POLICY "select_fueling_entries" ON public.fueling_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fueling_entries" ON public.fueling_entries FOR INSERT TO authenticated WITH CHECK (true);

-- ---- funcionarios (read all, write admin) ----
CREATE POLICY "select_funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- maquinas_frota (read all, write admin) ----
CREATE POLICY "select_maquinas_frota" ON public.maquinas_frota FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_maquinas_frota" ON public.maquinas_frota FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_maquinas_frota" ON public.maquinas_frota FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_maquinas_frota" ON public.maquinas_frota FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- materiais (read all, write admin) ----
CREATE POLICY "select_materiais" ON public.materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_materiais" ON public.materiais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_materiais" ON public.materiais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_materiais" ON public.materiais FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- ogs_reference (read all, write admin) ----
CREATE POLICY "select_ogs_reference" ON public.ogs_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_ogs_reference" ON public.ogs_reference FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_ogs_reference" ON public.ogs_reference FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_ogs_reference" ON public.ogs_reference FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- production_entries (owner-based via diaries) ----
CREATE POLICY "select_production_entries" ON public.production_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = production_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "insert_production_entries" ON public.production_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = production_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "update_production_entries" ON public.production_entries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = production_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "delete_production_entries" ON public.production_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = production_entries.diary_id AND diaries.user_id = auth.uid()));

-- ---- profiles (own profile + admin sees all) ----
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "select_all_profiles_admin" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admin_manage_profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- rdo_banho_ligacao (auth read/insert) ----
CREATE POLICY "select_rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR INSERT TO authenticated WITH CHECK (true);

-- ---- rdo_diarios (owner + admin read) ----
CREATE POLICY "select_rdo_diarios" ON public.rdo_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_diarios" ON public.rdo_diarios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "update_own_rdo_diarios" ON public.rdo_diarios FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ---- rdo_efetivo (auth read/insert) ----
CREATE POLICY "select_rdo_efetivo" ON public.rdo_efetivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_efetivo" ON public.rdo_efetivo FOR INSERT TO authenticated WITH CHECK (true);

-- ---- rdo_mancha_areia (auth read/insert) ----
CREATE POLICY "select_rdo_mancha_areia" ON public.rdo_mancha_areia FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_mancha_areia" ON public.rdo_mancha_areia FOR INSERT TO authenticated WITH CHECK (true);

-- ---- rdo_producao (auth read/insert) ----
CREATE POLICY "select_rdo_producao" ON public.rdo_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_producao" ON public.rdo_producao FOR INSERT TO authenticated WITH CHECK (true);

-- ---- rdo_temperatura_espalhamento (auth read/insert) ----
CREATE POLICY "select_rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR INSERT TO authenticated WITH CHECK (true);

-- ---- time_entries (owner-based via diaries) ----
CREATE POLICY "select_time_entries" ON public.time_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = time_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "insert_time_entries" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = time_entries.diary_id AND diaries.user_id = auth.uid()));

-- ---- tipos_servico (read all, write admin) ----
CREATE POLICY "select_tipos_servico" ON public.tipos_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_tipos_servico" ON public.tipos_servico FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_tipos_servico" ON public.tipos_servico FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_tipos_servico" ON public.tipos_servico FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---- user_roles (own read + admin manage) ----
CREATE POLICY "select_own_role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin_select_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- usinas (read all, write admin) ----
CREATE POLICY "select_usinas" ON public.usinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_usinas" ON public.usinas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_usinas" ON public.usinas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_usinas" ON public.usinas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

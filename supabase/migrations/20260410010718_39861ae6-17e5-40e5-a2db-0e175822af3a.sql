
-- 1. Helper function
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 2. Add company_id columns
ALTER TABLE public.aero_pav_gru_staff ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.ponto_registros ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.vt_tarifas ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.vt_funcionario_conducoes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_aero_pav_gru_staff_company ON public.aero_pav_gru_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_ponto_registros_company ON public.ponto_registros(company_id);
CREATE INDEX IF NOT EXISTS idx_vt_tarifas_company ON public.vt_tarifas(company_id);
CREATE INDEX IF NOT EXISTS idx_vt_funcionario_conducoes_company ON public.vt_funcionario_conducoes(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_diaries_company ON public.equipment_diaries(company_id);

-- 4. aero_pav_gru_staff RLS
DROP POLICY IF EXISTS "select_aero_staff" ON public.aero_pav_gru_staff;
DROP POLICY IF EXISTS "insert_aero_staff" ON public.aero_pav_gru_staff;
DROP POLICY IF EXISTS "update_aero_staff" ON public.aero_pav_gru_staff;
DROP POLICY IF EXISTS "delete_aero_staff" ON public.aero_pav_gru_staff;
CREATE POLICY "select_aero_staff" ON public.aero_pav_gru_staff FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_aero_staff" ON public.aero_pav_gru_staff FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_aero_staff" ON public.aero_pav_gru_staff FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_aero_staff" ON public.aero_pav_gru_staff FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. ponto_registros RLS
DROP POLICY IF EXISTS "select_ponto_registros" ON public.ponto_registros;
DROP POLICY IF EXISTS "insert_ponto_registros" ON public.ponto_registros;
DROP POLICY IF EXISTS "update_ponto_registros" ON public.ponto_registros;
DROP POLICY IF EXISTS "delete_ponto_registros" ON public.ponto_registros;
CREATE POLICY "select_ponto_registros" ON public.ponto_registros FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_ponto_registros" ON public.ponto_registros FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_ponto_registros" ON public.ponto_registros FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_ponto_registros" ON public.ponto_registros FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. vt_tarifas: drop ALL existing policies explicitly
DROP POLICY IF EXISTS "Allow authenticated" ON public.vt_tarifas;
DROP POLICY IF EXISTS "Policy para teste" ON public.vt_tarifas;
DROP POLICY IF EXISTS "select_vt_tarifas" ON public.vt_tarifas;
DROP POLICY IF EXISTS "insert_vt_tarifas" ON public.vt_tarifas;
DROP POLICY IF EXISTS "update_vt_tarifas" ON public.vt_tarifas;
DROP POLICY IF EXISTS "delete_vt_tarifas" ON public.vt_tarifas;
ALTER TABLE public.vt_tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_vt_tarifas" ON public.vt_tarifas FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_vt_tarifas" ON public.vt_tarifas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_vt_tarifas" ON public.vt_tarifas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_vt_tarifas" ON public.vt_tarifas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. vt_funcionario_conducoes
DROP POLICY IF EXISTS "Allow authenticated" ON public.vt_funcionario_conducoes;
DROP POLICY IF EXISTS "Policy para teste" ON public.vt_funcionario_conducoes;
DROP POLICY IF EXISTS "select_vt_funcionario_conducoes" ON public.vt_funcionario_conducoes;
DROP POLICY IF EXISTS "insert_vt_funcionario_conducoes" ON public.vt_funcionario_conducoes;
DROP POLICY IF EXISTS "update_vt_funcionario_conducoes" ON public.vt_funcionario_conducoes;
DROP POLICY IF EXISTS "delete_vt_funcionario_conducoes" ON public.vt_funcionario_conducoes;
ALTER TABLE public.vt_funcionario_conducoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_vt_func_cond" ON public.vt_funcionario_conducoes FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_vt_func_cond" ON public.vt_funcionario_conducoes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_vt_func_cond" ON public.vt_funcionario_conducoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_vt_func_cond" ON public.vt_funcionario_conducoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. equipment_diaries
DROP POLICY IF EXISTS "Allow authenticated" ON public.equipment_diaries;
DROP POLICY IF EXISTS "Policy para teste" ON public.equipment_diaries;
DROP POLICY IF EXISTS "select_equipment_diaries" ON public.equipment_diaries;
DROP POLICY IF EXISTS "insert_equipment_diaries" ON public.equipment_diaries;
DROP POLICY IF EXISTS "update_equipment_diaries" ON public.equipment_diaries;
DROP POLICY IF EXISTS "delete_equipment_diaries" ON public.equipment_diaries;
CREATE POLICY "select_equip_diaries" ON public.equipment_diaries FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert_equip_diaries" ON public.equipment_diaries FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update_equip_diaries" ON public.equipment_diaries FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_equip_diaries" ON public.equipment_diaries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- RLS for equipment_diaries
ALTER TABLE public.equipment_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_equipment_diaries" ON public.equipment_diaries
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "insert_equipment_diaries" ON public.equipment_diaries
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_own_equipment_diaries" ON public.equipment_diaries
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "delete_equipment_diaries" ON public.equipment_diaries
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS for equipment_time_entries
ALTER TABLE public.equipment_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_equipment_time_entries" ON public.equipment_time_entries
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_time_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "insert_equipment_time_entries" ON public.equipment_time_entries
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_time_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "delete_equipment_time_entries" ON public.equipment_time_entries
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_time_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for kma_calibration_entries
ALTER TABLE public.kma_calibration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_kma_calibration" ON public.kma_calibration_entries
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = kma_calibration_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "insert_kma_calibration" ON public.kma_calibration_entries
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = kma_calibration_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_company" ON public.companies
FOR SELECT TO authenticated
USING (id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

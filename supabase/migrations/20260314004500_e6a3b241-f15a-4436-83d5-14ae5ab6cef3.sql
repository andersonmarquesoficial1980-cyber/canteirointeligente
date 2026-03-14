
-- Fix RLS for tables that had policies dropped: re-add them
-- bit_entries
CREATE POLICY "select_bit_entries" ON public.bit_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = bit_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "insert_bit_entries" ON public.bit_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = bit_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- checklist_entries
CREATE POLICY "select_checklist_entries" ON public.checklist_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = checklist_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "insert_checklist_entries" ON public.checklist_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = checklist_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- fueling_entries
CREATE POLICY "select_fueling_entries" ON public.fueling_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = fueling_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "insert_fueling_entries" ON public.fueling_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = fueling_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- production_entries
CREATE POLICY "select_production_entries" ON public.production_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = production_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "insert_production_entries" ON public.production_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = production_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- time_entries
CREATE POLICY "select_time_entries" ON public.time_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = time_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "insert_time_entries" ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = time_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

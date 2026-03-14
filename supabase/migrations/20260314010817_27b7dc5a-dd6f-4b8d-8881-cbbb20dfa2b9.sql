-- RLS for equipment_diaries
ALTER TABLE public.equipment_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ed_select" ON public.equipment_diaries FOR SELECT TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "ed_insert" ON public.equipment_diaries FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "ed_update" ON public.equipment_diaries FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "ed_delete" ON public.equipment_diaries FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS for equipment_time_entries
ALTER TABLE public.equipment_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ete_select" ON public.equipment_time_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_time_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "ete_insert" ON public.equipment_time_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_time_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for kma_calibration_entries
ALTER TABLE public.kma_calibration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kma_select" ON public.kma_calibration_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = kma_calibration_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "kma_insert" ON public.kma_calibration_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = kma_calibration_entries.equipment_diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for equipment_production_areas
ALTER TABLE public.equipment_production_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "epa_select" ON public.equipment_production_areas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_production_areas.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "epa_insert" ON public.equipment_production_areas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_production_areas.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for bit_entries
ALTER TABLE public.bit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "be_select" ON public.bit_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = bit_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "be_insert" ON public.bit_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = bit_entries.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- RLS for equipment_bits
ALTER TABLE public.equipment_bits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eb_select" ON public.equipment_bits FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_bits.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "eb_insert" ON public.equipment_bits FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM equipment_diaries ed WHERE ed.id = equipment_bits.diary_id AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));
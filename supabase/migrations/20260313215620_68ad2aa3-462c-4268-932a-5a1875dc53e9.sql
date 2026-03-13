
-- Add user_id column to equipment_diaries for RLS
ALTER TABLE public.equipment_diaries ADD COLUMN IF NOT EXISTS user_id uuid;

-- Enable RLS
ALTER TABLE public.equipment_diaries ENABLE ROW LEVEL SECURITY;

-- Policies for equipment_diaries
CREATE POLICY "insert_own_equipment_diaries" ON public.equipment_diaries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "select_own_equipment_diaries" ON public.equipment_diaries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "update_own_equipment_diaries" ON public.equipment_diaries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- RLS for equipment_time_entries
ALTER TABLE public.equipment_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_equipment_time_entries" ON public.equipment_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.equipment_diaries
    WHERE id = equipment_time_entries.equipment_diary_id
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "select_equipment_time_entries" ON public.equipment_time_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.equipment_diaries
    WHERE id = equipment_time_entries.equipment_diary_id
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  ));

-- RLS for kma_calibration_entries
ALTER TABLE public.kma_calibration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_kma_calibration_entries" ON public.kma_calibration_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.equipment_diaries
    WHERE id = kma_calibration_entries.diary_id
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "select_kma_calibration_entries" ON public.kma_calibration_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.equipment_diaries
    WHERE id = kma_calibration_entries.diary_id
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  ));

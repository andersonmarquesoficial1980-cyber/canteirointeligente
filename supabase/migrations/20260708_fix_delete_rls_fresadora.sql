-- Fix: adicionar políticas DELETE para equipment_production_areas e bit_entries
-- Sem isso, o delete silently falha no modo edição e dados ficam duplicados

-- DELETE policy: equipment_production_areas
CREATE POLICY "epa_delete" ON public.equipment_production_areas FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM equipment_diaries ed
  WHERE ed.id = equipment_production_areas.diary_id
    AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
));

-- DELETE policy: bit_entries
CREATE POLICY "be_delete" ON public.bit_entries FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM equipment_diaries ed
  WHERE ed.id = bit_entries.diary_id
    AND (ed.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
));

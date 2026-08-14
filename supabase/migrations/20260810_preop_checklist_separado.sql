-- Medium-term rollout: Checklist Pré-Operação separado do diário
-- Objetivo: permitir envio pré-op antes da execução e vincular posteriormente ao diário

BEGIN;

-- 1) Header do checklist pré-op (independente do diário)
CREATE TABLE IF NOT EXISTS public.equipment_preop_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_fleet text NOT NULL,
  equipment_type text NOT NULL,
  truck_type text NULL,
  date date NOT NULL,
  period text NOT NULL,
  operator_name text NULL,
  created_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  diary_id uuid NULL REFERENCES public.equipment_diaries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_preop_checklists_period_check CHECK (period IN ('diurno','noturno'))
);

CREATE UNIQUE INDEX IF NOT EXISTS equipment_preop_checklists_company_fleet_date_period_key
  ON public.equipment_preop_checklists(company_id, equipment_fleet, date, period);

CREATE INDEX IF NOT EXISTS equipment_preop_checklists_diary_id_idx
  ON public.equipment_preop_checklists(diary_id);

-- 2) Itens do checklist pré-op (filhos)
CREATE TABLE IF NOT EXISTS public.equipment_preop_checklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preop_checklist_id uuid NOT NULL REFERENCES public.equipment_preop_checklists(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  status public.checklist_status NOT NULL,
  observation text NULL,
  photo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_preop_checklist_entries_unique_item UNIQUE(preop_checklist_id, item_id)
);

CREATE INDEX IF NOT EXISTS equipment_preop_checklist_entries_preop_id_idx
  ON public.equipment_preop_checklist_entries(preop_checklist_id);

-- 3) Vínculo explícito opcional no diário (retrocompatível)
ALTER TABLE public.equipment_diaries
  ADD COLUMN IF NOT EXISTS preop_checklist_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'equipment_diaries'
      AND constraint_name = 'equipment_diaries_preop_checklist_id_fkey'
  ) THEN
    ALTER TABLE public.equipment_diaries
      ADD CONSTRAINT equipment_diaries_preop_checklist_id_fkey
      FOREIGN KEY (preop_checklist_id)
      REFERENCES public.equipment_preop_checklists(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS equipment_diaries_preop_checklist_id_idx
  ON public.equipment_diaries(preop_checklist_id);

-- 4) RLS
ALTER TABLE public.equipment_preop_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_preop_checklist_entries ENABLE ROW LEVEL SECURITY;

-- Header: isolamento por company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklists'
      AND policyname='Isolamento company_id equipment_preop_checklists'
  ) THEN
    CREATE POLICY "Isolamento company_id equipment_preop_checklists"
      ON public.equipment_preop_checklists
      FOR ALL
      TO public
      USING (
        company_id IN (
          SELECT profiles.company_id
          FROM public.profiles
          WHERE profiles.user_id = auth.uid()
        )
      )
      WITH CHECK (
        company_id IN (
          SELECT profiles.company_id
          FROM public.profiles
          WHERE profiles.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Header: INSERT apenas do próprio usuário (ou admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklists'
      AND policyname='insert_equipment_preop_checklists'
  ) THEN
    CREATE POLICY insert_equipment_preop_checklists
      ON public.equipment_preop_checklists
      FOR INSERT
      TO authenticated
      WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text));
  END IF;
END $$;

-- Header: UPDATE só dono/admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklists'
      AND policyname='update_equipment_preop_checklists'
  ) THEN
    CREATE POLICY update_equipment_preop_checklists
      ON public.equipment_preop_checklists
      FOR UPDATE
      TO authenticated
      USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text))
      WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text));
  END IF;
END $$;

-- Entries: SELECT/INSERT/UPDATE/DELETE via header autorizado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklist_entries'
      AND policyname='select_equipment_preop_checklist_entries'
  ) THEN
    CREATE POLICY select_equipment_preop_checklist_entries
      ON public.equipment_preop_checklist_entries
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.equipment_preop_checklists h
          WHERE h.id = equipment_preop_checklist_entries.preop_checklist_id
            AND (
              h.company_id IN (
                SELECT profiles.company_id
                FROM public.profiles
                WHERE profiles.user_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklist_entries'
      AND policyname='insert_equipment_preop_checklist_entries'
  ) THEN
    CREATE POLICY insert_equipment_preop_checklist_entries
      ON public.equipment_preop_checklist_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.equipment_preop_checklists h
          WHERE h.id = equipment_preop_checklist_entries.preop_checklist_id
            AND (h.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklist_entries'
      AND policyname='update_equipment_preop_checklist_entries'
  ) THEN
    CREATE POLICY update_equipment_preop_checklist_entries
      ON public.equipment_preop_checklist_entries
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.equipment_preop_checklists h
          WHERE h.id = equipment_preop_checklist_entries.preop_checklist_id
            AND (h.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.equipment_preop_checklists h
          WHERE h.id = equipment_preop_checklist_entries.preop_checklist_id
            AND (h.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='equipment_preop_checklist_entries'
      AND policyname='delete_equipment_preop_checklist_entries'
  ) THEN
    CREATE POLICY delete_equipment_preop_checklist_entries
      ON public.equipment_preop_checklist_entries
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.equipment_preop_checklists h
          WHERE h.id = equipment_preop_checklist_entries.preop_checklist_id
            AND (h.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::text))
        )
      );
  END IF;
END $$;

COMMIT;

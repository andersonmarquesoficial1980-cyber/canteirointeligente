CREATE TABLE IF NOT EXISTS public.aero_pav_gru_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  funcao text NOT NULL DEFAULT '',
  telefone text DEFAULT '',
  turno text NOT NULL DEFAULT 'indefinido',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.aero_pav_gru_staff ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aero_pav_gru_staff' AND policyname = 'select_aero_staff') THEN
    CREATE POLICY select_aero_staff ON public.aero_pav_gru_staff FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aero_pav_gru_staff' AND policyname = 'insert_aero_staff') THEN
    CREATE POLICY insert_aero_staff ON public.aero_pav_gru_staff FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aero_pav_gru_staff' AND policyname = 'update_aero_staff') THEN
    CREATE POLICY update_aero_staff ON public.aero_pav_gru_staff FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aero_pav_gru_staff' AND policyname = 'delete_aero_staff') THEN
    CREATE POLICY delete_aero_staff ON public.aero_pav_gru_staff FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;
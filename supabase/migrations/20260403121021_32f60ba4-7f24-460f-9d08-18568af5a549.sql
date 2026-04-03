
-- Face registrations table
CREATE TABLE public.face_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.aero_pav_gru_staff(id) ON DELETE CASCADE,
  descriptor jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id)
);
ALTER TABLE public.face_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_face_registrations" ON public.face_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_face_registrations" ON public.face_registrations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_face_registrations" ON public.face_registrations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete_face_registrations" ON public.face_registrations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Ponto registros table
CREATE TABLE public.ponto_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.aero_pav_gru_staff(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'entrada',
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora time NOT NULL DEFAULT CURRENT_TIME,
  lat double precision,
  lng double precision,
  ogs_id uuid REFERENCES public.ogs_reference(id),
  ogs_number text,
  photo_url text,
  metodo text NOT NULL DEFAULT 'facial',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ponto_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_ponto_registros" ON public.ponto_registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_ponto_registros" ON public.ponto_registros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_ponto_registros" ON public.ponto_registros FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_ponto_registros" ON public.ponto_registros FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add jornada_horas to ogs_reference for configurable shift length
ALTER TABLE public.ogs_reference ADD COLUMN IF NOT EXISTS jornada_horas numeric DEFAULT 8;

-- Add lat/lng to ogs_reference for geofencing
ALTER TABLE public.ogs_reference ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.ogs_reference ADD COLUMN IF NOT EXISTS lng double precision;

-- Storage bucket for face photos
INSERT INTO storage.buckets (id, name, public) VALUES ('face-photos', 'face-photos', false) ON CONFLICT DO NOTHING;

CREATE POLICY "face_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'face-photos');
CREATE POLICY "face_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'face-photos');
CREATE POLICY "face_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'face-photos');
CREATE POLICY "face_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'face-photos');

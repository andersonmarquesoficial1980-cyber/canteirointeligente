
CREATE TABLE public.maquinas_frota (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL,
  frota text NOT NULL,
  tipo text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.maquinas_frota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on maquinas_frota"
  ON public.maquinas_frota
  FOR SELECT
  TO anon, authenticated
  USING (true);

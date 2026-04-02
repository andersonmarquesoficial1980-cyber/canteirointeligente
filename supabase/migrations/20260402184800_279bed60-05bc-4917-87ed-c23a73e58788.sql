
-- Tabela de tarifas de transporte (configurável pelo admin)
CREATE TABLE public.vt_tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_transporte text NOT NULL,
  valor_unitario numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vt_tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_vt_tarifas" ON public.vt_tarifas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_vt_tarifas" ON public.vt_tarifas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "update_vt_tarifas" ON public.vt_tarifas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_vt_tarifas" ON public.vt_tarifas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed tarifas iniciais
INSERT INTO public.vt_tarifas (tipo_transporte, valor_unitario) VALUES
  ('Ônibus Municipal', 4.40),
  ('Metrô', 4.40),
  ('Trem', 4.40),
  ('Intermunicipal', 7.50);

-- Tabela de conduções vinculadas a funcionário
CREATE TABLE public.vt_funcionario_conducoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.aero_pav_gru_staff(id) ON DELETE CASCADE,
  tarifa_id uuid NOT NULL REFERENCES public.vt_tarifas(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vt_funcionario_conducoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_vt_conducoes" ON public.vt_funcionario_conducoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_vt_conducoes" ON public.vt_funcionario_conducoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_vt_conducoes" ON public.vt_funcionario_conducoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete_vt_conducoes" ON public.vt_funcionario_conducoes FOR DELETE TO authenticated USING (true);

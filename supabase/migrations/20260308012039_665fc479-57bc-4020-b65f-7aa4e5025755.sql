CREATE TABLE public.configuracoes_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emails_destino text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_relatorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select configuracoes_relatorio"
  ON public.configuracoes_relatorio FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert configuracoes_relatorio"
  ON public.configuracoes_relatorio FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update configuracoes_relatorio"
  ON public.configuracoes_relatorio FOR UPDATE TO authenticated USING (true);

-- Insert default row
INSERT INTO public.configuracoes_relatorio (emails_destino) VALUES ('{}');
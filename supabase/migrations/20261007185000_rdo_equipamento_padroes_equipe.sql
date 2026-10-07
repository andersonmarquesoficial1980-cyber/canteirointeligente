-- Configuração de tipos esperados por equipe no RDO. Sem backfill de equipes/lançamentos históricos.
ALTER TABLE public.rdo_diarios
  ADD COLUMN IF NOT EXISTS equipe text,
  ADD COLUMN IF NOT EXISTS equipamentos_nao_utilizados jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.rdo_equipamento_padroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  equipe text NOT NULL CHECK (length(trim(equipe)) > 0),
  tipo text NOT NULL CHECK (length(trim(tipo)) > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, equipe, tipo)
);
CREATE INDEX IF NOT EXISTS rdo_equipamento_padroes_empresa_equipe
  ON public.rdo_equipamento_padroes(company_id, equipe) WHERE ativo;

ALTER TABLE public.rdo_equipamento_padroes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.rdo_equipamento_padroes TO authenticated;
CREATE POLICY rdo_equipamento_padroes_read ON public.rdo_equipamento_padroes
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id() OR public.is_super_admin());
CREATE POLICY rdo_equipamento_padroes_insert ON public.rdo_equipamento_padroes
  FOR INSERT TO authenticated WITH CHECK (
    public.is_super_admin() OR
    (company_id = public.get_user_company_id() AND EXISTS (
      SELECT 1 FROM public.user_permissions p
      WHERE p.user_id = auth.uid() AND p.company_id = rdo_equipamento_padroes.company_id AND p.is_admin = true
    ))
  );
CREATE POLICY rdo_equipamento_padroes_update ON public.rdo_equipamento_padroes
  FOR UPDATE TO authenticated USING (
    public.is_super_admin() OR
    (company_id = public.get_user_company_id() AND EXISTS (
      SELECT 1 FROM public.user_permissions p
      WHERE p.user_id = auth.uid() AND p.company_id = rdo_equipamento_padroes.company_id AND p.is_admin = true
    ))
  ) WITH CHECK (
    public.is_super_admin() OR
    (company_id = public.get_user_company_id() AND EXISTS (
      SELECT 1 FROM public.user_permissions p
      WHERE p.user_id = auth.uid() AND p.company_id = rdo_equipamento_padroes.company_id AND p.is_admin = true
    ))
  );
-- A remoção é lógica (ativo=false); não conceder DELETE.

-- Empresas terceirizadas
CREATE TABLE IF NOT EXISTS public.empresas_terceiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas_terceiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_member_all_et" ON public.empresas_terceiras;
CREATE POLICY "empresa_member_all_et" ON public.empresas_terceiras
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Funcionários terceirizados
CREATE TABLE IF NOT EXISTS public.funcionarios_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas_terceiras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios_terceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_member_all_ft" ON public.funcionarios_terceiros;
CREATE POLICY "empresa_member_all_ft" ON public.funcionarios_terceiros
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Efetivo terceirizado no RDO
CREATE TABLE IF NOT EXISTS public.rdo_efetivo_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_diarios(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas_terceiras(id),
  empresa_nome text NOT NULL,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_terceiros(id),
  funcionario_nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_efetivo_terceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_member_all_ret" ON public.rdo_efetivo_terceiros;
CREATE POLICY "empresa_member_all_ret" ON public.rdo_efetivo_terceiros
  USING (EXISTS (
    SELECT 1 FROM public.rdo_diarios rd
    JOIN public.profiles p ON p.company_id = rd.company_id
    WHERE rd.id = rdo_id AND p.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rdo_diarios rd
    JOIN public.profiles p ON p.company_id = rd.company_id
    WHERE rd.id = rdo_id AND p.id = auth.uid()
  ));

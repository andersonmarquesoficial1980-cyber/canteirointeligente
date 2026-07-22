-- Add infra description field and new service types for RDO Técnico (CAUQ)
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS infra_descricao text;

COMMENT ON COLUMN public.rdo_engenheiro.infra_descricao IS 'Descrição do tipo de infraestrutura executada quando tipo de serviço inclui INFRA';

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'APLICAÇÃO DE BGTC', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'APLICAÇÃO DE BGTC' AND vinculo_rdo = 'CAUQ'
);

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'APLICAÇÃO DE MACADAME', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'APLICAÇÃO DE MACADAME' AND vinculo_rdo = 'CAUQ'
);

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'APLICAÇÃO DE CAUQ-HIMA', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'APLICAÇÃO DE CAUQ-HIMA' AND vinculo_rdo = 'CAUQ'
);

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'APLICAÇÃO DE BN25', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'APLICAÇÃO DE BN25' AND vinculo_rdo = 'CAUQ'
);

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'DEMOLIÇÃO', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'DEMOLIÇÃO' AND vinculo_rdo = 'CAUQ'
);

INSERT INTO public.tipos_servico (nome, vinculo_rdo)
SELECT 'INFRA', 'CAUQ'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico WHERE nome = 'INFRA' AND vinculo_rdo = 'CAUQ'
);
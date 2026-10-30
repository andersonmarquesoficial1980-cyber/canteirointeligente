-- RDO Técnico: Massa Fria (sacos), nota do controle tecnológico e serviços GEOGRELHA / MASSA FRIA. Aditiva.
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS massa_fria_sacos numeric,
  ADD COLUMN IF NOT EXISTS controle_tecnologico_nota smallint CHECK (controle_tecnologico_nota IS NULL OR controle_tecnologico_nota BETWEEN 1 AND 5);

INSERT INTO public.tipos_servico (nome, vinculo_rdo, vinculos, company_id)
SELECT v.nome, 'CAUQ', ARRAY['CAUQ','PAVIMENTACAO'], 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
FROM (VALUES ('GEOGRELHA'), ('MASSA FRIA')) AS v(nome)
WHERE NOT EXISTS (SELECT 1 FROM public.tipos_servico t WHERE t.nome = v.nome);

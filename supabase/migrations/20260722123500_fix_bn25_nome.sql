-- Corrige nomenclatura do tipo de serviço: BM25 -> BN25
-- Escopo: RDO Pavimentação (apontador) e RDO Técnico (engenharia)

-- 1) Catálogo de tipos de serviço (fonte dos dropdowns)
UPDATE public.tipos_servico
SET nome = 'APLICAÇÃO DE BN25'
WHERE nome = 'APLICAÇÃO DE BM25'
  AND vinculo_rdo = 'CAUQ';

-- 2) Registros já lançados no RDO de Pavimentação
UPDATE public.rdo_producao
SET tipo_servico = 'APLICAÇÃO DE BN25'
WHERE tipo_servico = 'APLICAÇÃO DE BM25';

-- 3) Registros já lançados no RDO Técnico (campo texto, pode vir em lista)
UPDATE public.rdo_engenheiro
SET tipo_servico = REPLACE(tipo_servico, 'APLICAÇÃO DE BM25', 'APLICAÇÃO DE BN25')
WHERE COALESCE(tipo_servico, '') LIKE '%APLICAÇÃO DE BM25%';

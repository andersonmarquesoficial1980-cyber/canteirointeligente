-- Add equipment conformity fields to Engineering RDO
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS equipamentos_conforme boolean,
  ADD COLUMN IF NOT EXISTS equipamentos_nao_conformes text;

COMMENT ON COLUMN public.rdo_engenheiro.equipamentos_conforme IS 'Condição dos equipamentos na obra: TRUE=conforme, FALSE=não conforme';
COMMENT ON COLUMN public.rdo_engenheiro.equipamentos_nao_conformes IS 'Descrição dos equipamentos não conformes quando aplicável';
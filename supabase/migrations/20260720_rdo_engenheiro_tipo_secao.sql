-- Add section type field for specific engineering RDO works (Motiva/PMSP)
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS tipo_secao text;

COMMENT ON COLUMN public.rdo_engenheiro.tipo_secao IS 'Seção(ões) da obra selecionadas no RDO técnico: Funcional, Intermediário, Estrutural';
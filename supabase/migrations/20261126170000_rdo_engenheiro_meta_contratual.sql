-- RDO Técnico: "Atingiu meta contratual?" (Sim/Não) + motivo quando Não (aditivo, sem DEFAULT)
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS meta_contratual_atingida boolean,
  ADD COLUMN IF NOT EXISTS meta_contratual_motivo text,
  ADD COLUMN IF NOT EXISTS meta_contratual_outro text;

COMMENT ON COLUMN public.rdo_engenheiro.meta_contratual_atingida IS 'Atingiu meta contratual no dia? null = não respondido / dia sem produção';
COMMENT ON COLUMN public.rdo_engenheiro.meta_contratual_motivo IS 'Motivo quando não atingiu a meta (lista fixa; "Outro" usa meta_contratual_outro)';
COMMENT ON COLUMN public.rdo_engenheiro.meta_contratual_outro IS 'Texto livre quando motivo = Outro';

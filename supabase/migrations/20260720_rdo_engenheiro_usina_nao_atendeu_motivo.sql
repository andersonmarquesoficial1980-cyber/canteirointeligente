-- Add reason field when asphalt plant does not meet demand in Engineering RDO
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS usina_nao_atendeu_motivo text;

COMMENT ON COLUMN public.rdo_engenheiro.usina_nao_atendeu_motivo IS
  'Motivo informado pelo engenheiro quando usina_atendeu = false';

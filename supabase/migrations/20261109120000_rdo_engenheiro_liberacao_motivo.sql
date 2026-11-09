-- RDO Técnico: liberação da obra no horário — motivo estruturado e horários previsto/real.
-- Aditiva e não destrutiva: colunas novas, anuláveis.
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS autorizacao_motivo text,
  ADD COLUMN IF NOT EXISTS autorizacao_horario_previsto time,
  ADD COLUMN IF NOT EXISTS autorizacao_horario_real time;

COMMENT ON COLUMN public.rdo_engenheiro.autorizacao_motivo IS 'Motivo da liberação fora do horário (ex.: Fiscalização não liberou a pista)';
COMMENT ON COLUMN public.rdo_engenheiro.autorizacao_horario_previsto IS 'Horário previsto de liberação da obra';
COMMENT ON COLUMN public.rdo_engenheiro.autorizacao_horario_real IS 'Horário real em que a obra foi liberada';

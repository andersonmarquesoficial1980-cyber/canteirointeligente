-- RDO: rastrear última edição sem trocar o autor original (user_id)
BEGIN;

ALTER TABLE public.rdo_diarios
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado_por uuid,
  ADD COLUMN IF NOT EXISTS editado_por_nome text;

COMMENT ON COLUMN public.rdo_diarios.editado_em IS 'Data/hora da última edição manual do RDO.';
COMMENT ON COLUMN public.rdo_diarios.editado_por IS 'user_id de quem fez a última edição.';
COMMENT ON COLUMN public.rdo_diarios.editado_por_nome IS 'Nome exibível de quem fez a última edição.';

COMMIT;

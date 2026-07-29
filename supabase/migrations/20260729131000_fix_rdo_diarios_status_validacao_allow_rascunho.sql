-- Permite salvar RDO em rascunho sem quebrar os status já existentes.
-- Erro corrigido: rdo_diarios_status_validacao_check bloqueando valor 'rascunho'.

DO $$
DECLARE
  allowed_values text;
BEGIN
  -- Monta a lista de status atualmente existentes na tabela + novo status 'rascunho'
  SELECT string_agg(quote_literal(s.status_validacao), ', ' ORDER BY s.status_validacao)
    INTO allowed_values
  FROM (
    SELECT DISTINCT status_validacao
    FROM public.rdo_diarios
    WHERE status_validacao IS NOT NULL

    UNION

    SELECT 'rascunho'::text
  ) AS s;

  -- Remove o check antigo, se existir
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rdo_diarios_status_validacao_check'
      AND conrelid = 'public.rdo_diarios'::regclass
  ) THEN
    ALTER TABLE public.rdo_diarios
      DROP CONSTRAINT rdo_diarios_status_validacao_check;
  END IF;

  -- Recria o check preservando status já usados no banco e incluindo 'rascunho'
  EXECUTE format(
    'ALTER TABLE public.rdo_diarios ADD CONSTRAINT rdo_diarios_status_validacao_check CHECK (status_validacao IS NULL OR status_validacao IN (%s));',
    allowed_values
  );
END $$;
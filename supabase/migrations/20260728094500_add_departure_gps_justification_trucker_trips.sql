-- Justificativa de ausência de GPS na saída (WF Carreteiros)
-- Não bloqueia lançamento; apenas exige rastreabilidade quando departure_geo = null

BEGIN;

ALTER TABLE public.trucker_trips
  ADD COLUMN IF NOT EXISTS departure_gps_issue_reason text,
  ADD COLUMN IF NOT EXISTS departure_gps_issue_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trucker_trips_departure_gps_issue_reason_check'
  ) THEN
    ALTER TABLE public.trucker_trips
      ADD CONSTRAINT trucker_trips_departure_gps_issue_reason_check
      CHECK (
        departure_gps_issue_reason IS NULL
        OR departure_gps_issue_reason IN (
          'SEM_SINAL_RODOVIA',
          'GPS_DESATIVADO_APARELHO',
          'PERMISSAO_NEGADA',
          'FALHA_TEMPORARIA',
          'OUTRO'
        )
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.trucker_trips.departure_gps_issue_reason IS 'Motivo padronizado da ausência de GPS na saída';
COMMENT ON COLUMN public.trucker_trips.departure_gps_issue_notes IS 'Observação complementar quando motivo = OUTRO';

COMMIT;

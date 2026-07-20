-- Add weather fields to engineering RDO
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS choveu boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS intensidade_chuva text;

COMMENT ON COLUMN public.rdo_engenheiro.choveu IS 'Indica se houve chuva no período da obra';
COMMENT ON COLUMN public.rdo_engenheiro.intensidade_chuva IS 'Intensidade da chuva quando choveu: Fraco, Moderado ou Forte';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rdo_engenheiro_intensidade_chuva_check'
  ) THEN
    ALTER TABLE public.rdo_engenheiro
      ADD CONSTRAINT rdo_engenheiro_intensidade_chuva_check
      CHECK (
        intensidade_chuva IS NULL
        OR intensidade_chuva IN ('Fraco', 'Moderado', 'Forte')
      );
  END IF;
END;
$$;
-- Add reason fields when there is no production in Engineering RDO
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS motivo_sem_producao text,
  ADD COLUMN IF NOT EXISTS outro_motivo_sem_producao text;

COMMENT ON COLUMN public.rdo_engenheiro.motivo_sem_producao IS 'Motivo da não produção: Chuva, Sem Atividade, Folga / Feriado ou Outro';
COMMENT ON COLUMN public.rdo_engenheiro.outro_motivo_sem_producao IS 'Descrição livre quando motivo_sem_producao = Outro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rdo_engenheiro_motivo_sem_producao_check'
  ) THEN
    ALTER TABLE public.rdo_engenheiro
      ADD CONSTRAINT rdo_engenheiro_motivo_sem_producao_check
      CHECK (
        motivo_sem_producao IS NULL
        OR motivo_sem_producao IN ('Chuva', 'Sem Atividade', 'Folga / Feriado', 'Outro')
      );
  END IF;
END;
$$;

-- Fase: materiais com multi-seleção real (Onde aparece + Tipo de Uso)
-- Mantém compatibilidade com legado (vinculo_rdo/tipo_uso)

ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS vinculos text[];

ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS tipos_uso text[];

-- Backfill seguro para registros existentes
UPDATE public.materiais
SET vinculos = ARRAY[COALESCE(NULLIF(vinculo_rdo, ''), 'TODOS')]::text[]
WHERE vinculos IS NULL;

UPDATE public.materiais
SET tipos_uso = CASE
  WHEN COALESCE(NULLIF(tipo_uso, ''), 'Nota Fiscal') = 'Ambos'
    THEN ARRAY['Nota Fiscal', 'Transporte']::text[]
  ELSE ARRAY[COALESCE(NULLIF(tipo_uso, ''), 'Nota Fiscal')]::text[]
END
WHERE tipos_uso IS NULL;

-- Higienização mínima de arrays vazios
UPDATE public.materiais
SET vinculos = ARRAY['TODOS']::text[]
WHERE vinculos IS NULL OR array_length(vinculos, 1) IS NULL;

UPDATE public.materiais
SET tipos_uso = ARRAY['Nota Fiscal']::text[]
WHERE tipos_uso IS NULL OR array_length(tipos_uso, 1) IS NULL;

CREATE INDEX IF NOT EXISTS idx_materiais_vinculos_gin ON public.materiais USING gin (vinculos);
CREATE INDEX IF NOT EXISTS idx_materiais_tipos_uso_gin ON public.materiais USING gin (tipos_uso);

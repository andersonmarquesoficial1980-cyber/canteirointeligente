-- Define quem aparece no campo "Engenheiro responsável" do RDO
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS is_engenheiro boolean;

ALTER TABLE public.employees
ALTER COLUMN is_engenheiro SET DEFAULT false;

UPDATE public.employees
SET is_engenheiro = false
WHERE is_engenheiro IS NULL;

-- Backfill inicial: quem já tem função de Engenheiro
UPDATE public.employees
SET is_engenheiro = true
WHERE upper(coalesce(role, '')) LIKE '%ENGENHEIRO%';
-- Adiciona coluna condicao em maquinas_frota (fonte real do Admin de Equipamentos)
ALTER TABLE public.maquinas_frota ADD COLUMN IF NOT EXISTS condicao text NOT NULL DEFAULT 'PROPRIO';

-- Migra: empresa preenchida e não PRÓPRIO/FREMIX = TERCEIRO
UPDATE public.maquinas_frota 
SET condicao = 'TERCEIRO' 
WHERE categoria = 'locado' 
   OR (empresa IS NOT NULL AND empresa != '' 
       AND upper(empresa) NOT IN ('PRÓPRIO', 'PROPRIO', 'FREMIX'));

-- FREMIX = próprio
UPDATE public.maquinas_frota SET condicao = 'PROPRIO' WHERE upper(empresa) = 'FREMIX';

CREATE INDEX IF NOT EXISTS idx_maquinas_frota_condicao ON public.maquinas_frota(condicao);

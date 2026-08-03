-- Persist local/endereço escolhido no cabeçalho do RDO
-- Evita que relatórios usem todos os endereços da OGS quando existe múltipla localização.

ALTER TABLE public.rdo_diarios
ADD COLUMN IF NOT EXISTS local text;

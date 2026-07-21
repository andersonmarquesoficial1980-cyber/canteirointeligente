-- Corrige erro de schema no RDO Técnico: faltavam colunas usadas no payload
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS egl_ton numeric,
  ADD COLUMN IF NOT EXISTS rachao_ton numeric;

COMMENT ON COLUMN public.rdo_engenheiro.egl_ton IS 'Quantidade de aplicação de EGL em toneladas';
COMMENT ON COLUMN public.rdo_engenheiro.rachao_ton IS 'Quantidade de aplicação de Rachão em toneladas';

-- Add new quantitative fields for additional CAUQ service types in Engineering RDO
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS bgtc_m3 numeric,
  ADD COLUMN IF NOT EXISTS macadame_m3 numeric,
  ADD COLUMN IF NOT EXISTS cauq_rima_ton numeric,
  ADD COLUMN IF NOT EXISTS bm25_ton numeric;

COMMENT ON COLUMN public.rdo_engenheiro.bgtc_m3 IS 'Produção de aplicação de BGTC em m3';
COMMENT ON COLUMN public.rdo_engenheiro.macadame_m3 IS 'Produção de aplicação de macadame em m3';
COMMENT ON COLUMN public.rdo_engenheiro.cauq_rima_ton IS 'Produção de aplicação de CAUQ-RIMA em toneladas';
COMMENT ON COLUMN public.rdo_engenheiro.bm25_ton IS 'Produção de aplicação de BN25 em toneladas';
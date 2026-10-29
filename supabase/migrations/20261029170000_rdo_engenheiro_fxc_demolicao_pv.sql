-- RDO Técnico: novos quantitativos de produção (aditivo, não destrutivo).
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS fx_c_ton numeric,
  ADD COLUMN IF NOT EXISTS demolicao_m numeric,
  ADD COLUMN IF NOT EXISTS nivelamento_pv_un numeric;

COMMENT ON COLUMN public.rdo_engenheiro.fx_c_ton IS 'Aplicação de FX C em toneladas';
COMMENT ON COLUMN public.rdo_engenheiro.demolicao_m IS 'Demolição em metros';
COMMENT ON COLUMN public.rdo_engenheiro.nivelamento_pv_un IS 'Nivelamento de PV em unidades';

-- Novo tipo de serviço (mesmo vínculo dos demais serviços de pavimentação), sem duplicar.
INSERT INTO public.tipos_servico (nome, vinculo_rdo, vinculos, company_id)
SELECT 'NIVELAMENTO DE PV', 'CAUQ', ARRAY['CAUQ','PAVIMENTACAO'], 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE NOT EXISTS (SELECT 1 FROM public.tipos_servico WHERE nome = 'NIVELAMENTO DE PV');

-- Corrige nome do tipo de serviço CAUQ no RDO de Pavimentação
-- de "APLICAÇÃO DE CAUQ-RIMA" para "APLICAÇÃO DE CAUQ-HIMA"

UPDATE public.tipos_servico
SET nome = 'APLICAÇÃO DE CAUQ-HIMA'
WHERE nome = 'APLICAÇÃO DE CAUQ-RIMA'
  AND vinculo_rdo = 'CAUQ';

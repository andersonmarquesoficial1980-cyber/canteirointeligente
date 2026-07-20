-- Adiciona observações gerais ao cabeçalho do RDO
ALTER TABLE public.rdo_diarios
ADD COLUMN IF NOT EXISTS observacoes_gerais text;
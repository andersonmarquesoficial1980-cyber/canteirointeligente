-- Adiciona vínculo explícito do engenheiro responsável para validação de RDO
ALTER TABLE public.rdo_diarios
ADD COLUMN IF NOT EXISTS engenheiro_responsavel text;
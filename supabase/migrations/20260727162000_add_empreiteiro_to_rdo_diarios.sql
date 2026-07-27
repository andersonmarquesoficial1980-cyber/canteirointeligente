-- Adiciona empreiteiro no cabeçalho do RDO para Infraestrutura
ALTER TABLE public.rdo_diarios
ADD COLUMN IF NOT EXISTS empreiteiro text;
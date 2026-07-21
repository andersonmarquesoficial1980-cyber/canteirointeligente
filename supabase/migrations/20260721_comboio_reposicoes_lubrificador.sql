-- Adiciona identificação do lubrificador no controle de carga do reservatório
ALTER TABLE public.comboio_reposicoes
ADD COLUMN IF NOT EXISTS lubrificador text;

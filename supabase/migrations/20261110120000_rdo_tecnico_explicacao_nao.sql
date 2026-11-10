-- RDO Técnico: explicação rápida quando sinalização / controle tecnológico NÃO estiveram presentes.
-- Aditivo, sem alterar dados existentes.
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS sinalizacao_ausente_motivo text,
  ADD COLUMN IF NOT EXISTS controle_tecnologico_ausente_motivo text;

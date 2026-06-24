-- Adiciona coluna local_ogs na tabela manutencao_os
-- Substitui os campos origem/solicitante_nome por referência à OGS (local da obra/pátio)

ALTER TABLE manutencao_os
  ADD COLUMN IF NOT EXISTS local_ogs text;

COMMENT ON COLUMN manutencao_os.local_ogs IS 'Número OGS da obra/pátio onde o equipamento está sendo mantido (referência à tabela ogs_reference)';

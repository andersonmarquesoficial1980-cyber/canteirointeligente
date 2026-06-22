-- Adiciona coluna de motivo de cancelamento no diário de equipamento
ALTER TABLE equipment_diaries
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

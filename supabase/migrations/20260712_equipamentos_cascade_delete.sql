-- Adiciona ON DELETE CASCADE nas FKs que referenciam equipamentos
-- Permite deletar equipamentos mesmo com registros vinculados

-- equipment_diaries
ALTER TABLE equipment_diaries
  DROP CONSTRAINT equipment_diaries_equipamento_id_fkey,
  ADD CONSTRAINT equipment_diaries_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

-- equipamentos_documentos
ALTER TABLE equipamentos_documentos
  DROP CONSTRAINT equipamentos_documentos_equipamento_id_fkey,
  ADD CONSTRAINT equipamentos_documentos_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

-- equipamentos_manutencoes
ALTER TABLE equipamentos_manutencoes
  DROP CONSTRAINT equipamentos_manutencoes_equipamento_id_fkey,
  ADD CONSTRAINT equipamentos_manutencoes_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

-- equipamentos_medicoes
ALTER TABLE equipamentos_medicoes
  DROP CONSTRAINT equipamentos_medicoes_equipamento_id_fkey,
  ADD CONSTRAINT equipamentos_medicoes_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

-- equipamentos_ocorrencias
ALTER TABLE equipamentos_ocorrencias
  DROP CONSTRAINT equipamentos_ocorrencias_equipamento_id_fkey,
  ADD CONSTRAINT equipamentos_ocorrencias_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

-- manutencao_os
ALTER TABLE manutencao_os
  DROP CONSTRAINT manutencao_os_equipamento_id_fkey,
  ADD CONSTRAINT manutencao_os_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE CASCADE;

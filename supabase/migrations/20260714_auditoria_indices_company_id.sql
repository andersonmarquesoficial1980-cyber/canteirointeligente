-- =============================================================
-- MIGRAÇÃO: Índices company_id — Bloco 3
-- Data: 2026-07-14
-- Estratégia: CREATE INDEX CONCURRENTLY
--   → não trava nenhuma tabela durante a criação
--   → usuários continuam lançando normalmente
--   → se o índice já existir, IF NOT EXISTS evita erro
-- 58 tabelas sem índice em company_id
-- =============================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_abastecimento_config_company_id         ON abastecimento_config         (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_log_company_id              ON admin_audit_log              (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_permissions_company_id            ON admin_permissions            (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bit_entries_company_id                  ON bit_entries                  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_entries_company_id            ON checklist_entries            (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_integracoes_company_id               ON ci_integracoes               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comboio_reposicoes_company_id           ON comboio_reposicoes           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_demandas_company_id                     ON demandas                     (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diary_unlock_requests_company_id        ON diary_unlock_requests        (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_documentos_company_id          ON employee_documentos          (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_historico_company_id           ON employee_historico           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_empresas_parceiras_company_id           ON empresas_parceiras           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engenheiro_ogs_company_id               ON engenheiro_ogs               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipamento_tipos_company_id            ON equipamento_tipos            (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipamento_transportes_company_id      ON equipamento_transportes      (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipamentos_documentos_company_id      ON equipamentos_documentos      (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipamentos_manutencoes_company_id     ON equipamentos_manutencoes     (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipamentos_medicoes_company_id        ON equipamentos_medicoes        (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_bits_company_id               ON equipment_bits               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_checklist_results_company_id  ON equipment_checklist_results  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_production_areas_company_id   ON equipment_production_areas   (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_time_entries_company_id       ON equipment_time_entries       (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equipment_visual_inspection_company_id  ON equipment_visual_inspection  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fornecedores_company_id                 ON fornecedores                 (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_horimetro_audit_company_id              ON horimetro_audit              (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kma_calibration_entries_company_id      ON kma_calibration_entries      (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kma_operations_company_id               ON kma_operations               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manutencao_consumo_company_id           ON manutencao_consumo           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manutencao_documentos_company_id        ON manutencao_documentos        (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manutencao_os_company_id                ON manutencao_os                (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manutencao_pecas_company_id             ON manutencao_pecas             (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materiais_company_id                    ON materiais                    (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_prefs_company_id           ON notification_prefs           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_targets_company_id         ON notification_targets         (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ogs_reference_company_id                ON ogs_reference                (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patio_auto_config_company_id            ON patio_auto_config            (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ponto_solicitacoes_company_id           ON ponto_solicitacoes           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_production_entries_company_id           ON production_entries           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_company_id                     ON profiles                     (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subscriptions_company_id           ON push_subscriptions           (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_diarios_company_id                  ON rdo_diarios                  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_efetivo_company_id                  ON rdo_efetivo                  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_engenheiro_company_id               ON rdo_engenheiro               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_equipamentos_company_id             ON rdo_equipamentos             (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_nf_massa_company_id                 ON rdo_nf_massa                 (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdo_producao_company_id                 ON rdo_producao                 (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sst_funcionarios_integracao_company_id  ON sst_funcionarios_integracao  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_company_id                ON subscriptions                (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suprimentos_frete_historico_company_id  ON suprimentos_frete_historico  (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_company_id                 ON time_entries                 (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tipos_servico_company_id                ON tipos_servico                (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_truck_registry_company_id               ON truck_registry               (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_truck_tank_supplies_company_id          ON truck_tank_supplies          (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trucker_trips_company_id                ON trucker_trips                (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_admin_roles_company_id             ON user_admin_roles             (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_company_id             ON user_permissions             (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vacation_records_company_id             ON vacation_records             (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wha_messages_company_id                 ON wha_messages                 (company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contatos_company_id            ON whatsapp_contatos            (company_id);

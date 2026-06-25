-- =====================================================
-- SST INTEGRAÇÃO — 3 novas tabelas
-- Projeto: Workflux / canteirointeligente
-- Supabase: ucgcqexunnsrffzrfhqu
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. PASTA GLOBAL DE DOCUMENTOS POR FUNCIONÁRIO
CREATE TABLE IF NOT EXISTS sst_funcionario_documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  arquivo_url    text,
  arquivo_nome   text,
  validade       date,
  observacao     text,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 2. OBRAS QUE EXIGEM INTEGRAÇÃO
CREATE TABLE IF NOT EXISTS sst_obras_integracao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid,
  nome_obra       text NOT NULL,
  concessionaria  text,
  local           text,
  data_inicio     date,
  data_fim        date,
  status          text DEFAULT 'ativa',
  documentos_exigidos  text[] DEFAULT '{}',
  validade_meses  integer DEFAULT 12,
  tem_credenciamento   boolean DEFAULT false,
  observacoes     text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. FUNCIONÁRIOS × OBRAS
CREATE TABLE IF NOT EXISTS sst_funcionarios_integracao (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid,
  obra_id              uuid NOT NULL REFERENCES sst_obras_integracao(id) ON DELETE CASCADE,
  funcionario_id       uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  status_integracao    text DEFAULT 'pendente',
  data_integracao      date,
  data_vencimento      date,
  status_credenciamento  text,
  data_credenciamento    date,
  vencimento_credenciamento date,
  documentos_pendentes   text[] DEFAULT '{}',
  documentos_extras      text[] DEFAULT '{}',
  observacoes            text,
  created_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE(obra_id, funcionario_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sst_func_docs_funcionario ON sst_funcionario_documentos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_sst_func_docs_company ON sst_funcionario_documentos(company_id);
CREATE INDEX IF NOT EXISTS idx_sst_obras_company ON sst_obras_integracao(company_id);
CREATE INDEX IF NOT EXISTS idx_sst_func_integ_obra ON sst_funcionarios_integracao(obra_id);
CREATE INDEX IF NOT EXISTS idx_sst_func_integ_func ON sst_funcionarios_integracao(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_sst_func_integ_status ON sst_funcionarios_integracao(status_integracao);

-- RLS
ALTER TABLE sst_funcionario_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_obras_integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_funcionarios_integracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select sst_func_docs" ON sst_funcionario_documentos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert sst_func_docs" ON sst_funcionario_documentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "update sst_func_docs" ON sst_funcionario_documentos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete sst_func_docs" ON sst_funcionario_documentos FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "select sst_obras" ON sst_obras_integracao FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert sst_obras" ON sst_obras_integracao FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "update sst_obras" ON sst_obras_integracao FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete sst_obras" ON sst_obras_integracao FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "select sst_func_integ" ON sst_funcionarios_integracao FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert sst_func_integ" ON sst_funcionarios_integracao FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "update sst_func_integ" ON sst_funcionarios_integracao FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete sst_func_integ" ON sst_funcionarios_integracao FOR DELETE USING (auth.role() = 'authenticated');

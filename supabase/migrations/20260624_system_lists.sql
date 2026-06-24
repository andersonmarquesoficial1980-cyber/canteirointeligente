-- Tabela genérica para listas configuráveis do sistema
-- Usada para mecânicos, encarregados, e outros campos de seleção de nomes no Workflux

CREATE TABLE IF NOT EXISTS system_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  categoria text NOT NULL,  -- ex: 'mecanico', 'encarregado', etc.
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_lists_company_categoria ON system_lists(company_id, categoria);

-- RLS
ALTER TABLE system_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_can_read_system_lists"
  ON system_lists FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_can_manage_system_lists"
  ON system_lists FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

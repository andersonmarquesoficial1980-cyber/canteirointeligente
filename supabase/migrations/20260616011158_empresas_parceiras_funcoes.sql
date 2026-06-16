-- ============================================================
-- Migration: Empresas Parceiras + Funções
-- ============================================================

-- 1. Tabela funcoes
CREATE TABLE IF NOT EXISTS funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, nome)
);
ALTER TABLE funcoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funcoes_select" ON funcoes;
DROP POLICY IF EXISTS "funcoes_insert" ON funcoes;
DROP POLICY IF EXISTS "funcoes_update" ON funcoes;
DROP POLICY IF EXISTS "funcoes_delete" ON funcoes;
CREATE POLICY "funcoes_select" ON funcoes FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "funcoes_insert" ON funcoes FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "funcoes_update" ON funcoes FOR UPDATE USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "funcoes_delete" ON funcoes FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- 2. Tabela empresas_parceiras
CREATE TABLE IF NOT EXISTS empresas_parceiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  nome text NOT NULL,
  cnpj text,
  contato text,
  tipo text NOT NULL DEFAULT 'AMBAS', -- 'EMPREITEIRA' | 'MAO_DE_OBRA' | 'AMBAS'
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE empresas_parceiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parceiras_select" ON empresas_parceiras;
DROP POLICY IF EXISTS "parceiras_insert" ON empresas_parceiras;
DROP POLICY IF EXISTS "parceiras_update" ON empresas_parceiras;
DROP POLICY IF EXISTS "parceiras_delete" ON empresas_parceiras;
CREATE POLICY "parceiras_select" ON empresas_parceiras FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "parceiras_insert" ON empresas_parceiras FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "parceiras_update" ON empresas_parceiras FOR UPDATE USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "parceiras_delete" ON empresas_parceiras FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- 3. Migrar empresas_terceiras → empresas_parceiras
INSERT INTO empresas_parceiras (id, company_id, nome, ativo, created_at, tipo)
SELECT id, company_id, nome, ativo, created_at, 'MAO_DE_OBRA'
FROM empresas_terceiras
ON CONFLICT DO NOTHING;

-- 4. Migrar empreiteiros → empresas_parceiras (sem duplicar por nome)
INSERT INTO empresas_parceiras (company_id, nome, tipo, ativo, created_at)
SELECT e.company_id, e.nome, 'EMPREITEIRA', true, e.created_at
FROM empreiteiros e
WHERE NOT EXISTS (
  SELECT 1 FROM empresas_parceiras ep
  WHERE ep.company_id = e.company_id AND ep.nome = e.nome
)
ON CONFLICT DO NOTHING;

-- 5. Novas colunas em employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS funcao_id uuid REFERENCES funcoes(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS empresa_parceira_id uuid REFERENCES empresas_parceiras(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS empresa_nome text;

-- Migrar empresa_id → empresa_parceira_id (já migrou dados na step 3)
UPDATE employees SET empresa_parceira_id = empresa_id WHERE empresa_id IS NOT NULL AND empresa_parceira_id IS NULL;

-- 6. Nova coluna em rdo_efetivo_terceiros
ALTER TABLE rdo_efetivo_terceiros ADD COLUMN IF NOT EXISTS empresa_parceira_id uuid REFERENCES empresas_parceiras(id);
UPDATE rdo_efetivo_terceiros SET empresa_parceira_id = empresa_id WHERE empresa_id IS NOT NULL AND empresa_parceira_id IS NULL;

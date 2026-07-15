-- =============================================================
-- MIGRAÇÃO: Auditoria de Segurança - Bloco 1
-- Data: 2026-07-14
-- Descrição: Correção de 5 vulnerabilidades críticas/altas
--   C1: comboio_reposicoes e comboio_saldo expostos sem autenticação
--   C3: rdo_equipamentos INSERT sem verificação de empresa
--   A1: suprimentos_frete_config bug profiles.id vs profiles.user_id
--   A3: user_admin_roles totalmente aberto
--   + Trigger para auto-preencher company_id em rdo_equipamentos
-- =============================================================

-- -------------------------------------------------------
-- CORREÇÃO C1: comboio_reposicoes
-- Antes: qual = true (qualquer um, sem login)
-- Depois: isolado por company_id do usuário logado
-- -------------------------------------------------------
DROP POLICY IF EXISTS "allow_all_comboio_reposicoes" ON comboio_reposicoes;

CREATE POLICY "comboio_reposicoes_company_isolation"
ON comboio_reposicoes
FOR ALL
TO authenticated
USING (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
);

-- -------------------------------------------------------
-- CORREÇÃO C1: comboio_saldo
-- Antes: qual = true (qualquer um, sem login)
-- Depois: isolado por company_id do usuário logado
-- -------------------------------------------------------
DROP POLICY IF EXISTS "allow_all_comboio_saldo" ON comboio_saldo;

CREATE POLICY "comboio_saldo_company_isolation"
ON comboio_saldo
FOR ALL
TO authenticated
USING (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
);

-- -------------------------------------------------------
-- CORREÇÃO C3: rdo_equipamentos INSERT sem company_id
-- Estratégia SEGURA: trigger que auto-preenche company_id
-- via rdo_diarios (sem precisar mudar o código frontend)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_rdo_equipamentos_company_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se company_id não foi passado, busca do rdo_diarios pai
  IF NEW.company_id IS NULL AND NEW.rdo_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM rdo_diarios
    WHERE id = NEW.rdo_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rdo_equipamentos_company_id ON rdo_equipamentos;

CREATE TRIGGER trg_rdo_equipamentos_company_id
BEFORE INSERT ON rdo_equipamentos
FOR EACH ROW
EXECUTE FUNCTION fn_set_rdo_equipamentos_company_id();

-- Backfill: preencher company_id dos 394 registros existentes sem company_id
UPDATE rdo_equipamentos re
SET company_id = rd.company_id
FROM rdo_diarios rd
WHERE re.rdo_id = rd.id
  AND re.company_id IS NULL
  AND rd.company_id IS NOT NULL;

-- Corrigir policy de INSERT do rdo_equipamentos:
-- com_check passa a exigir que company_id pertença à empresa do usuário
DROP POLICY IF EXISTS "insert_rdo_equipamentos" ON rdo_equipamentos;

CREATE POLICY "insert_rdo_equipamentos"
ON rdo_equipamentos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rdo_diarios rd
    JOIN profiles p ON p.company_id = rd.company_id
    WHERE rd.id = rdo_equipamentos.rdo_id
      AND p.user_id = auth.uid()
  )
);

-- -------------------------------------------------------
-- CORREÇÃO A1: suprimentos_frete_config
-- Bug: profiles.id = auth.uid() → CORRETO: profiles.user_id = auth.uid()
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Enable update for company admins" ON suprimentos_frete_config;
DROP POLICY IF EXISTS "Enable insert for company admins" ON suprimentos_frete_config;

CREATE POLICY "frete_config_update_admins"
ON suprimentos_frete_config
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'gerente')
  )
)
WITH CHECK (
  company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'gerente')
  )
);

CREATE POLICY "frete_config_insert_admins"
ON suprimentos_frete_config
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'gerente')
  )
);

-- -------------------------------------------------------
-- CORREÇÃO A3: user_admin_roles
-- Antes: qual = true (qualquer autenticado vê tudo)
-- Depois: isolado por company_id
-- -------------------------------------------------------
DROP POLICY IF EXISTS "user_admin_roles_permissive" ON user_admin_roles;

CREATE POLICY "user_admin_roles_company_isolation"
ON user_admin_roles
FOR ALL
TO authenticated
USING (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'superadmin'
  )
)
WITH CHECK (
  company_id = (
    SELECT profiles.company_id FROM profiles
    WHERE profiles.user_id = auth.uid()
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'superadmin'
  )
);

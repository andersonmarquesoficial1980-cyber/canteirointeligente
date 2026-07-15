-- =============================================================
-- MIGRAÇÃO: Auditoria de Segurança - Bloco 2
-- Data: 2026-07-14
-- Descrição: Isolamento por empresa em tabelas administrativas
--   C2: wha_conversations e wha_messages — isolados por company_id
--   A2: admin_audit_log, admin_permissions, admin_roles — isolados
--   Obs: admin_roles/permissions com company_id NULL são globais
--        de sistema — mantidos visíveis para todos (só leitura)
-- =============================================================

-- -------------------------------------------------------
-- CORREÇÃO C2: wha_conversations
-- Antes: qual = true (qualquer autenticado vê conversas de todas as empresas)
-- Depois: isolado por company_id
-- -------------------------------------------------------
DROP POLICY IF EXISTS "wha_conv_all" ON wha_conversations;

CREATE POLICY "wha_conversations_company_isolation"
ON wha_conversations
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
);

-- -------------------------------------------------------
-- CORREÇÃO C2: wha_messages
-- Antes: qual = true
-- Depois: isolado por company_id
-- -------------------------------------------------------
DROP POLICY IF EXISTS "wha_msg_all" ON wha_messages;

CREATE POLICY "wha_messages_company_isolation"
ON wha_messages
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
);

-- -------------------------------------------------------
-- CORREÇÃO A2: admin_audit_log
-- Antes: qual = true (qualquer autenticado vê logs de todas as empresas)
-- Depois: isolado por company_id + superadmin vê tudo
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin_audit_log_all" ON admin_audit_log;

CREATE POLICY "admin_audit_log_company_isolation"
ON admin_audit_log
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
);

-- -------------------------------------------------------
-- CORREÇÃO A2: admin_roles
-- Regra especial: roles com company_id NULL são globais de sistema
-- → qualquer autenticado pode VER (SELECT) os globais
-- → só pode modificar/criar roles da própria empresa
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin_roles_all" ON admin_roles;

-- SELECT: própria empresa + globais de sistema (company_id NULL)
CREATE POLICY "admin_roles_select"
ON admin_roles
FOR SELECT
TO authenticated
USING (
  company_id IS NULL  -- roles globais de sistema: visíveis para todos
  OR company_id = (
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

-- INSERT/UPDATE/DELETE: apenas empresa própria ou superadmin
CREATE POLICY "admin_roles_write"
ON admin_roles
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

-- -------------------------------------------------------
-- CORREÇÃO A2: admin_permissions
-- Mesma regra: permissões de sistema (company_id NULL) visíveis
-- para todos lerem, mas não podem ser alteradas por empresa comum
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin_permissions_all" ON admin_permissions;

-- SELECT: própria empresa + globais de sistema
CREATE POLICY "admin_permissions_select"
ON admin_permissions
FOR SELECT
TO authenticated
USING (
  company_id IS NULL  -- permissões globais de sistema
  OR company_id = (
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

-- INSERT/UPDATE/DELETE: apenas empresa própria ou superadmin
CREATE POLICY "admin_permissions_write"
ON admin_permissions
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

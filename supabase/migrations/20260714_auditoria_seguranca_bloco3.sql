-- =============================================================
-- MIGRAÇÃO: Auditoria de Segurança — Bloco 3 (final)
-- Data: 2026-07-14
-- Itens:
--   1. manutencao_os: backfill company_id NULL + remover policy auth_all
--   2. sst_inspections: isolar por company_id
--   3. sst_responsaveis: isolar por company_id
-- ZERO risco: backfill antes de qualquer mudança de policy
-- =============================================================

-- -------------------------------------------------------
-- 1A. BACKFILL: manutencao_os com company_id NULL
-- Só 1 empresa no banco (Fremix) — backfill direto
-- -------------------------------------------------------
UPDATE manutencao_os
SET company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE company_id IS NULL;

-- -------------------------------------------------------
-- 1B. manutencao_os: remover policy permissiva duplicada
-- A policy 'manutencao_os_company' já está correta.
-- A 'auth_all' com qual=true anulava o isolamento.
-- Solução: remover só a ruim, manter a boa.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "auth_all" ON manutencao_os;

-- -------------------------------------------------------
-- 2. sst_inspections
-- Antes: qual = true (qualquer autenticado vê tudo)
-- Depois: isolado por company_id + superadmin vê tudo
-- -------------------------------------------------------
DROP POLICY IF EXISTS "sst_all" ON sst_inspections;

CREATE POLICY "sst_inspections_company_isolation"
ON sst_inspections
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
-- 3. sst_responsaveis
-- Antes: qual = true
-- Depois: isolado por company_id
-- -------------------------------------------------------
DROP POLICY IF EXISTS "sst_resp_all" ON sst_responsaveis;

CREATE POLICY "sst_responsaveis_company_isolation"
ON sst_responsaveis
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

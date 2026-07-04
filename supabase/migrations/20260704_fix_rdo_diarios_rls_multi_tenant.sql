-- =====================================================
-- MIGRATION: FIX RLS Policy para rdo_diarios
-- DATA: 2026-07-04
-- OBJETIVO: Permitir RDO_Admin ver TODOS os RDOs da empresa
-- =====================================================
-- PROBLEMA ATUAL:
-- - RDO_Admin não consegue ver nenhum RDO
-- - A policy antiga usa has_role(auth.uid(), 'admin') que não funciona
-- - Falta suporte a multi-tenant via company_id do user
-- =====================================================

-- Step 1: DROP todas as policies antigas em rdo_diarios
DROP POLICY IF EXISTS "select_own_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "select_all_rdo_diarios_admin" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Auth select rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Auth insert rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "select_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "insert_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "update_own_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Users can update own rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "insert_rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Authenticated users can select rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Authenticated users can insert rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Authenticated users can update rdo_diarios" ON public.rdo_diarios;

-- =====================================================
-- NEW RLS POLICIES: Multi-tenant aware + Role-based
-- =====================================================

-- POLICY 1: Super_Admin vê TUDO (all companies)
CREATE POLICY "rdo_diarios_select_super_admin" ON public.rdo_diarios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
    )
  );

-- POLICY 2: RDO_Admin vê TODOS os RDOs da SUA empresa
CREATE POLICY "rdo_diarios_select_rdo_admin" ON public.rdo_diarios
  FOR SELECT TO authenticated
  USING (
    -- User is RDO_Admin for this company
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'RDO_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
        AND uar.company_id = rdo_diarios.company_id
    )
  );

-- POLICY 3: Usuário comum vê apenas seus próprios RDOs
CREATE POLICY "rdo_diarios_select_own" ON public.rdo_diarios
  FOR SELECT TO authenticated
  USING (
    -- Own RDO (user_id matches)
    auth.uid() = user_id
  );

-- =====================================================
-- INSERT POLICIES
-- =====================================================

-- POLICY 4: Super_Admin pode inserir RDOs em qualquer empresa
CREATE POLICY "rdo_diarios_insert_super_admin" ON public.rdo_diarios
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
    )
  );

-- POLICY 5: RDO_Admin pode inserir RDOs para sua empresa
CREATE POLICY "rdo_diarios_insert_rdo_admin" ON public.rdo_diarios
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Is RDO_Admin for the company
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'RDO_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
        AND uar.company_id = rdo_diarios.company_id
    )
    -- AND user_id is set to current user
    AND user_id = auth.uid()
  );

-- POLICY 6: Usuário comum pode inserir apenas seus próprios RDOs
CREATE POLICY "rdo_diarios_insert_own" ON public.rdo_diarios
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- =====================================================
-- UPDATE POLICIES
-- =====================================================

-- POLICY 7: Super_Admin pode atualizar qualquer RDO
CREATE POLICY "rdo_diarios_update_super_admin" ON public.rdo_diarios
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
    )
  )
  WITH CHECK (true);

-- POLICY 8: RDO_Admin pode atualizar RDOs de sua empresa
CREATE POLICY "rdo_diarios_update_rdo_admin" ON public.rdo_diarios
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'RDO_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
        AND uar.company_id = rdo_diarios.company_id
    )
  )
  WITH CHECK (true);

-- POLICY 9: Usuário comum pode atualizar apenas seus próprios RDOs
CREATE POLICY "rdo_diarios_update_own" ON public.rdo_diarios
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- DELETE POLICIES
-- =====================================================

-- POLICY 10: Super_Admin pode deletar qualquer RDO
CREATE POLICY "rdo_diarios_delete_super_admin" ON public.rdo_diarios
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
    )
  );

-- POLICY 11: RDO_Admin pode deletar RDOs de sua empresa
CREATE POLICY "rdo_diarios_delete_rdo_admin" ON public.rdo_diarios
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'RDO_Admin'
        AND uar.is_active = TRUE
        AND ar.active = TRUE
        AND uar.company_id = rdo_diarios.company_id
    )
  );

-- POLICY 12: Usuário comum pode deletar apenas seus próprios RDOs
CREATE POLICY "rdo_diarios_delete_own" ON public.rdo_diarios
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- TAMBÉM ATUALIZAR AS SUB-TABLES (que referenciam rdo_diarios)
-- Exemplo: rdo_producao, rdo_efetivo, etc
-- =====================================================

-- DROP OLD POLICIES from rdo_producao
DROP POLICY IF EXISTS "select_rdo_producao" ON public.rdo_producao;
DROP POLICY IF EXISTS "insert_rdo_producao" ON public.rdo_producao;

-- NEW POLICIES for rdo_producao (inherit from parent rdo_diarios)
CREATE POLICY "rdo_producao_select" ON public.rdo_producao
  FOR SELECT TO authenticated
  USING (
    -- Access depends on rdo_diarios permissions
    EXISTS (
      SELECT 1 
      FROM public.rdo_diarios rd
      WHERE rd.id = rdo_producao.rdo_id
      AND (
        -- Super_Admin sees all
        EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'Super_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
        )
        -- RDO_Admin for this company
        OR EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'RDO_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
            AND uar.company_id = rd.company_id
        )
        -- Own RDO
        OR rd.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "rdo_producao_insert" ON public.rdo_producao
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.rdo_diarios rd
      WHERE rd.id = rdo_producao.rdo_id
      AND (
        -- Super_Admin can insert
        EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'Super_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
        )
        -- RDO_Admin for this company
        OR EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'RDO_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
            AND uar.company_id = rd.company_id
        )
        -- Owner can insert
        OR rd.user_id = auth.uid()
      )
    )
  );

-- Similar updates for other tables...
-- DROP OLD POLICIES from rdo_efetivo
DROP POLICY IF EXISTS "select_rdo_efetivo" ON public.rdo_efetivo;
DROP POLICY IF EXISTS "insert_rdo_efetivo" ON public.rdo_efetivo;

CREATE POLICY "rdo_efetivo_select" ON public.rdo_efetivo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.rdo_diarios rd
      WHERE rd.id = rdo_efetivo.rdo_id
      AND (
        EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'Super_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
        )
        OR EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'RDO_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
            AND uar.company_id = rd.company_id
        )
        OR rd.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "rdo_efetivo_insert" ON public.rdo_efetivo
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.rdo_diarios rd
      WHERE rd.id = rdo_efetivo.rdo_id
      AND (
        EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'Super_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
        )
        OR EXISTS (
          SELECT 1 
          FROM public.user_admin_roles uar
          INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
          WHERE uar.user_id = auth.uid()
            AND ar.name = 'RDO_Admin'
            AND uar.is_active = TRUE
            AND ar.active = TRUE
            AND uar.company_id = rd.company_id
        )
        OR rd.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- VERIFICATION QUERIES (test after migration)
-- =====================================================

-- After running this migration, test with:
-- 1. SELECT COUNT(*) FROM public.rdo_diarios; -- Should return data if authenticated
-- 2. Check that pg_policies shows 12 new policies for rdo_diarios
-- SELECT policyname FROM pg_policies WHERE tablename = 'rdo_diarios' ORDER BY policyname;

-- =====================================================
-- END MIGRATION
-- =====================================================

-- =====================================================
-- ADMIN ROLES SYSTEM — Granular Permissions for Workflux
-- FIXED VERSION: Corrects UUID/TEXT type casting issues
-- Projeto: Workflux / canteirointeligente
-- Supabase: ucgcqexunnsrffzrfhqu
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================
-- CHANGE LOG:
-- - FIXED: Text = UUID comparisons (must cast UUID::TEXT or TEXT::UUID consistently)
-- - FIXED: WHERE id::text = auth.uid() → WHERE id = auth.uid()::uuid (since id is UUID, not TEXT)
-- - FIXED: employee_id::text = auth.uid() → employee_id = auth.uid()::uuid
-- - FIXED: Idempotent migrations with IF EXISTS checks
-- - FIXED: ON CONFLICT clauses for INSERT operations
-- =====================================================

-- 1. ADMIN_ROLES table: Define role types
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 2. ADMIN_PERMISSIONS table: Define what each role can do
-- Format: role → resource → action (view/create/edit/delete)
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  is_sector_scoped BOOLEAN DEFAULT FALSE,
  sector_filter TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, resource, action)
);

-- 3. USER_ADMIN_ROLES table: Assign users to admin roles
CREATE TABLE IF NOT EXISTS public.user_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  scope_sector TEXT,
  scope_obra TEXT,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(employee_id, role_id)
);

-- 4. ADMIN_AUDIT_LOG table: Track all admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  admin_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  changes_before JSONB,
  changes_after JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_roles_company ON public.admin_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_active ON public.admin_roles(active);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_role ON public.admin_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_resource ON public.admin_permissions(resource);
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_employee ON public.user_admin_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_role ON public.user_admin_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_company ON public.user_admin_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_active ON public.user_admin_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_company ON public.admin_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at);

-- Insert default system roles (idempotent)
INSERT INTO public.admin_roles (name, description, is_system_role, active, company_id)
VALUES 
  ('Super_Admin', 'Full access to all resources and admin functions', TRUE, TRUE, NULL),
  ('RDO_Admin', 'Can manage RDO (Diários de Obra) sector only', TRUE, TRUE, NULL),
  ('Equipment_Admin', 'Can manage Equipment sector only', TRUE, TRUE, NULL),
  ('Fuel_Admin', 'Can manage Abastecimento (Fuel) sector only', TRUE, TRUE, NULL),
  ('Maintenance_Admin', 'Can manage Maintenance sector only', TRUE, TRUE, NULL),
  ('HR_Admin', 'Can manage HR sector only', TRUE, TRUE, NULL)
ON CONFLICT (company_id, name) DO NOTHING;

-- Insert permissions for Super_Admin (full access)
-- Note: This is a simplified set; expand as needed per resource
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, company_id)
SELECT 
  r.id,
  resource,
  action,
  FALSE,
  NULL
FROM public.admin_roles r,
(
  SELECT 'rdo_diarios' AS resource, 'view' AS action
  UNION ALL SELECT 'rdo_diarios', 'create'
  UNION ALL SELECT 'rdo_diarios', 'edit'
  UNION ALL SELECT 'rdo_diarios', 'delete'
  UNION ALL SELECT 'abastecimentos', 'view'
  UNION ALL SELECT 'abastecimentos', 'create'
  UNION ALL SELECT 'abastecimentos', 'edit'
  UNION ALL SELECT 'abastecimentos', 'delete'
  UNION ALL SELECT 'equipamentos', 'view'
  UNION ALL SELECT 'equipamentos', 'create'
  UNION ALL SELECT 'equipamentos', 'edit'
  UNION ALL SELECT 'equipamentos', 'delete'
  UNION ALL SELECT 'manutencao_os', 'view'
  UNION ALL SELECT 'manutencao_os', 'create'
  UNION ALL SELECT 'manutencao_os', 'edit'
  UNION ALL SELECT 'manutencao_os', 'delete'
  UNION ALL SELECT 'funcionarios', 'view'
  UNION ALL SELECT 'funcionarios', 'create'
  UNION ALL SELECT 'funcionarios', 'edit'
  UNION ALL SELECT 'funcionarios', 'delete'
  UNION ALL SELECT 'admin_roles', 'view'
  UNION ALL SELECT 'admin_roles', 'create'
  UNION ALL SELECT 'admin_roles', 'edit'
  UNION ALL SELECT 'admin_roles', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Super_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Insert permissions for RDO_Admin (RDO sector only)
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter, company_id)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'rdo',
  NULL
FROM public.admin_roles r,
(
  SELECT 'rdo_diarios' AS resource, 'view' AS action
  UNION ALL SELECT 'rdo_diarios', 'create'
  UNION ALL SELECT 'rdo_diarios', 'edit'
  UNION ALL SELECT 'rdo_diarios', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'RDO_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Insert permissions for Equipment_Admin
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter, company_id)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'equipment',
  NULL
FROM public.admin_roles r,
(
  SELECT 'equipamentos' AS resource, 'view' AS action
  UNION ALL SELECT 'equipamentos', 'create'
  UNION ALL SELECT 'equipamentos', 'edit'
  UNION ALL SELECT 'equipamentos', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Equipment_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Insert permissions for Fuel_Admin
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter, company_id)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'fuel',
  NULL
FROM public.admin_roles r,
(
  SELECT 'abastecimentos' AS resource, 'view' AS action
  UNION ALL SELECT 'abastecimentos', 'create'
  UNION ALL SELECT 'abastecimentos', 'edit'
  UNION ALL SELECT 'abastecimentos', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Fuel_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Insert permissions for Maintenance_Admin
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter, company_id)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'maintenance',
  NULL
FROM public.admin_roles r,
(
  SELECT 'manutencao_os' AS resource, 'view' AS action
  UNION ALL SELECT 'manutencao_os', 'create'
  UNION ALL SELECT 'manutencao_os', 'edit'
  UNION ALL SELECT 'manutencao_os', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Maintenance_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Insert permissions for HR_Admin
INSERT INTO public.admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter, company_id)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'hr',
  NULL
FROM public.admin_roles r,
(
  SELECT 'funcionarios' AS resource, 'view' AS action
  UNION ALL SELECT 'funcionarios', 'create'
  UNION ALL SELECT 'funcionarios', 'edit'
  UNION ALL SELECT 'funcionarios', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'HR_Admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- =====================================================
-- ENABLE RLS (Row-Level Security) on all new tables
-- =====================================================
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts on re-run)
DROP POLICY IF EXISTS "users_view_company_admin_roles" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_manage_roles" ON public.admin_roles;
DROP POLICY IF EXISTS "users_view_permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "view_admin_roles_assignments" ON public.user_admin_roles;
DROP POLICY IF EXISTS "admin_assign_roles" ON public.user_admin_roles;
DROP POLICY IF EXISTS "view_admin_audit_log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "log_admin_actions" ON public.admin_audit_log;

-- =====================================================
-- RLS Policies with FIXED type casting
-- =====================================================

-- RLS Policy: Users can view admin roles in their company
CREATE POLICY "users_view_company_admin_roles" ON public.admin_roles
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM public.employees 
      WHERE id = auth.uid()::uuid
    )
  );

-- RLS Policy: Only Super_Admin or role creators can manage admin roles
-- OR: Users who are company admins (is_admin = true in profiles)
CREATE POLICY "admin_manage_roles" ON public.admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.employee_id = auth.uid()::uuid
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_admin = TRUE
        AND p.company_id = admin_roles.company_id
    )
  );

-- RLS Policy: Users can view permissions for their company's roles
CREATE POLICY "users_view_permissions" ON public.admin_permissions
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM public.employees 
      WHERE id = auth.uid()::uuid
    )
  );

-- RLS Policy: Only Super_Admin can manage permissions
-- OR: Company admins can manage
CREATE POLICY "admin_manage_permissions" ON public.admin_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.employee_id = auth.uid()::uuid
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.admin_roles ar ON ar.company_id = p.company_id
      WHERE p.user_id = auth.uid()
        AND p.is_admin = TRUE
        AND ar.id = admin_permissions.role_id
    )
  );

-- RLS Policy: Users can view their own assignments and their company's assignments
CREATE POLICY "view_admin_roles_assignments" ON public.user_admin_roles
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM public.employees 
      WHERE id = auth.uid()::uuid
    )
    OR employee_id = auth.uid()::uuid
  );

-- RLS Policy: Only Super_Admin can assign/revoke admin roles
-- OR: Company admins with appropriate permissions
CREATE POLICY "admin_assign_roles" ON public.user_admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.employee_id = auth.uid()::uuid
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_admin = TRUE
        AND p.company_id = user_admin_roles.company_id
    )
  );

-- RLS Policy: Users can view audit logs for their company (Super_Admin or company admins)
CREATE POLICY "view_admin_audit_log" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.employee_id = auth.uid()::uuid
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_admin = TRUE
        AND p.company_id = admin_audit_log.company_id
    )
  );

-- RLS Policy: Log admin actions (insert for system)
CREATE POLICY "log_admin_actions" ON public.admin_audit_log
  FOR INSERT WITH CHECK (TRUE);

-- =====================================================
-- Helper Functions with FIXED type safety
-- =====================================================

-- Function to check if user has admin permission
DROP FUNCTION IF EXISTS public.has_admin_permission(TEXT, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.has_admin_permission(
  p_user_id UUID,
  p_resource TEXT,
  p_action TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_admin_roles uar
    INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
    INNER JOIN public.admin_permissions ap ON ap.role_id = ar.id
    WHERE uar.employee_id = p_user_id
      AND ap.resource = p_resource
      AND ap.action = p_action
      AND uar.is_active = TRUE
      AND ar.active = TRUE
      AND (p_company_id IS NULL OR uar.company_id = p_company_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check sector-scoped access
DROP FUNCTION IF EXISTS public.has_sector_access(TEXT, TEXT, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.has_sector_access(
  p_user_id UUID,
  p_resource TEXT,
  p_action TEXT,
  p_sector TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_admin_roles uar
    INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
    INNER JOIN public.admin_permissions ap ON ap.role_id = ar.id
    WHERE uar.employee_id = p_user_id
      AND ap.resource = p_resource
      AND ap.action = p_action
      AND uar.is_active = TRUE
      AND ar.active = TRUE
      AND (p_company_id IS NULL OR uar.company_id = p_company_id)
      AND (
        ap.is_sector_scoped = FALSE
        OR (ap.is_sector_scoped = TRUE AND ap.sector_filter = p_sector)
        OR (ap.is_sector_scoped = TRUE AND uar.scope_sector = p_sector)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to log admin action
DROP FUNCTION IF EXISTS public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB, JSONB);
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_resource TEXT,
  p_resource_id TEXT,
  p_changes_before JSONB DEFAULT NULL,
  p_changes_after JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_log_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM public.employees WHERE id = p_admin_id;
  
  INSERT INTO public.admin_audit_log (
    company_id, admin_id, action, resource, resource_id,
    changes_before, changes_after
  )
  VALUES (v_company_id, p_admin_id, p_action, p_resource, p_resource_id, p_changes_before, p_changes_after)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.has_admin_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sector_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;

-- =====================================================
-- Documentation: Type Safety Rules
-- =====================================================
-- CRITICAL: Type Casting Rules for PostgreSQL
-- 
-- 1. auth.uid() returns: UUID (in newer Supabase versions)
--    Old versions returned TEXT - check your Supabase version
--
-- 2. employees.id is: UUID type
--
-- 3. Correct comparisons:
--    ✅ WHERE id = auth.uid()::uuid  (UUID comparison)
--    ✅ WHERE id::text = auth.uid()::text  (TEXT comparison, if both are cast)
--    ❌ WHERE id::text = auth.uid()  (TEXT = UUID → ERROR)
--    ❌ WHERE id = auth.uid()  (both must match type or explicit casts)
--
-- 4. For COALESCE, CASE WHEN:
--    - Always wrap in COALESCE(..., 'default'::uuid) if comparing UUIDs
--    - NULL checks happen BEFORE type casting
--
-- 5. Idempotency patterns used:
--    - CREATE TABLE IF NOT EXISTS
--    - CREATE INDEX IF NOT EXISTS
--    - INSERT ... ON CONFLICT DO NOTHING
--    - DROP POLICY IF EXISTS (before CREATE)
--    - DROP FUNCTION IF EXISTS (before CREATE)
-- =====================================================

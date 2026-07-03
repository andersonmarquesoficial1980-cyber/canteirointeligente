-- =====================================================
-- ADMIN ROLES SYSTEM — Granular Permissions for Workflux
-- Projeto: Workflux / canteirointeligente
-- Supabase: ucgcqexunnsrffzrfhqu
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================
-- This migration creates a granular admin roles system
-- allowing Anderson to manage role types and permissions,
-- and restrict access per sector (e.g., Leticia → RDO only)

-- 1. ADMIN_ROLES table: Define role types
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 2. ADMIN_PERMISSIONS table: Define what each role can do
-- Format: role → resource → action (view/create/edit/delete)
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  is_sector_scoped BOOLEAN DEFAULT FALSE,
  sector_filter TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, resource, action)
);

-- 3. USER_ADMIN_ROLES table: Assign users to admin roles
CREATE TABLE IF NOT EXISTS user_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  scope_sector TEXT,
  scope_obra TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(employee_id, role_id)
);

-- 4. ADMIN_AUDIT_LOG table: Track all admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  admin_id UUID REFERENCES employees(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  changes_before JSONB,
  changes_after JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_admin_roles_company ON admin_roles(company_id);
CREATE INDEX idx_admin_permissions_role ON admin_permissions(role_id);
CREATE INDEX idx_admin_permissions_resource ON admin_permissions(resource);
CREATE INDEX idx_user_admin_roles_employee ON user_admin_roles(employee_id);
CREATE INDEX idx_user_admin_roles_role ON user_admin_roles(role_id);
CREATE INDEX idx_user_admin_roles_company ON user_admin_roles(company_id);
CREATE INDEX idx_admin_audit_log_company ON admin_audit_log(company_id);
CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at);

-- Insert default system roles
INSERT INTO admin_roles (name, description, is_system_role, active)
VALUES 
  ('Super_Admin', 'Full access to all resources and admin functions', TRUE, TRUE),
  ('RDO_Admin', 'Can manage RDO (Diários de Obra) sector only', TRUE, TRUE),
  ('Equipment_Admin', 'Can manage Equipment sector only', TRUE, TRUE),
  ('Fuel_Admin', 'Can manage Abastecimento (Fuel) sector only', TRUE, TRUE),
  ('Maintenance_Admin', 'Can manage Maintenance sector only', TRUE, TRUE),
  ('HR_Admin', 'Can manage HR sector only', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Insert permissions for Super_Admin (full access)
-- Note: This is a simplified set; expand as needed per resource
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped)
SELECT 
  r.id,
  resource,
  action,
  FALSE
FROM admin_roles r,
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
ON CONFLICT DO NOTHING;

-- Insert permissions for RDO_Admin (RDO sector only)
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'rdo'
FROM admin_roles r,
(
  SELECT 'rdo_diarios' AS resource, 'view' AS action
  UNION ALL SELECT 'rdo_diarios', 'create'
  UNION ALL SELECT 'rdo_diarios', 'edit'
  UNION ALL SELECT 'rdo_diarios', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'RDO_Admin'
ON CONFLICT DO NOTHING;

-- Insert permissions for Equipment_Admin
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'equipment'
FROM admin_roles r,
(
  SELECT 'equipamentos' AS resource, 'view' AS action
  UNION ALL SELECT 'equipamentos', 'create'
  UNION ALL SELECT 'equipamentos', 'edit'
  UNION ALL SELECT 'equipamentos', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Equipment_Admin'
ON CONFLICT DO NOTHING;

-- Insert permissions for Fuel_Admin
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'fuel'
FROM admin_roles r,
(
  SELECT 'abastecimentos' AS resource, 'view' AS action
  UNION ALL SELECT 'abastecimentos', 'create'
  UNION ALL SELECT 'abastecimentos', 'edit'
  UNION ALL SELECT 'abastecimentos', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Fuel_Admin'
ON CONFLICT DO NOTHING;

-- Insert permissions for Maintenance_Admin
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'maintenance'
FROM admin_roles r,
(
  SELECT 'manutencao_os' AS resource, 'view' AS action
  UNION ALL SELECT 'manutencao_os', 'create'
  UNION ALL SELECT 'manutencao_os', 'edit'
  UNION ALL SELECT 'manutencao_os', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'Maintenance_Admin'
ON CONFLICT DO NOTHING;

-- Insert permissions for HR_Admin
INSERT INTO admin_permissions (role_id, resource, action, is_sector_scoped, sector_filter)
SELECT 
  r.id,
  resource,
  action,
  TRUE,
  'hr'
FROM admin_roles r,
(
  SELECT 'funcionarios' AS resource, 'view' AS action
  UNION ALL SELECT 'funcionarios', 'create'
  UNION ALL SELECT 'funcionarios', 'edit'
  UNION ALL SELECT 'funcionarios', 'delete'
  UNION ALL SELECT 'admin_audit_log', 'view'
) perms
WHERE r.name = 'HR_Admin'
ON CONFLICT DO NOTHING;

-- Enable RLS on all new tables
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view admin roles in their company
CREATE POLICY "users_view_company_admin_roles" ON admin_roles
  FOR SELECT USING (
    company_id = (SELECT company_id FROM employees WHERE id::text = auth.uid())
  );

-- RLS Policy: Only Super_Admin or role creators can manage admin roles
CREATE POLICY "admin_manage_roles" ON admin_roles
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT employee_id::text FROM user_admin_roles
      WHERE role_id IN (
        SELECT id FROM admin_roles WHERE name = 'Super_Admin'
      )
    )
  );

-- RLS Policy: Users can view permissions for their company's roles
CREATE POLICY "users_view_permissions" ON admin_permissions
  FOR SELECT USING (
    company_id = (SELECT company_id FROM employees WHERE id::text = auth.uid())
  );

-- RLS Policy: Only Super_Admin can manage permissions
CREATE POLICY "admin_manage_permissions" ON admin_permissions
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT employee_id::text FROM user_admin_roles
      WHERE role_id IN (
        SELECT id FROM admin_roles WHERE name = 'Super_Admin'
      )
    )
  );

-- RLS Policy: Users can view their own assignments and their company's assignments
CREATE POLICY "view_admin_roles_assignments" ON user_admin_roles
  FOR SELECT USING (
    company_id = (SELECT company_id FROM employees WHERE id::text = auth.uid())
    OR employee_id::text = auth.uid()
  );

-- RLS Policy: Only Super_Admin can assign/revoke admin roles
CREATE POLICY "admin_assign_roles" ON user_admin_roles
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT employee_id::text FROM user_admin_roles
      WHERE role_id IN (
        SELECT id FROM admin_roles WHERE name = 'Super_Admin'
      )
    )
  );

-- RLS Policy: Users can view audit logs for their company (Super_Admin only for now)
CREATE POLICY "view_admin_audit_log" ON admin_audit_log
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT employee_id::text FROM user_admin_roles
      WHERE role_id IN (
        SELECT id FROM admin_roles WHERE name = 'Super_Admin'
      )
    )
  );

-- RLS Policy: Log admin actions (insert for system)
CREATE POLICY "log_admin_actions" ON admin_audit_log
  FOR INSERT WITH CHECK (true);

-- Function to check if user has admin permission
CREATE OR REPLACE FUNCTION has_admin_permission(
  p_user_id TEXT,
  p_resource TEXT,
  p_action TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_admin_roles uar
    JOIN admin_roles ar ON ar.id = uar.role_id
    JOIN admin_permissions ap ON ap.role_id = ar.id
    WHERE uar.employee_id::text = p_user_id
      AND ap.resource = p_resource
      AND ap.action = p_action
      AND uar.is_active = TRUE
      AND ar.active = TRUE
      AND (p_company_id IS NULL OR uar.company_id = p_company_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check sector-scoped access
CREATE OR REPLACE FUNCTION has_sector_access(
  p_user_id TEXT,
  p_resource TEXT,
  p_action TEXT,
  p_sector TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_admin_roles uar
    JOIN admin_roles ar ON ar.id = uar.role_id
    JOIN admin_permissions ap ON ap.role_id = ar.id
    WHERE uar.employee_id::text = p_user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
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
  SELECT company_id INTO v_company_id FROM employees WHERE id = p_admin_id;
  
  INSERT INTO admin_audit_log (
    company_id, admin_id, action, resource, resource_id,
    changes_before, changes_after
  )
  VALUES (v_company_id, p_admin_id, p_action, p_resource, p_resource_id, p_changes_before, p_changes_after)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_admin_permission TO authenticated;
GRANT EXECUTE ON FUNCTION has_sector_access TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;

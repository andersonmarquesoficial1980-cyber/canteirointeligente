-- =====================================================
-- ADMIN ROLES FIX: RLS Policy Update for Company Admins
-- =====================================================
-- ISSUE: Page /admin/roles was empty - RLS policies were too restrictive
-- CAUSE: Only Super_Admin role allowed, but most users are company admins (is_admin=true)
-- SOLUTION: Add OR condition to allow company admins (is_admin=true) in profiles table
-- =====================================================

-- Drop old restrictive policies
DROP POLICY IF EXISTS "admin_manage_roles" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "admin_assign_roles" ON public.user_admin_roles;
DROP POLICY IF EXISTS "view_admin_audit_log" ON public.admin_audit_log;

-- =====================================================
-- NEW RLS Policies with Company Admin Support
-- =====================================================

-- Policy 1: Manage admin roles (Super_Admin OR company admins)
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

-- Policy 2: Manage permissions (Super_Admin OR company admins)
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

-- Policy 3: Assign/revoke roles (Super_Admin OR company admins)
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

-- Policy 4: View audit logs (Super_Admin OR company admins)
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

-- =====================================================
-- DONE: RLS policies updated to support company admins
-- =====================================================

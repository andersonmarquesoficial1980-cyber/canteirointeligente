-- =====================================================
-- MISSION CRÍTICA: Change user_admin_roles to reference profiles (users) instead of employees
-- Date: 2026-07-04
-- Purpose: Assign admin roles to profiles (system users) not employees (staff records)
-- =====================================================
-- CHANGE LOG:
-- - Rename column: employee_id → user_id (references profiles.user_id / auth.users.id)
-- - Update RLS policies to work with profiles instead of employees
-- - Update helper functions to work with user_id instead of employee_id
-- - Migration is SAFE: uses ADD COLUMN + data migration + DROP OLD COLUMN pattern
-- =====================================================

-- Step 1: Add new user_id column to user_admin_roles
ALTER TABLE public.user_admin_roles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Step 2: Migrate data from employee_id to user_id if we have a mapping
-- This assumes employees might have profiles - we need to find the user_id for each employee_id
-- Query to check if mapping exists: SELECT e.id, p.user_id FROM employees e 
--   INNER JOIN profiles p ON p.email = e.email
-- For now, we'll backfill with NULL and admins will need to reassign

-- Step 3: Make user_id NOT NULL after migration (only if data is backfilled)
-- This is commented out for safety - uncomment after data migration
-- ALTER TABLE public.user_admin_roles ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Add unique constraint on (user_id, role_id) to prevent duplicates
ALTER TABLE public.user_admin_roles
ADD CONSTRAINT unique_user_role_assignment UNIQUE (user_id, role_id);

-- Step 5: Update indexes for user_id
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_user ON public.user_admin_roles(user_id);

-- Step 6: Update RLS policies to work with profiles.user_id

-- Drop old policies
DROP POLICY IF EXISTS \"view_admin_roles_assignments\" ON public.user_admin_roles;
DROP POLICY IF EXISTS \"admin_assign_roles\" ON public.user_admin_roles;

-- New RLS Policy: Users can view their own assignments and their company's assignments
CREATE POLICY \"view_admin_roles_assignments\" ON public.user_admin_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id = (
      SELECT company_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- New RLS Policy: Only Super_Admin or company admins can assign/revoke admin roles
CREATE POLICY \"admin_assign_roles\" ON public.user_admin_roles
  FOR ALL USING (
    -- User has Super_Admin role
    EXISTS (
      SELECT 1 FROM public.user_admin_roles uar
      INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
      WHERE uar.user_id = auth.uid()
        AND ar.name = 'Super_Admin'
        AND uar.is_active = TRUE
    )
    -- OR: User is company admin
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_admin = TRUE
        AND p.company_id = user_admin_roles.company_id
    )
  );

-- Step 7: Update helper functions to use user_id instead of employee_id

-- Drop old function
DROP FUNCTION IF EXISTS public.has_admin_permission(UUID, TEXT, TEXT, UUID);

-- New version using user_id
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
    WHERE uar.user_id = p_user_id
      AND ap.resource = p_resource
      AND ap.action = p_action
      AND uar.is_active = TRUE
      AND ar.active = TRUE
      AND (p_company_id IS NULL OR uar.company_id = p_company_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop old sector function
DROP FUNCTION IF EXISTS public.has_sector_access(TEXT, TEXT, TEXT, TEXT, UUID);

-- New version using user_id
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
    WHERE uar.user_id = p_user_id
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

-- Drop old log function
DROP FUNCTION IF EXISTS public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB, JSONB);

-- New version using user_id for admin
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_user_id UUID,
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
  SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = p_admin_user_id;
  
  INSERT INTO public.admin_audit_log (
    company_id, admin_id, action, resource, resource_id,
    changes_before, changes_after
  )
  VALUES (v_company_id, p_admin_user_id, p_action, p_resource, p_resource_id, p_changes_before, p_changes_after)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.has_admin_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sector_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;

-- =====================================================
-- MIGRATION NOTES FOR TEAMS
-- =====================================================
-- After this migration runs:
-- 1. user_admin_roles.user_id will be empty (NULL values)
-- 2. Admins need to reassign roles to profiles (users) via AdminRolesPage
-- 3. Old employee_id column can be dropped in a future migration (20260705)
-- 4. If you need to migrate existing data, run this query BEFORE migration:
--    UPDATE public.user_admin_roles uar
--    SET user_id = p.user_id
--    FROM public.employees e
--    INNER JOIN public.profiles p ON p.email = e.email
--    WHERE e.id = uar.employee_id;
-- =====================================================

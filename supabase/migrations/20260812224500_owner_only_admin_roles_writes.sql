-- Owner-only hardening for Admin Roles / Permissões writes
-- Keeps SELECT behavior intact (needed for painel rendering),
-- but blocks INSERT/UPDATE/DELETE for non-owner users at RLS level.

create or replace function public.is_owner_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'andersonmarquesoficial1980@gmail.com',
    'anderson@fremix.workflux.app'
  );
$$;

-- admin_roles
DROP POLICY IF EXISTS admin_roles_owner_write_restrictive_insert ON public.admin_roles;
DROP POLICY IF EXISTS admin_roles_owner_write_restrictive_update ON public.admin_roles;
DROP POLICY IF EXISTS admin_roles_owner_write_restrictive_delete ON public.admin_roles;

CREATE POLICY admin_roles_owner_write_restrictive_insert
ON public.admin_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY admin_roles_owner_write_restrictive_update
ON public.admin_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_owner_admin_email())
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY admin_roles_owner_write_restrictive_delete
ON public.admin_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_owner_admin_email());

-- admin_permissions
DROP POLICY IF EXISTS admin_permissions_owner_write_restrictive_insert ON public.admin_permissions;
DROP POLICY IF EXISTS admin_permissions_owner_write_restrictive_update ON public.admin_permissions;
DROP POLICY IF EXISTS admin_permissions_owner_write_restrictive_delete ON public.admin_permissions;

CREATE POLICY admin_permissions_owner_write_restrictive_insert
ON public.admin_permissions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY admin_permissions_owner_write_restrictive_update
ON public.admin_permissions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_owner_admin_email())
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY admin_permissions_owner_write_restrictive_delete
ON public.admin_permissions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_owner_admin_email());

-- user_admin_roles
DROP POLICY IF EXISTS user_admin_roles_owner_write_restrictive_insert ON public.user_admin_roles;
DROP POLICY IF EXISTS user_admin_roles_owner_write_restrictive_update ON public.user_admin_roles;
DROP POLICY IF EXISTS user_admin_roles_owner_write_restrictive_delete ON public.user_admin_roles;

CREATE POLICY user_admin_roles_owner_write_restrictive_insert
ON public.user_admin_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_roles_owner_write_restrictive_update
ON public.user_admin_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_owner_admin_email())
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_roles_owner_write_restrictive_delete
ON public.user_admin_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_owner_admin_email());

-- user_admin_permissions
DROP POLICY IF EXISTS user_admin_permissions_owner_write_restrictive_insert ON public.user_admin_permissions;
DROP POLICY IF EXISTS user_admin_permissions_owner_write_restrictive_update ON public.user_admin_permissions;
DROP POLICY IF EXISTS user_admin_permissions_owner_write_restrictive_delete ON public.user_admin_permissions;

CREATE POLICY user_admin_permissions_owner_write_restrictive_insert
ON public.user_admin_permissions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_permissions_owner_write_restrictive_update
ON public.user_admin_permissions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_owner_admin_email())
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_permissions_owner_write_restrictive_delete
ON public.user_admin_permissions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_owner_admin_email());

-- user_admin_panel_access
DROP POLICY IF EXISTS user_admin_panel_access_owner_write_restrictive_insert ON public.user_admin_panel_access;
DROP POLICY IF EXISTS user_admin_panel_access_owner_write_restrictive_update ON public.user_admin_panel_access;
DROP POLICY IF EXISTS user_admin_panel_access_owner_write_restrictive_delete ON public.user_admin_panel_access;

CREATE POLICY user_admin_panel_access_owner_write_restrictive_insert
ON public.user_admin_panel_access
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_panel_access_owner_write_restrictive_update
ON public.user_admin_panel_access
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_owner_admin_email())
WITH CHECK (public.is_owner_admin_email());

CREATE POLICY user_admin_panel_access_owner_write_restrictive_delete
ON public.user_admin_panel_access
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_owner_admin_email());

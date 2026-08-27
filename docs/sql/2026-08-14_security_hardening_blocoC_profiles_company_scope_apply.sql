BEGIN;

-- Harden profiles policies for multi-tenant scope
-- Goal: admin manages only same-company profiles; superadmin remains global.

DROP POLICY IF EXISTS select_all_profiles_admin ON public.profiles;
CREATE POLICY select_all_profiles_admin
ON public.profiles
FOR SELECT TO authenticated
USING (
  -- superadmin global
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.user_id = auth.uid()
      AND me.role = 'superadmin'
  )
  OR (
    -- company-scoped admin
    company_id = (
      SELECT me.company_id
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND (me.role = 'admin' OR me.perfil = 'Administrador')
    )
  )
);

DROP POLICY IF EXISTS admin_update_profiles ON public.profiles;
CREATE POLICY admin_update_profiles
ON public.profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.user_id = auth.uid()
      AND me.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT me.company_id
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND (me.role = 'admin' OR me.perfil = 'Administrador')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.user_id = auth.uid()
      AND me.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT me.company_id
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND (me.role = 'admin' OR me.perfil = 'Administrador')
    )
  )
);

DROP POLICY IF EXISTS admin_delete_profiles ON public.profiles;
CREATE POLICY admin_delete_profiles
ON public.profiles
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.user_id = auth.uid()
      AND me.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT me.company_id
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND (me.role = 'admin' OR me.perfil = 'Administrador')
    )
  )
);

DROP POLICY IF EXISTS admin_insert_profiles ON public.profiles;
CREATE POLICY admin_insert_profiles
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  -- self profile bootstrap
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.user_id = auth.uid()
      AND me.role = 'superadmin'
  )
  OR (
    company_id = (
      SELECT me.company_id
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND (me.role = 'admin' OR me.perfil = 'Administrador')
    )
  )
);

COMMIT;

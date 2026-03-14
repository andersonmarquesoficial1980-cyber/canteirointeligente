
-- 1. Update has_role function with new admin email
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(_role) = 'admin'
      AND EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = _user_id
          AND lower(coalesce(u.email, '')) = ANY (ARRAY['andersonmarquesoficial1980@gmail.com'])
      )
    THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
    )
  END
$$;

-- 2. Fix broken equipment_diaries RLS policies (remove bad ones, keep good ones)
DROP POLICY IF EXISTS "Segurança por Empresa - Diários" ON public.equipment_diaries;
DROP POLICY IF EXISTS "Usuários veem apenas dados da sua empresa" ON public.equipment_diaries;

-- 3. Fix profiles RLS: use user_id not id for subquery
DROP POLICY IF EXISTS "Segurança por Empresa - Horas" ON public.equipment_time_entries;
DROP POLICY IF EXISTS "Time entries por empresa" ON public.equipment_time_entries;

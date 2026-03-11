-- Hotfix de acesso: simplificar RLS para login e evitar loops de checagem de admin
-- 1) Reforçar has_role com override por e-mail (server-side)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(_role) = 'admin'
      AND EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = _user_id
          AND lower(coalesce(u.email, '')) = ANY (ARRAY['anderson@fremix.com.br'])
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

-- 2) Remover TODAS as políticas de profiles e user_roles
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;

  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', p.policyname);
  END LOOP;
END
$$;

-- 3) Garantir RLS habilitado e política única PERMISSIVE de leitura para authenticated
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_authenticated
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY user_roles_select_authenticated
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
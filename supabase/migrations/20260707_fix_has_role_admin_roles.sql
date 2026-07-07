-- Fix: has_role agora reconhece usuários com admin_roles ativos (além do superadmin hardcoded)
-- Problema: Gustavo tem RDO_Admin e Equipment_Admin, mas RLS bloqueava por has_role retornar false

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(_role) = 'admin'
      AND (
        -- Superadmin hardcoded por email
        EXISTS (
          SELECT 1
          FROM auth.users u
          WHERE u.id = _user_id
            AND lower(coalesce(u.email, '')) = ANY (ARRAY['anderson@fremix.com.br'])
        )
        OR
        -- Usuários com qualquer role ativo em user_admin_roles
        EXISTS (
          SELECT 1
          FROM public.user_admin_roles uar
          WHERE uar.user_id = _user_id
            AND uar.is_active = true
        )
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

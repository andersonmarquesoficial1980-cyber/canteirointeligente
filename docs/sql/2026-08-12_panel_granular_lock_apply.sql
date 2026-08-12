begin;

-- A) has_role('admin') considera:
--    1) superadmin por email (owners)
--    2) qualquer role ativo em user_admin_roles por employee_id (ou user_id legado)
--    3) fallback user_roles legado
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(_role) = 'admin'
      and (
        exists (
          select 1
          from auth.users u
          where u.id = _user_id
            and lower(coalesce(u.email, '')) = any (array[
              'anderson@fremix.workflux.app',
              'andersonmarquesoficial1980@gmail.com',
              'anderson@fremix.com.br'
            ])
        )
        or exists (
          select 1
          from public.user_admin_roles uar
          where coalesce(uar.is_active, true) = true
            and (
              uar.employee_id = _user_id
              or uar.user_id = _user_id
            )
        )
      )
    then true
    else exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.role = _role
    )
  end
$$;

-- B) Remover acesso total legado por user_permissions.is_admin
--    (manter true apenas para Anderson na Fremix)
update public.user_permissions up
set is_admin = false,
    updated_at = now()
from public.profiles p
where p.user_id = up.user_id
  and p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and lower(p.email) <> lower('anderson@fremix.workflux.app')
  and up.is_admin = true;

commit;

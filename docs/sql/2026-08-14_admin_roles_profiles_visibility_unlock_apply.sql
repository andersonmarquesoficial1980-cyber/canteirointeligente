BEGIN;

-- 1) Helper: reconhece admin por role ativa (Admin Roles), escopado pela company do profile logado
create or replace function public.auth_profile_has_any_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_admin_roles uar
    where uar.user_id = auth.uid()
      and uar.is_active = true
      and (
        uar.company_id = public.auth_profile_company_id()
        or public.auth_profile_is_superadmin()
      )
  );
$$;

-- 2) Ajuste de política de SELECT em profiles:
--    mantém superadmin/admin-perfil e adiciona admin por Admin Roles (somente leitura, company-scoped)
drop policy if exists select_all_profiles_admin on public.profiles;
create policy select_all_profiles_admin
on public.profiles
for select to authenticated
using (
  public.auth_profile_is_superadmin()
  or (
    company_id = public.auth_profile_company_id()
    and (
      public.auth_profile_is_admin()
      or public.auth_profile_has_any_admin_role()
    )
  )
);

-- 3) Higiene de legado em user_admin_roles
-- 3a) Se houver conflito (mesmo role_id já existente no mapped user_id), desativa linha legada nula
with candidates as (
  select uar.id,
         p.user_id as mapped_user_id,
         exists (
           select 1
           from public.user_admin_roles x
           where x.id <> uar.id
             and x.role_id = uar.role_id
             and x.user_id = p.user_id
         ) as has_conflict
  from public.user_admin_roles uar
  join public.profiles p on p.user_id = uar.employee_id
  where uar.user_id is null
)
update public.user_admin_roles u
set is_active = false,
    revoked_at = coalesce(u.revoked_at, now())
from candidates c
where u.id = c.id
  and c.has_conflict = true;

-- 3b) Backfill user_id para linhas remanescentes sem conflito
with candidates as (
  select uar.id,
         p.user_id as mapped_user_id,
         exists (
           select 1
           from public.user_admin_roles x
           where x.id <> uar.id
             and x.role_id = uar.role_id
             and x.user_id = p.user_id
         ) as has_conflict
  from public.user_admin_roles uar
  join public.profiles p on p.user_id = uar.employee_id
  where uar.user_id is null
)
update public.user_admin_roles u
set user_id = c.mapped_user_id
from candidates c
where u.id = c.id
  and c.has_conflict = false;

COMMIT;

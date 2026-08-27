begin;

-- Contexto fixo Fremix + Gabrielli
with ctx as (
  select 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id,
    lower('gabrielli.sousa@fremix.workflux.app') as gab_email
)
-- 1) garantir role Unlock_Admin (company-scoped Fremix)
insert into public.admin_roles (company_id, name, description, is_system_role, active)
select c.company_id, 'Unlock_Admin', 'Pode aprovar desbloqueio de lançamentos', false, true
from ctx c
where not exists (
  select 1 from public.admin_roles ar
  where ar.company_id = c.company_id
    and ar.name = 'Unlock_Admin'
);

-- 2) garantir permissões do Unlock_Admin
with ctx as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
), unlock_role as (
  select ar.id, ar.company_id
  from public.admin_roles ar
  join ctx c on c.company_id = ar.company_id
  where ar.name='Unlock_Admin'
  limit 1
)
insert into public.admin_permissions (company_id, role_id, resource, action, is_sector_scoped, sector_filter)
select ur.company_id, ur.id, x.resource, x.action, false, null
from unlock_role ur
join (values
  ('admin_section.desbloquear','approve'),
  ('admin_section.auditoria','view')
) as x(resource, action) on true
where not exists (
  select 1 from public.admin_permissions ap
  where ap.company_id = ur.company_id
    and ap.role_id = ur.id
    and ap.resource = x.resource
    and ap.action = x.action
);

-- 3) remover approve/desbloquear dos roles setoriais (RDO_Admin, Fuel_Admin)
with target_roles as (
  select id
  from public.admin_roles
  where name in ('RDO_Admin','Fuel_Admin')
)
delete from public.admin_permissions ap
using target_roles tr
where ap.role_id = tr.id
  and ap.resource='admin_section.desbloquear'
  and ap.action='approve';

-- 4) garantir Gabrielli com Unlock_Admin ativo
with ctx as (
  select 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id,
    lower('gabrielli.sousa@fremix.workflux.app') as gab_email
),
gab as (
  select p.user_id, p.company_id
  from public.profiles p
  join ctx c on c.company_id = p.company_id
  where lower(p.email) = c.gab_email
  limit 1
),
unlock_role as (
  select ar.id as role_id, ar.company_id
  from public.admin_roles ar
  join ctx c on c.company_id = ar.company_id
  where ar.name='Unlock_Admin'
  limit 1
)
insert into public.user_admin_roles (employee_id, role_id, company_id, is_active, assigned_at, revoked_at)
select g.user_id, ur.role_id, g.company_id, true, now(), null
from gab g
join unlock_role ur on ur.company_id = g.company_id
where not exists (
  select 1 from public.user_admin_roles uar
  where uar.employee_id = g.user_id
    and uar.company_id = g.company_id
    and uar.role_id = ur.role_id
);

-- 5) reativar se já existia desativado para Gabrielli
with ctx as (
  select 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id,
    lower('gabrielli.sousa@fremix.workflux.app') as gab_email
),
gab as (
  select p.user_id, p.company_id
  from public.profiles p
  join ctx c on c.company_id = p.company_id
  where lower(p.email) = c.gab_email
  limit 1
),
unlock_role as (
  select ar.id as role_id, ar.company_id
  from public.admin_roles ar
  join ctx c on c.company_id = ar.company_id
  where ar.name='Unlock_Admin'
  limit 1
)
update public.user_admin_roles uar
set is_active = true,
    revoked_at = null
from gab g
join unlock_role ur on ur.company_id = g.company_id
where uar.employee_id = g.user_id
  and uar.company_id = g.company_id
  and uar.role_id = ur.role_id;

commit;

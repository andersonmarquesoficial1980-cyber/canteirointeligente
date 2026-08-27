-- Preview (read-only)
-- Objetivo:
-- 1) Remover approve de desbloquear dos roles setoriais (RDO_Admin, Fuel_Admin)
-- 2) Criar role Unlock_Admin para a Fremix
-- 3) Garantir que apenas Gabrielli tenha Unlock_Admin

with ctx as (
  select 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id,
    lower('gabrielli.sousa@fremix.workflux.app') as gab_email
),
roles_setoriais as (
  select ar.id, ar.name
  from public.admin_roles ar
  where ar.name in ('RDO_Admin','Fuel_Admin')
    and coalesce(ar.active,true)=true
),
approve_setorial as (
  select ar.name as role_name, ap.id as permission_id
  from public.admin_permissions ap
  join roles_setoriais ar on ar.id = ap.role_id
  where ap.resource = 'admin_section.desbloquear'
    and ap.action = 'approve'
),
unlock_role as (
  select ar.*
  from public.admin_roles ar
  join ctx c on c.company_id = ar.company_id
  where ar.name = 'Unlock_Admin'
),
unlock_assignments as (
  select uar.employee_id, p.email, uar.is_active
  from public.user_admin_roles uar
  join unlock_role ur on ur.id = uar.role_id
  left join public.profiles p on p.user_id = uar.employee_id and p.company_id = uar.company_id
  where uar.company_id = (select company_id from ctx)
),
who_can_unlock_now as (
  select distinct p.email, ar.name as via_role
  from public.user_admin_roles uar
  join public.admin_roles ar on ar.id = uar.role_id
  join public.admin_permissions ap on ap.role_id = ar.id
  join public.profiles p on p.user_id = uar.employee_id and p.company_id = uar.company_id
  join ctx c on c.company_id = uar.company_id
  where coalesce(uar.is_active,true)=true
    and ap.resource='admin_section.desbloquear'
    and ap.action='approve'
)
select
  (select count(*) from approve_setorial) as approve_setorial_a_remover,
  (select count(*) from unlock_role) as unlock_role_existente,
  (select count(*) from unlock_assignments where coalesce(is_active,true)=true) as unlock_assignments_ativos,
  (select count(*) from who_can_unlock_now) as usuarios_que_podem_desbloquear_hoje;

with ctx as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
who_can_unlock_now as (
  select distinct p.email, ar.name as via_role
  from public.user_admin_roles uar
  join public.admin_roles ar on ar.id = uar.role_id
  join public.admin_permissions ap on ap.role_id = ar.id
  join public.profiles p on p.user_id = uar.employee_id and p.company_id = uar.company_id
  join ctx c on c.company_id = uar.company_id
  where coalesce(uar.is_active,true)=true
    and ap.resource='admin_section.desbloquear'
    and ap.action='approve'
)
select * from who_can_unlock_now order by email, via_role;
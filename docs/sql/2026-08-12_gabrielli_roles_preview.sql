-- Preview: roles da Gabrielli (Fremix)
with target as (
  select * from (values
    ('RDO_Admin'),
    ('Equipment_Admin'),
    ('Fuel_Admin')
  ) as t(role_name)
),
ctx as (
  select p.user_id, p.company_id
  from public.profiles p
  where lower(p.email)=lower('gabrielli.sousa@fremix.workflux.app')
  limit 1
),
role_ids as (
  select ar.id as role_id, ar.name
  from public.admin_roles ar
  join target t on t.role_name = ar.name
  where coalesce(ar.active, true)=true
),
current_active as (
  select ar.name as role_name
  from public.user_admin_roles uar
  join ctx c on c.user_id = uar.employee_id and c.company_id = uar.company_id
  join public.admin_roles ar on ar.id = uar.role_id
  where coalesce(uar.is_active, true)=true
),
missing as (
  select r.name as role_name
  from role_ids r
  where not exists (select 1 from current_active ca where ca.role_name = r.name)
),
extra as (
  select ca.role_name
  from current_active ca
  where not exists (select 1 from target t where t.role_name = ca.role_name)
)
select
  (select user_id from ctx) as user_id,
  (select company_id from ctx) as company_id,
  (select count(*) from current_active) as ativos_atuais,
  (select count(*) from role_ids) as alvo,
  (select count(*) from missing) as faltando,
  (select count(*) from extra) as extras;

-- Detalhe atual
select ar.name as role_name, uar.is_active, uar.assigned_at
from public.user_admin_roles uar
join public.profiles p on p.user_id = uar.employee_id and p.company_id = uar.company_id
join public.admin_roles ar on ar.id = uar.role_id
where lower(p.email)=lower('gabrielli.sousa@fremix.workflux.app')
order by ar.name, uar.assigned_at;

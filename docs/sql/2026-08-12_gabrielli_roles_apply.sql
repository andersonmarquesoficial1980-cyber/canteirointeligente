-- Apply: Gabrielli = RDO + Equipamentos + Abastecimento (sem super admin)
begin;

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
)
-- 1) Reativar/alvo existente
update public.user_admin_roles uar
set is_active = true,
    revoked_at = null
from ctx c
join role_ids r on true
where uar.employee_id = c.user_id
  and uar.company_id = c.company_id
  and uar.role_id = r.role_id;

-- 2) Inserir alvo faltante
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
)
insert into public.user_admin_roles (employee_id, role_id, company_id, is_active, assigned_at, revoked_at)
select c.user_id, r.role_id, c.company_id, true, now(), null
from ctx c
join role_ids r on true
where not exists (
  select 1
  from public.user_admin_roles u
  where u.employee_id = c.user_id
    and u.company_id = c.company_id
    and u.role_id = r.role_id
);

-- 3) Desativar qualquer role fora do alvo
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
target_role_ids as (
  select ar.id as role_id
  from public.admin_roles ar
  join target t on t.role_name = ar.name
)
update public.user_admin_roles uar
set is_active = false,
    revoked_at = now()
from ctx c
where uar.employee_id = c.user_id
  and uar.company_id = c.company_id
  and coalesce(uar.is_active, true)=true
  and not exists (
    select 1 from target_role_ids tr where tr.role_id = uar.role_id
  );

commit;

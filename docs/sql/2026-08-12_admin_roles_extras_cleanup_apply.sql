-- APPLY: limpeza dos 3 extras legados de Admin Roles
-- Segurança: delete estritamente por (role_name, resource, action)

begin;

with target_extras as (
  select * from (
    values
      ('Equipment_Admin','equipment_diaries','view_all'),
      ('RDO_Admin','equipment_diaries','view_own'),
      ('RDO_Admin','rdo_diarios','view_all')
  ) as t(role_name, resource, action)
),
to_delete as (
  select ap.id
  from public.admin_permissions ap
  join public.admin_roles ar on ar.id = ap.role_id
  join target_extras te
    on te.role_name = ar.name
   and te.resource = ap.resource
   and te.action = ap.action
)
delete from public.admin_permissions ap
using to_delete d
where ap.id = d.id;

commit;

-- verificação pós-apply
with target_extras as (
  select * from (
    values
      ('Equipment_Admin','equipment_diaries','view_all'),
      ('RDO_Admin','equipment_diaries','view_own'),
      ('RDO_Admin','rdo_diarios','view_all')
  ) as t(role_name, resource, action)
)
select
  ar.name as role_name,
  ap.resource,
  ap.action
from public.admin_permissions ap
join public.admin_roles ar on ar.id = ap.role_id
join target_extras te
  on te.role_name = ar.name
 and te.resource = ap.resource
 and te.action = ap.action
order by role_name, ap.resource, ap.action;

-- PREVIEW (READ-ONLY): extras legados de Admin Roles
-- Escopo: apenas 3 permissões extras mapeadas na auditoria

with target_extras as (
  select * from (
    values
      ('Equipment_Admin','equipment_diaries','view_all'),
      ('RDO_Admin','equipment_diaries','view_own'),
      ('RDO_Admin','rdo_diarios','view_all')
  ) as t(role_name, resource, action)
),
matched as (
  select
    ap.id,
    ar.name as role_name,
    ap.resource,
    ap.action,
    ap.company_id,
    ap.created_at
  from public.admin_permissions ap
  join public.admin_roles ar on ar.id = ap.role_id
  join target_extras te
    on te.role_name = ar.name
   and te.resource = ap.resource
   and te.action = ap.action
)
select *
from matched
order by role_name, resource, action;

-- resumo
with target_extras as (
  select * from (
    values
      ('Equipment_Admin','equipment_diaries','view_all'),
      ('RDO_Admin','equipment_diaries','view_own'),
      ('RDO_Admin','rdo_diarios','view_all')
  ) as t(role_name, resource, action)
),
matched as (
  select ap.id
  from public.admin_permissions ap
  join public.admin_roles ar on ar.id = ap.role_id
  join target_extras te
    on te.role_name = ar.name
   and te.resource = ap.resource
   and te.action = ap.action
)
select count(*) as extras_encontrados from matched;

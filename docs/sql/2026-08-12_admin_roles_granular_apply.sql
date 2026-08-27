-- APPLY: Admin Roles granulares por seção do Painel
-- Segurança: DML idempotente via ON CONFLICT (role_id, resource, action)
-- Observação: não remove permissões antigas; apenas adiciona/atualiza a matriz alvo

begin;

with desired as (
  -- role_name, resource, action
  select * from (
    values
      -- Super Admin: controle total
      ('Super_Admin','all','manage'),

      -- RDO
      ('RDO_Admin','admin_section.dashboard','view'),
      ('RDO_Admin','admin_section.ogs','manage'),
      ('RDO_Admin','admin_section.engenheiros_ogs','manage'),
      ('RDO_Admin','admin_section.encarregados_ogs','manage'),
      ('RDO_Admin','admin_section.desbloquear','approve'),
      ('RDO_Admin','admin_section.auditoria','view'),

      -- Equipamentos
      ('Equipment_Admin','admin_section.dashboard','view'),
      ('Equipment_Admin','admin_section.maquinas','manage'),
      ('Equipment_Admin','admin_section.tipos_equipamento','manage'),
      ('Equipment_Admin','admin_section.operadores_habilitados','manage'),
      ('Equipment_Admin','admin_section.auditoria','view'),

      -- Abastecimento
      ('Fuel_Admin','admin_section.dashboard','view'),
      ('Fuel_Admin','admin_section.abastecimento_config','manage'),
      ('Fuel_Admin','admin_section.fornecedores','manage'),
      ('Fuel_Admin','admin_section.destinos','manage'),
      ('Fuel_Admin','admin_section.desbloquear','approve'),
      ('Fuel_Admin','admin_section.auditoria','view'),

      -- Manutenção
      ('Maintenance_Admin','admin_section.dashboard','view'),
      ('Maintenance_Admin','admin_section.maquinas','manage'),
      ('Maintenance_Admin','admin_section.fornecedores','manage'),
      ('Maintenance_Admin','admin_section.materiais','manage'),
      ('Maintenance_Admin','admin_section.auditoria','view'),

      -- RH
      ('HR_Admin','admin_section.dashboard','view'),
      ('HR_Admin','admin_section.funcionarios','manage'),
      ('HR_Admin','admin_section.equipes','manage'),
      ('HR_Admin','admin_section.centros_custo','manage'),
      ('HR_Admin','admin_section.funcoes','manage'),
      ('HR_Admin','admin_section.tarifas_vt','manage'),
      ('HR_Admin','admin_section.auditoria','view')
  ) as t(role_name, resource, action)
),
role_map as (
  select id, name
  from public.admin_roles
  where name in ('Super_Admin','RDO_Admin','Equipment_Admin','Fuel_Admin','Maintenance_Admin','HR_Admin')
)
insert into public.admin_permissions (
  role_id,
  resource,
  action,
  is_sector_scoped,
  sector_filter,
  company_id
)
select
  r.id,
  d.resource,
  d.action,
  false,
  null,
  null
from desired d
join role_map r on r.name = d.role_name
on conflict (role_id, resource, action) do update
set
  is_sector_scoped = excluded.is_sector_scoped,
  sector_filter = excluded.sector_filter;

commit;

-- Verificação pós-apply
select
  ar.name as role,
  count(*) as total_permissoes,
  string_agg(ap.resource || ':' || ap.action, ', ' order by ap.resource, ap.action) as permissoes
from public.admin_roles ar
left join public.admin_permissions ap on ap.role_id = ar.id
where ar.name in ('Super_Admin','RDO_Admin','Equipment_Admin','Fuel_Admin','Maintenance_Admin','HR_Admin')
group by ar.name
order by ar.name;

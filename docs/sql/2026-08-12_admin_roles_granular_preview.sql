-- Preview (READ-ONLY): Admin Roles granulares por seção do Painel
-- Objetivo: comparar estado atual x matriz desejada

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
),
current_perms as (
  select r.name as role_name, ap.resource, ap.action
  from public.admin_permissions ap
  join role_map r on r.id = ap.role_id
),
missing as (
  select d.*
  from desired d
  left join current_perms c
    on c.role_name = d.role_name
   and c.resource = d.resource
   and c.action = d.action
  where c.role_name is null
),
extra as (
  select c.*
  from current_perms c
  left join desired d
    on d.role_name = c.role_name
   and d.resource = c.resource
   and d.action = c.action
  where d.role_name is null
)

-- 1) Foto atual
select 'ATUAL' as bloco, role_name, resource, action
from current_perms
order by role_name, resource, action;

-- 2) O que falta para chegar na matriz alvo
select 'FALTANDO' as bloco, role_name, resource, action
from missing
order by role_name, resource, action;

-- 3) O que existe hoje e não está na matriz alvo (revisar antes de limpar)
select 'EXTRA' as bloco, role_name, resource, action
from extra
order by role_name, resource, action;

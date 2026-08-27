-- Fase 2.2 APPLY (com autorização explícita)
-- Estratégia: criar catálogo de aliases e aplicar backfill seguro por alias_norm + company_id.
-- Regra: atualiza SOMENTE colunas *_employee_id que estão NULL.

begin;

-- 1) Catálogo de aliases (persistente)
create table if not exists public.employee_name_aliases (
  company_id uuid not null,
  alias_text text not null,
  alias_norm text not null,
  employee_id uuid not null references public.employees(id),
  created_at timestamp with time zone not null default now(),
  created_by text not null default 'hermes',
  primary key (company_id, alias_norm)
);

create index if not exists idx_employee_name_aliases_employee_id
  on public.employee_name_aliases(employee_id);

-- 2) Seed/Upsert de aliases aprovados (alta confiança)
with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select e.id as employee_id, e.company_id, trim(e.name) as employee_name
  from public.employees e
  where e.status = 'ativo'
),
alias_seed(alias_text, target_employee_name) as (
  values
    ('AELSON ROMEU', 'AELSON ROMEU COUTINHO'),
    ('JOSENILDO DA SILVA', 'JOSENILDO DA SILVA RAMOS'),
    ('GIVANILDO BATISTA', 'GIVANILDO BATISTA ESTEVAO'),
    ('ANDERSON MARQUES', 'ANDERSON MARQUES SANTANA'),
    ('THIAGO HENRIQUE', 'THIAGO HENRIQUE F PIMENTEL'),
    ('THIAGO SILVA', 'THIAGO SILVA DOS SANTOS'),
    ('VITOR MACAL', 'VITOR MAÇAL COLASSIO'),
    ('ALEXANDRE S COSTA', 'ALEXANDRE DOS SANTOS COSTA'),
    ('EDIMAR', 'EDIMAR NOVAIS SILVA'),
    ('GIVANILDO ESTEVAO', 'GIVANILDO BATISTA ESTEVAO'),
    ('GIVA', 'GIVANILDO BATISTA ESTEVAO'),
    ('JOSENILDO RAMOS', 'JOSENILDO DA SILVA RAMOS'),
    ('PLINIO MOREIRA', 'PLINIO MOREIRA')
),
ready as (
  select
    c.company_id,
    s.alias_text,
    regexp_replace(
      upper(translate(trim(s.alias_text),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as alias_norm,
    e.employee_id
  from alias_seed s
  join cfg c on true
  join emp e
    on e.company_id = c.company_id
   and e.employee_name = s.target_employee_name
)
insert into public.employee_name_aliases(company_id, alias_text, alias_norm, employee_id, created_by)
select company_id, alias_text, alias_norm, employee_id, 'hermes-fase2_2'
from ready
on conflict (company_id, alias_norm)
do update set
  alias_text = excluded.alias_text,
  employee_id = excluded.employee_id,
  created_by = excluded.created_by;

-- 3) Backfill employees.responsavel_employee_id
with upd as (
  update public.employees t
  set responsavel_employee_id = a.employee_id
  from public.employee_name_aliases a
  where t.company_id = a.company_id
    and coalesce(trim(t.responsavel),'') <> ''
    and t.responsavel_employee_id is null
    and regexp_replace(
      upper(translate(trim(t.responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) = a.alias_norm
  returning t.id
)
select 'employees.responsavel_employee_id' as target, count(*) as updated_rows from upd;

-- 4) Backfill sst_inspections.encarregado_employee_id
with upd as (
  update public.sst_inspections t
  set encarregado_employee_id = a.employee_id
  from public.employee_name_aliases a
  where t.company_id = a.company_id
    and coalesce(trim(t.encarregado_obra),'') <> ''
    and t.encarregado_employee_id is null
    and regexp_replace(
      upper(translate(trim(t.encarregado_obra),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) = a.alias_norm
  returning t.id
)
select 'sst_inspections.encarregado_employee_id' as target, count(*) as updated_rows from upd;

-- 5) Backfill sst_inspections.tecnico_responsavel_employee_id
with upd as (
  update public.sst_inspections t
  set tecnico_responsavel_employee_id = a.employee_id
  from public.employee_name_aliases a
  where t.company_id = a.company_id
    and coalesce(trim(t.tecnico_responsavel),'') <> ''
    and t.tecnico_responsavel_employee_id is null
    and regexp_replace(
      upper(translate(trim(t.tecnico_responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) = a.alias_norm
  returning t.id
)
select 'sst_inspections.tecnico_responsavel_employee_id' as target, count(*) as updated_rows from upd;

-- 6) Backfill sst_inspections.administrativo_employee_id
with upd as (
  update public.sst_inspections t
  set administrativo_employee_id = a.employee_id
  from public.employee_name_aliases a
  where t.company_id = a.company_id
    and coalesce(trim(t.administrativo),'') <> ''
    and t.administrativo_employee_id is null
    and regexp_replace(
      upper(translate(trim(t.administrativo),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) = a.alias_norm
  returning t.id
)
select 'sst_inspections.administrativo_employee_id' as target, count(*) as updated_rows from upd;

commit;

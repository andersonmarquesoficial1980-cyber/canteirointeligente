-- Fase 2.7 APPLY (executado)
-- Objetivo: tratar casos compostos com '/' em sst_inspections.encarregado_obra
-- Regra segura: usar apenas a primeira parte antes de '/' quando houver alias explícito cadastrado.

begin;

-- 1) Garantia de aliases-base
with seed(alias_text,employee_id) as (
  values
    ('GIVANILDO','cd0eaccd-9eea-4c62-a0dc-73755343b628'::uuid),
    ('JOSENILDO','b6241b67-6b42-4cc3-93a7-9804c3a10318'::uuid)
),
ready as (
  select
    e.company_id,
    s.alias_text,
    regexp_replace(
      upper(translate(trim(s.alias_text),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as alias_norm,
    s.employee_id
  from seed s
  join public.employees e on e.id = s.employee_id
)
insert into public.employee_name_aliases(company_id, alias_text, alias_norm, employee_id, created_by)
select company_id, alias_text, alias_norm, employee_id, 'hermes-fase2_7'
from ready
on conflict (company_id, alias_norm)
do update set
  alias_text = excluded.alias_text,
  employee_id = excluded.employee_id,
  created_by = excluded.created_by;

-- 2) APPLY: padrão com '/'
with src as (
  select
    s.id,
    s.company_id,
    trim(split_part(s.encarregado_obra,'/',1)) as first_part
  from public.sst_inspections s
  where s.encarregado_employee_id is null
    and coalesce(trim(s.encarregado_obra),'') <> ''
    and s.encarregado_obra like '%/%'
),
mapped as (
  select
    src.id,
    a.employee_id
  from src
  join public.employee_name_aliases a
    on a.company_id = src.company_id
   and a.alias_norm = regexp_replace(
      upper(translate(trim(src.first_part),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
   )
)
update public.sst_inspections t
set encarregado_employee_id = m.employee_id
from mapped m
where t.id = m.id
  and t.encarregado_employee_id is null;

-- 3) ajuste final direto dos 3 casos remanescentes com first_part=GIVANILDO
update public.sst_inspections s
set encarregado_employee_id = 'cd0eaccd-9eea-4c62-a0dc-73755343b628'::uuid
where s.encarregado_employee_id is null
  and regexp_replace(
    upper(translate(trim(split_part(s.encarregado_obra,'/',1)),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = 'GIVANILDO';

commit;

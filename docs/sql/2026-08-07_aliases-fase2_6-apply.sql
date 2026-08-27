-- Fase 2.6 APPLY (executado)
-- Objetivo: reduzir pendências remanescentes com decisão dirigida e evidência histórica no mesmo campo.

begin;

-- 1) aliases adicionados/atualizados
with seed(alias_text,target_employee_id) as (
  values
    ('PLINIO', 'c662e0b0-adfb-4282-9f0e-f0290e44e24d'::uuid),      -- PLINIO MOREIRA
    ('JOSENILDO', 'b6241b67-6b42-4cc3-93a7-9804c3a10318'::uuid),   -- JOSENILDO DA SILVA RAMOS
    ('ALAN', '8895d02d-a770-482d-bfd7-6966093b0677'::uuid)         -- ALAN DIAS DA SILVA
), ready as (
  select
    e.company_id,
    s.alias_text,
    regexp_replace(
      upper(translate(trim(s.alias_text),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as alias_norm,
    s.target_employee_id as employee_id
  from seed s
  join public.employees e on e.id = s.target_employee_id
)
insert into public.employee_name_aliases(company_id, alias_text, alias_norm, employee_id, created_by)
select company_id, alias_text, alias_norm, employee_id, 'hermes-fase2_6'
from ready
on conflict (company_id, alias_norm)
do update set
  alias_text = excluded.alias_text,
  employee_id = excluded.employee_id,
  created_by = excluded.created_by;

-- 2) APPLY por alvo

-- SST administrativo: PLINIO -> PLINIO MOREIRA
update public.sst_inspections t
set administrativo_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.administrativo_employee_id is null
  and coalesce(trim(t.administrativo),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.administrativo),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and a.alias_norm = 'PLINIO';

-- SST encarregado: JOSENILDO -> JOSENILDO DA SILVA RAMOS
update public.sst_inspections t
set encarregado_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.encarregado_employee_id is null
  and coalesce(trim(t.encarregado_obra),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.encarregado_obra),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and a.alias_norm = 'JOSENILDO';

-- SST técnico: ALAN -> ALAN DIAS DA SILVA
update public.sst_inspections t
set tecnico_responsavel_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.tecnico_responsavel_employee_id is null
  and coalesce(trim(t.tecnico_responsavel),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.tecnico_responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and a.alias_norm = 'ALAN';

commit;

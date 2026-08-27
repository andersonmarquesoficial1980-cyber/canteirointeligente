-- Fase 2.4 APPLY (executado)
-- Objetivo: resolver apenas casos determinísticos remanescentes com alias explícito.

begin;

with seed(alias_text,target_employee_id) as (
  values
    ('ANDERSON MARQUES','8bbd39e9-77ca-457e-82ac-14082cd18d95'::uuid),
    ('ELCIO','dc30197c-e93e-46d0-b231-2940a4658ae2'::uuid)
),
ready as (
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
select company_id, alias_text, alias_norm, employee_id, 'hermes-fase2_4'
from ready
on conflict (company_id, alias_norm)
do update set
  alias_text = excluded.alias_text,
  employee_id = excluded.employee_id,
  created_by = excluded.created_by;

-- ci_programacoes.engenheiro_responsavel_employee_id
update public.ci_programacoes p
set engenheiro_responsavel_employee_id = a.employee_id
from public.employee_name_aliases a
where p.engenheiro_responsavel_employee_id is null
  and coalesce(trim(p.engenheiro_responsavel),'') <> ''
  and regexp_replace(
    upper(translate(trim(p.engenheiro_responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and a.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
  and a.alias_norm = 'ANDERSON MARQUES';

-- sst_inspections.engenheiro_employee_id (Elcio / Élcio)
update public.sst_inspections s
set engenheiro_employee_id = a.employee_id
from public.employee_name_aliases a
where s.engenheiro_employee_id is null
  and coalesce(trim(s.engenheiro_obra),'') <> ''
  and s.company_id = a.company_id
  and regexp_replace(
    upper(translate(trim(s.engenheiro_obra),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and a.alias_norm = 'ELCIO';

commit;

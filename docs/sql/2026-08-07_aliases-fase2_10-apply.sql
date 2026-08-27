-- Fase 2.10 APPLY (executado)
-- Objetivo: reduzir pendências de sst_inspections.engenheiro_employee_id
-- Regra segura: mapear por primeiro token SOMENTE quando o próprio histórico do campo
-- já aponta exatamente 1 employee_id para esse token.
-- Escopo aplicado nesta execução: tokens GABRIEL e ELCIO.

begin;

with mapped as (
  select
    regexp_replace(
      upper(translate(trim(split_part(engenheiro_obra,' ',1)),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9]','','g'
    ) as first_token,
    engenheiro_employee_id as employee_id
  from public.sst_inspections
  where engenheiro_employee_id is not null
    and coalesce(trim(engenheiro_obra),'') <> ''
),
token_map as (
  select
    first_token,
    (array_agg(employee_id order by employee_id))[1] as employee_id,
    count(distinct employee_id) as cand_count
  from mapped
  group by first_token
  having count(distinct employee_id) = 1
)
update public.sst_inspections t
set engenheiro_employee_id = tm.employee_id
from token_map tm
where t.engenheiro_employee_id is null
  and coalesce(trim(t.engenheiro_obra),'') <> ''
  and regexp_replace(
    upper(translate(trim(split_part(t.engenheiro_obra,' ',1)),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9]','','g'
  ) = tm.first_token
  and tm.first_token in ('GABRIEL','ELCIO');

commit;

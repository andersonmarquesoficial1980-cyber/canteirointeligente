-- Fase 2.5 — Template de APPLY manual por decisão explícita
-- Uso: preencher a CTE decisions com (target, alias_text, employee_id escolhido)
-- Segurança: atualiza SOMENTE colunas *_employee_id NULL + match por alias_norm.

begin;

-- 1) registrar/atualizar aliases decididos
with decisions(target, alias_text, employee_id) as (
  values
    -- EXEMPLOS (trocar/remover conforme decisão de negócio):
    -- ('rdo_diarios.responsavel_employee_id', 'FRANCISCO ALVES', '64dfae75-eead-42ba-9201-4ba0d52bbd02'::uuid),
    -- ('rdo_diarios.encarregado_employee_id', 'FRANCISCO ALVES', '64dfae75-eead-42ba-9201-4ba0d52bbd02'::uuid),
    -- ('sst_inspections.administrativo_employee_id', 'PLINIO', 'c662e0b0-adfb-4282-9f0e-f0290e44e24d'::uuid),
    -- ('sst_inspections.encarregado_employee_id', 'JOSENILDO', 'b6241b67-6b42-4cc3-93a7-9804c3a10318'::uuid),
    -- ('sst_inspections.engenheiro_employee_id', 'GABRIEL', '65761fac-fac4-4664-b6a4-c3ed18d8ff3b'::uuid),
    -- ('sst_inspections.tecnico_responsavel_employee_id', 'ALAN', '8895d02d-a770-482d-bfd7-6966093b0677'::uuid)
    ('__NOOP__', '__NOOP__', '00000000-0000-0000-0000-000000000000'::uuid)
),
ready as (
  select
    e.company_id,
    d.target,
    d.alias_text,
    regexp_replace(
      upper(translate(trim(d.alias_text),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as alias_norm,
    d.employee_id
  from decisions d
  join public.employees e on e.id = d.employee_id
  where d.target <> '__NOOP__'
)
insert into public.employee_name_aliases(company_id, alias_text, alias_norm, employee_id, created_by)
select company_id, alias_text, alias_norm, employee_id, 'hermes-fase2_5-manual'
from ready
on conflict (company_id, alias_norm)
do update set
  alias_text = excluded.alias_text,
  employee_id = excluded.employee_id,
  created_by = excluded.created_by;

-- 2) apply por target

-- rdo_diarios.responsavel_employee_id
update public.rdo_diarios t
set responsavel_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.responsavel_employee_id is null
  and coalesce(trim(t.responsavel),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and exists (
    select 1 from ready r
    where r.target = 'rdo_diarios.responsavel_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

-- rdo_diarios.encarregado_employee_id
update public.rdo_diarios t
set encarregado_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.encarregado_employee_id is null
  and coalesce(trim(t.encarregado),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.encarregado),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and exists (
    select 1 from ready r
    where r.target = 'rdo_diarios.encarregado_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

-- sst_inspections.administrativo_employee_id
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
  and exists (
    select 1 from ready r
    where r.target = 'sst_inspections.administrativo_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

-- sst_inspections.encarregado_employee_id
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
  and exists (
    select 1 from ready r
    where r.target = 'sst_inspections.encarregado_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

-- sst_inspections.engenheiro_employee_id
update public.sst_inspections t
set engenheiro_employee_id = a.employee_id
from public.employee_name_aliases a
where t.company_id = a.company_id
  and t.engenheiro_employee_id is null
  and coalesce(trim(t.engenheiro_obra),'') <> ''
  and regexp_replace(
    upper(translate(trim(t.engenheiro_obra),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^A-Z0-9 ]','','g'
  ) = a.alias_norm
  and exists (
    select 1 from ready r
    where r.target = 'sst_inspections.engenheiro_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

-- sst_inspections.tecnico_responsavel_employee_id
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
  and exists (
    select 1 from ready r
    where r.target = 'sst_inspections.tecnico_responsavel_employee_id'
      and r.company_id = a.company_id
      and r.alias_norm = a.alias_norm
  );

commit;

-- Pós-execução: rodar relatório de pendências por target.

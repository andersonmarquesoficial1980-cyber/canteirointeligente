-- Fase 2.2 PREVIEW (read-only)
-- Objetivo: estimar ganhos com aliases explícitos sem executar UPDATE.

with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select
    e.id as employee_id,
    e.company_id,
    trim(e.name) as employee_name,
    regexp_replace(
      upper(translate(trim(e.name),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as employee_norm
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
alias_mapped as (
  select
    c.company_id,
    s.alias_text,
    regexp_replace(
      upper(translate(trim(s.alias_text),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
    ) as alias_norm,
    e.employee_id,
    e.employee_name
  from alias_seed s
  join cfg c on true
  join emp e
    on e.company_id = c.company_id
   and e.employee_name = s.target_employee_name
),

employees_preview as (
  select count(*) as qtd
  from public.employees t
  join alias_mapped a on a.company_id = t.company_id
   and regexp_replace(
      upper(translate(trim(t.responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
   ) = a.alias_norm
  where coalesce(trim(t.responsavel),'') <> ''
    and t.responsavel_employee_id is null
),

sst_enc_preview as (
  select count(*) as qtd
  from public.sst_inspections t
  join alias_mapped a on a.company_id = t.company_id
   and regexp_replace(
      upper(translate(trim(t.encarregado_obra),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
   ) = a.alias_norm
  where coalesce(trim(t.encarregado_obra),'') <> ''
    and t.encarregado_employee_id is null
),

sst_tec_preview as (
  select count(*) as qtd
  from public.sst_inspections t
  join alias_mapped a on a.company_id = t.company_id
   and regexp_replace(
      upper(translate(trim(t.tecnico_responsavel),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
   ) = a.alias_norm
  where coalesce(trim(t.tecnico_responsavel),'') <> ''
    and t.tecnico_responsavel_employee_id is null
),

sst_adm_preview as (
  select count(*) as qtd
  from public.sst_inspections t
  join alias_mapped a on a.company_id = t.company_id
   and regexp_replace(
      upper(translate(trim(t.administrativo),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^A-Z0-9 ]','','g'
   ) = a.alias_norm
  where coalesce(trim(t.administrativo),'') <> ''
    and t.administrativo_employee_id is null
)

select * from (
  select 'employees.responsavel_employee_id' as target, (select qtd from employees_preview) as atualizaveis
  union all
  select 'sst_inspections.encarregado_employee_id', (select qtd from sst_enc_preview)
  union all
  select 'sst_inspections.tecnico_responsavel_employee_id', (select qtd from sst_tec_preview)
  union all
  select 'sst_inspections.administrativo_employee_id', (select qtd from sst_adm_preview)
) x
order by target;

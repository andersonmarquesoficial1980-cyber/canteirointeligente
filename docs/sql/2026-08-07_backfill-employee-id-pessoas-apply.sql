-- Backfill APPLY (executável) — NÃO RODAR SEM AUTORIZAÇÃO EXPLÍCITA
-- Regras:
-- 1) Só preenche colunas *_employee_id atualmente NULL
-- 2) Só quando houver MATCH ÚNICO por nome normalizado
-- 3) Sem alterar campos textuais legados nesta etapa
-- 4) Escopo de companhia: a1b2c3d4-e5f6-7890-abcd-ef1234567890

begin;

-- =====================================================
-- Config
-- =====================================================
with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
)
select company_id from cfg;

-- =====================================================
-- 1) ci_equipes.responsavel_employee_id
-- =====================================================
with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select id as employee_id, lower(trim(name)) as name_norm
  from public.employees e
  join cfg c on e.company_id = c.company_id
  where e.status = 'ativo'
),
src as (
  select q.id as row_id, lower(trim(q.responsavel)) as name_norm
  from public.ci_equipes q
  where coalesce(trim(q.responsavel), '') <> ''
    and q.responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.ci_equipes q
  set responsavel_employee_id = u.employee_id
  from unique_map u
  where q.id = u.row_id
    and q.responsavel_employee_id is null
  returning q.id
)
select 'ci_equipes' as tabela, count(*) as updated_rows from upd;

-- =====================================================
-- 2) employees.responsavel_employee_id
-- =====================================================
with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select f.id as row_id, f.company_id, lower(trim(f.responsavel)) as name_norm
  from public.employees f
  where coalesce(trim(f.responsavel), '') <> ''
    and f.responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e
    on e.company_id = s.company_id
   and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.employees f
  set responsavel_employee_id = u.employee_id
  from unique_map u
  where f.id = u.row_id
    and f.responsavel_employee_id is null
  returning f.id
)
select 'employees' as tabela, count(*) as updated_rows from upd;

-- =====================================================
-- 3) rdo_diarios.*_employee_id
-- =====================================================
with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select r.id as row_id, r.company_id, lower(trim(r.encarregado)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.encarregado), '') <> ''
    and r.encarregado_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e
    on e.company_id = s.company_id
   and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.rdo_diarios r
  set encarregado_employee_id = u.employee_id
  from unique_map u
  where r.id = u.row_id
    and r.encarregado_employee_id is null
  returning r.id
)
select 'rdo_diarios.encarregado_employee_id' as target, count(*) as updated_rows from upd;

with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select r.id as row_id, r.company_id, lower(trim(r.responsavel)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.responsavel), '') <> ''
    and r.responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e
    on e.company_id = s.company_id
   and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.rdo_diarios r
  set responsavel_employee_id = u.employee_id
  from unique_map u
  where r.id = u.row_id
    and r.responsavel_employee_id is null
  returning r.id
)
select 'rdo_diarios.responsavel_employee_id' as target, count(*) as updated_rows from upd;

with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select r.id as row_id, r.company_id, lower(trim(r.engenheiro_responsavel)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.engenheiro_responsavel), '') <> ''
    and r.engenheiro_responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e
    on e.company_id = s.company_id
   and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.rdo_diarios r
  set engenheiro_responsavel_employee_id = u.employee_id
  from unique_map u
  where r.id = u.row_id
    and r.engenheiro_responsavel_employee_id is null
  returning r.id
)
select 'rdo_diarios.engenheiro_responsavel_employee_id' as target, count(*) as updated_rows from upd;

-- =====================================================
-- 4) ci_programacoes.*_employee_id
-- =====================================================
with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select id as employee_id, lower(trim(name)) as name_norm
  from public.employees e
  join cfg c on e.company_id = c.company_id
  where e.status = 'ativo'
),
src as (
  select p.id as row_id, lower(trim(p.responsavel)) as name_norm
  from public.ci_programacoes p
  where coalesce(trim(p.responsavel), '') <> ''
    and p.responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.ci_programacoes p
  set responsavel_employee_id = u.employee_id
  from unique_map u
  where p.id = u.row_id
    and p.responsavel_employee_id is null
  returning p.id
)
select 'ci_programacoes.responsavel_employee_id' as target, count(*) as updated_rows from upd;

with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select id as employee_id, lower(trim(name)) as name_norm
  from public.employees e
  join cfg c on e.company_id = c.company_id
  where e.status = 'ativo'
),
src as (
  select p.id as row_id, lower(trim(p.engenheiro_responsavel)) as name_norm
  from public.ci_programacoes p
  where coalesce(trim(p.engenheiro_responsavel), '') <> ''
    and p.engenheiro_responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.ci_programacoes p
  set engenheiro_responsavel_employee_id = u.employee_id
  from unique_map u
  where p.id = u.row_id
    and p.engenheiro_responsavel_employee_id is null
  returning p.id
)
select 'ci_programacoes.engenheiro_responsavel_employee_id' as target, count(*) as updated_rows from upd;

-- =====================================================
-- 5) sst_inspections.*_employee_id
-- =====================================================
with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select s.id as row_id, s.company_id, lower(trim(s.encarregado_obra)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.encarregado_obra), '') <> ''
    and s.encarregado_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.sst_inspections s
  set encarregado_employee_id = u.employee_id
  from unique_map u
  where s.id = u.row_id
    and s.encarregado_employee_id is null
  returning s.id
)
select 'sst_inspections.encarregado_employee_id' as target, count(*) as updated_rows from upd;

with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select s.id as row_id, s.company_id, lower(trim(s.engenheiro_obra)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.engenheiro_obra), '') <> ''
    and s.engenheiro_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.sst_inspections s
  set engenheiro_employee_id = u.employee_id
  from unique_map u
  where s.id = u.row_id
    and s.engenheiro_employee_id is null
  returning s.id
)
select 'sst_inspections.engenheiro_employee_id' as target, count(*) as updated_rows from upd;

with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select s.id as row_id, s.company_id, lower(trim(s.tecnico_responsavel)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.tecnico_responsavel), '') <> ''
    and s.tecnico_responsavel_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.sst_inspections s
  set tecnico_responsavel_employee_id = u.employee_id
  from unique_map u
  where s.id = u.row_id
    and s.tecnico_responsavel_employee_id is null
  returning s.id
)
select 'sst_inspections.tecnico_responsavel_employee_id' as target, count(*) as updated_rows from upd;

with emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),
src as (
  select s.id as row_id, s.company_id, lower(trim(s.administrativo)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.administrativo), '') <> ''
    and s.administrativo_employee_id is null
),
unique_map as (
  select s.row_id, (array_agg(e.employee_id order by e.employee_id))[1] as employee_id
  from src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
  group by s.row_id
  having count(*) = 1
),
upd as (
  update public.sst_inspections s
  set administrativo_employee_id = u.employee_id
  from unique_map u
  where s.id = u.row_id
    and s.administrativo_employee_id is null
  returning s.id
)
select 'sst_inspections.administrativo_employee_id' as target, count(*) as updated_rows from upd;

commit;

-- Pós-execução recomendada:
-- 1) Rodar preview para confirmar cobertura residual
-- 2) Gerar pendências sem match para saneamento manual
-- 3) Só depois validar FKs (VALIDATE CONSTRAINT)

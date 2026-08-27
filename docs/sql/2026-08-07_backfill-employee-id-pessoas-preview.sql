-- Backfill PREVIEW (read-only)
-- Objetivo: medir cobertura de preenchimento das colunas *_employee_id sem executar UPDATE.
-- Escopo de companhia (ajuste se necessário):
with cfg as (
  select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid as company_id
),
emp as (
  select id as employee_id, company_id, lower(trim(name)) as name_norm
  from public.employees
  where status = 'ativo'
),

-- 1) ci_equipes.responsavel -> responsavel_employee_id
ci_equipes_src as (
  select q.id as row_id, lower(trim(q.responsavel)) as name_norm
  from public.ci_equipes q
  where coalesce(trim(q.responsavel), '') <> ''
),
ci_equipes_candidates as (
  select s.row_id, e.employee_id
  from ci_equipes_src s
  join emp e on e.name_norm = s.name_norm
  join cfg c on e.company_id = c.company_id
),
ci_equipes_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from ci_equipes_candidates
  group by row_id
  having count(*) = 1
),

-- 2) employees.responsavel -> responsavel_employee_id (self FK)
employees_src as (
  select f.id as row_id, f.company_id, lower(trim(f.responsavel)) as name_norm
  from public.employees f
  where coalesce(trim(f.responsavel), '') <> ''
),
employees_candidates as (
  select s.row_id, e.employee_id
  from employees_src s
  join emp e
    on e.company_id = s.company_id
   and e.name_norm = s.name_norm
),
employees_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from employees_candidates
  group by row_id
  having count(*) = 1
),

-- 3) rdo_diarios (encarregado/responsavel/engenheiro_responsavel)
rdo_enc_src as (
  select r.id as row_id, r.company_id, lower(trim(r.encarregado)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.encarregado), '') <> ''
),
rdo_enc_candidates as (
  select s.row_id, e.employee_id
  from rdo_enc_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
rdo_enc_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from rdo_enc_candidates
  group by row_id
  having count(*) = 1
),

rdo_resp_src as (
  select r.id as row_id, r.company_id, lower(trim(r.responsavel)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.responsavel), '') <> ''
),
rdo_resp_candidates as (
  select s.row_id, e.employee_id
  from rdo_resp_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
rdo_resp_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from rdo_resp_candidates
  group by row_id
  having count(*) = 1
),

rdo_eng_src as (
  select r.id as row_id, r.company_id, lower(trim(r.engenheiro_responsavel)) as name_norm
  from public.rdo_diarios r
  where coalesce(trim(r.engenheiro_responsavel), '') <> ''
),
rdo_eng_candidates as (
  select s.row_id, e.employee_id
  from rdo_eng_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
rdo_eng_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from rdo_eng_candidates
  group by row_id
  having count(*) = 1
),

-- 4) ci_programacoes (sem company_id na tabela -> forçar cfg.company_id)
prog_resp_src as (
  select p.id as row_id, lower(trim(p.responsavel)) as name_norm
  from public.ci_programacoes p
  where coalesce(trim(p.responsavel), '') <> ''
),
prog_resp_candidates as (
  select s.row_id, e.employee_id
  from prog_resp_src s
  join emp e on e.name_norm = s.name_norm
  join cfg c on e.company_id = c.company_id
),
prog_resp_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from prog_resp_candidates
  group by row_id
  having count(*) = 1
),

prog_eng_src as (
  select p.id as row_id, lower(trim(p.engenheiro_responsavel)) as name_norm
  from public.ci_programacoes p
  where coalesce(trim(p.engenheiro_responsavel), '') <> ''
),
prog_eng_candidates as (
  select s.row_id, e.employee_id
  from prog_eng_src s
  join emp e on e.name_norm = s.name_norm
  join cfg c on e.company_id = c.company_id
),
prog_eng_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from prog_eng_candidates
  group by row_id
  having count(*) = 1
),

-- 5) sst_inspections
sst_enc_src as (
  select s.id as row_id, s.company_id, lower(trim(s.encarregado_obra)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.encarregado_obra), '') <> ''
),
sst_enc_candidates as (
  select s.row_id, e.employee_id
  from sst_enc_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
sst_enc_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from sst_enc_candidates
  group by row_id
  having count(*) = 1
),

sst_eng_src as (
  select s.id as row_id, s.company_id, lower(trim(s.engenheiro_obra)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.engenheiro_obra), '') <> ''
),
sst_eng_candidates as (
  select s.row_id, e.employee_id
  from sst_eng_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
sst_eng_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from sst_eng_candidates
  group by row_id
  having count(*) = 1
),

sst_tec_src as (
  select s.id as row_id, s.company_id, lower(trim(s.tecnico_responsavel)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.tecnico_responsavel), '') <> ''
),
sst_tec_candidates as (
  select s.row_id, e.employee_id
  from sst_tec_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
sst_tec_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from sst_tec_candidates
  group by row_id
  having count(*) = 1
),

sst_adm_src as (
  select s.id as row_id, s.company_id, lower(trim(s.administrativo)) as name_norm
  from public.sst_inspections s
  where coalesce(trim(s.administrativo), '') <> ''
),
sst_adm_candidates as (
  select s.row_id, e.employee_id
  from sst_adm_src s
  join emp e on e.company_id = s.company_id and e.name_norm = s.name_norm
),
sst_adm_unique as (
  select row_id, (array_agg(employee_id order by employee_id))[1] as employee_id
  from sst_adm_candidates
  group by row_id
  having count(*) = 1
)

select *
from (
  select 'ci_equipes.responsavel_employee_id' as target,
         (select count(*) from ci_equipes_src) as registros_com_texto,
         (select count(*) from ci_equipes_unique) as match_unico_preenchivel
  union all
  select 'employees.responsavel_employee_id',
         (select count(*) from employees_src),
         (select count(*) from employees_unique)
  union all
  select 'rdo_diarios.encarregado_employee_id',
         (select count(*) from rdo_enc_src),
         (select count(*) from rdo_enc_unique)
  union all
  select 'rdo_diarios.responsavel_employee_id',
         (select count(*) from rdo_resp_src),
         (select count(*) from rdo_resp_unique)
  union all
  select 'rdo_diarios.engenheiro_responsavel_employee_id',
         (select count(*) from rdo_eng_src),
         (select count(*) from rdo_eng_unique)
  union all
  select 'ci_programacoes.responsavel_employee_id',
         (select count(*) from prog_resp_src),
         (select count(*) from prog_resp_unique)
  union all
  select 'ci_programacoes.engenheiro_responsavel_employee_id',
         (select count(*) from prog_eng_src),
         (select count(*) from prog_eng_unique)
  union all
  select 'sst_inspections.encarregado_employee_id',
         (select count(*) from sst_enc_src),
         (select count(*) from sst_enc_unique)
  union all
  select 'sst_inspections.engenheiro_employee_id',
         (select count(*) from sst_eng_src),
         (select count(*) from sst_eng_unique)
  union all
  select 'sst_inspections.tecnico_responsavel_employee_id',
         (select count(*) from sst_tec_src),
         (select count(*) from sst_tec_unique)
  union all
  select 'sst_inspections.administrativo_employee_id',
         (select count(*) from sst_adm_src),
         (select count(*) from sst_adm_unique)
) t
order by target;

-- Extras úteis (rodar separados):
-- 1) Sem match ci_equipes
-- with cfg as (select 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid company_id),
-- emp as (select company_id, lower(trim(name)) n from public.employees where status='ativo')
-- select distinct q.responsavel
-- from public.ci_equipes q
-- where coalesce(trim(q.responsavel),'')<>''
--   and lower(trim(q.responsavel)) not in (
--     select n from emp e join cfg c on e.company_id=c.company_id
--   )
-- order by 1;

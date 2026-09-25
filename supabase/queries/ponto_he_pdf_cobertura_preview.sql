-- Read-only: cobertura da competência para fechamento do Banco de Horas via PDF
-- Substituir placeholders antes de executar
-- <COMPANY_ID> uuid
-- <COMPETENCIA> date (YYYY-MM-01)

-- 1) Cobertura geral (ativos x resumo)
with ativos as (
  select e.id, e.name, e.matricula, e.equipe
  from public.employees e
  where e.company_id = '<COMPANY_ID>'::uuid
    and coalesce(e.status,'ativo') = 'ativo'
), resumo as (
  select r.employee_id
  from public.ponto_he_resumo_mensal r
  where r.company_id = '<COMPANY_ID>'::uuid
    and r.competencia = '<COMPETENCIA>'::date
)
select
  (select count(*) from ativos) as total_ativos,
  (select count(distinct employee_id) from resumo where employee_id is not null) as total_no_resumo,
  (select count(*) from ativos a left join resumo r on r.employee_id = a.id where r.employee_id is null) as ativos_sem_resumo;

-- 2) Lista nominal de pendências
with ativos as (
  select e.id, e.name, e.matricula, e.equipe
  from public.employees e
  where e.company_id = '<COMPANY_ID>'::uuid
    and coalesce(e.status,'ativo') = 'ativo'
)
select
  a.name as colaborador,
  a.matricula,
  a.equipe
from ativos a
left join public.ponto_he_resumo_mensal r
  on r.company_id = '<COMPANY_ID>'::uuid
 and r.competencia = '<COMPETENCIA>'::date
 and r.employee_id = a.id
where r.id is null
order by a.equipe nulls last, a.name;

-- 3) Últimos jobs de importação PDF
select
  j.id,
  j.competencia,
  j.equipe_nome,
  j.status,
  j.created_at,
  j.applied_at,
  j.metadata
from public.ponto_he_import_jobs j
where j.company_id = '<COMPANY_ID>'::uuid
  and j.competencia = '<COMPETENCIA>'::date
order by j.created_at desc
limit 20;

-- 4) Pré-check por job (vínculos pendentes)
select
  c.job_id,
  count(*) as total_colaboradores,
  count(*) filter (where c.employee_id is not null) as mapeados,
  count(*) filter (where c.employee_id is null) as nao_mapeados
from public.ponto_he_import_colaboradores c
where c.company_id = '<COMPANY_ID>'::uuid
group by c.job_id
order by max(c.created_at) desc;

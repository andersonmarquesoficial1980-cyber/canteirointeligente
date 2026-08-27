-- Fase 2 — Diagnóstico de Backfill para colunas *_employee_id
-- Objetivo: somente leitura (read-only), sem UPDATE/INSERT/DELETE.
-- Uso sugerido:
--   npx supabase db query --linked "<cole aqui um bloco por vez>"

-- =====================================================
-- Bloco A: visão geral de qualidade por tabela/campo texto
-- =====================================================

with emp as (
  select company_id, lower(trim(name)) as nome_norm
  from public.employees
  where status = 'ativo'
),
base as (
  select 'ci_equipes'::text as tabela, 'responsavel'::text as campo, company_id, trim(responsavel) as valor
  from public.ci_equipes
  where coalesce(trim(responsavel),'') <> ''

  union all

  select 'employees', 'responsavel', company_id, trim(responsavel)
  from public.employees
  where coalesce(trim(responsavel),'') <> ''

  union all

  select 'rdo_diarios', 'encarregado', company_id, trim(encarregado)
  from public.rdo_diarios
  where coalesce(trim(encarregado),'') <> ''

  union all

  select 'rdo_diarios', 'responsavel', company_id, trim(responsavel)
  from public.rdo_diarios
  where coalesce(trim(responsavel),'') <> ''

  union all

  select 'rdo_diarios', 'engenheiro_responsavel', company_id, trim(engenheiro_responsavel)
  from public.rdo_diarios
  where coalesce(trim(engenheiro_responsavel),'') <> ''

  union all

  select 'ci_programacoes', 'responsavel', null::uuid as company_id, trim(responsavel)
  from public.ci_programacoes
  where coalesce(trim(responsavel),'') <> ''

  union all

  select 'ci_programacoes', 'engenheiro_responsavel', null::uuid as company_id, trim(engenheiro_responsavel)
  from public.ci_programacoes
  where coalesce(trim(engenheiro_responsavel),'') <> ''

  union all

  select 'sst_inspections', 'encarregado_obra', company_id, trim(encarregado_obra)
  from public.sst_inspections
  where coalesce(trim(encarregado_obra),'') <> ''

  union all

  select 'sst_inspections', 'engenheiro_obra', company_id, trim(engenheiro_obra)
  from public.sst_inspections
  where coalesce(trim(engenheiro_obra),'') <> ''

  union all

  select 'sst_inspections', 'tecnico_responsavel', company_id, trim(tecnico_responsavel)
  from public.sst_inspections
  where coalesce(trim(tecnico_responsavel),'') <> ''

  union all

  select 'sst_inspections', 'administrativo', company_id, trim(administrativo)
  from public.sst_inspections
  where coalesce(trim(administrativo),'') <> ''
),
distintos as (
  select distinct tabela, campo, company_id, valor, lower(valor) as valor_norm
  from base
),
matchs as (
  select
    d.tabela,
    d.campo,
    d.company_id,
    d.valor,
    count(*) filter (
      where
        (d.company_id is not null and e.company_id = d.company_id and e.nome_norm = d.valor_norm)
        or
        (d.company_id is null and e.nome_norm = d.valor_norm)
    ) as qtd_match
  from distintos d
  left join emp e on (
    (d.company_id is not null and e.company_id = d.company_id and e.nome_norm = d.valor_norm)
    or
    (d.company_id is null and e.nome_norm = d.valor_norm)
  )
  group by d.tabela, d.campo, d.company_id, d.valor
)
select
  tabela,
  campo,
  count(*) as valores_distintos,
  count(*) filter (where qtd_match = 1) as match_unico,
  count(*) filter (where qtd_match > 1) as match_multiplo,
  count(*) filter (where qtd_match = 0) as sem_match
from matchs
group by tabela, campo
order by tabela, campo;


-- =====================================================
-- Bloco B: pendências sem match (top 200)
-- =====================================================

with emp as (
  select company_id, lower(trim(name)) as nome_norm
  from public.employees
  where status = 'ativo'
),
base as (
  select 'ci_equipes'::text as tabela, 'responsavel'::text as campo, company_id, trim(responsavel) as valor
  from public.ci_equipes
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'employees', 'responsavel', company_id, trim(responsavel)
  from public.employees
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'rdo_diarios', 'encarregado', company_id, trim(encarregado)
  from public.rdo_diarios
  where coalesce(trim(encarregado),'') <> ''

  union all
  select 'rdo_diarios', 'responsavel', company_id, trim(responsavel)
  from public.rdo_diarios
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'rdo_diarios', 'engenheiro_responsavel', company_id, trim(engenheiro_responsavel)
  from public.rdo_diarios
  where coalesce(trim(engenheiro_responsavel),'') <> ''

  union all
  select 'sst_inspections', 'encarregado_obra', company_id, trim(encarregado_obra)
  from public.sst_inspections
  where coalesce(trim(encarregado_obra),'') <> ''

  union all
  select 'sst_inspections', 'engenheiro_obra', company_id, trim(engenheiro_obra)
  from public.sst_inspections
  where coalesce(trim(engenheiro_obra),'') <> ''

  union all
  select 'sst_inspections', 'tecnico_responsavel', company_id, trim(tecnico_responsavel)
  from public.sst_inspections
  where coalesce(trim(tecnico_responsavel),'') <> ''

  union all
  select 'sst_inspections', 'administrativo', company_id, trim(administrativo)
  from public.sst_inspections
  where coalesce(trim(administrativo),'') <> ''
),
distintos as (
  select distinct tabela, campo, company_id, valor, lower(valor) as valor_norm
  from base
),
matchs as (
  select
    d.tabela,
    d.campo,
    d.company_id,
    d.valor,
    count(*) filter (
      where
        (d.company_id is not null and e.company_id = d.company_id and e.nome_norm = d.valor_norm)
        or
        (d.company_id is null and e.nome_norm = d.valor_norm)
    ) as qtd_match
  from distintos d
  left join emp e on (
    (d.company_id is not null and e.company_id = d.company_id and e.nome_norm = d.valor_norm)
    or
    (d.company_id is null and e.nome_norm = d.valor_norm)
  )
  group by d.tabela, d.campo, d.company_id, d.valor
)
select tabela, campo, company_id, valor
from matchs
where qtd_match = 0
order by tabela, campo, valor
limit 200;


-- =====================================================
-- Bloco C: conflito de homônimos (match múltiplo)
-- =====================================================

with emp as (
  select company_id, id as employee_id, trim(name) as employee_name, lower(trim(name)) as nome_norm
  from public.employees
  where status = 'ativo'
),
base as (
  select 'ci_equipes'::text as tabela, 'responsavel'::text as campo, id::text as row_id, company_id, trim(responsavel) as valor
  from public.ci_equipes
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'employees', 'responsavel', id::text as row_id, company_id, trim(responsavel)
  from public.employees
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'rdo_diarios', 'encarregado', id::text as row_id, company_id, trim(encarregado)
  from public.rdo_diarios
  where coalesce(trim(encarregado),'') <> ''

  union all
  select 'rdo_diarios', 'responsavel', id::text as row_id, company_id, trim(responsavel)
  from public.rdo_diarios
  where coalesce(trim(responsavel),'') <> ''

  union all
  select 'rdo_diarios', 'engenheiro_responsavel', id::text as row_id, company_id, trim(engenheiro_responsavel)
  from public.rdo_diarios
  where coalesce(trim(engenheiro_responsavel),'') <> ''
),
cand as (
  select
    b.tabela,
    b.campo,
    b.row_id,
    b.company_id,
    b.valor,
    e.employee_id,
    e.employee_name,
    count(*) over (partition by b.tabela, b.campo, b.row_id) as qtd_candidatos
  from base b
  join emp e
    on e.company_id = b.company_id
   and e.nome_norm = lower(b.valor)
)
select tabela, campo, row_id, company_id, valor, employee_id, employee_name, qtd_candidatos
from cand
where qtd_candidatos > 1
order by tabela, campo, valor, employee_name
limit 200;


-- =====================================================
-- Bloco D: preview de backfill (sem executar)
-- =====================================================
-- Este bloco apenas mostra a proposta de preenchimento para match único.

with emp as (
  select company_id, id as employee_id, lower(trim(name)) as nome_norm
  from public.employees
  where status = 'ativo'
),
source_rows as (
  select id, company_id, trim(responsavel) as valor
  from public.ci_equipes
  where coalesce(trim(responsavel),'') <> ''
),
cand as (
  select s.id as row_id, e.employee_id
  from source_rows s
  join emp e
    on e.company_id = s.company_id
   and e.nome_norm = lower(s.valor)
),
unique_map as (
  select row_id, min(employee_id) as employee_id
  from cand
  group by row_id
  having count(*) = 1
)
select
  q.id,
  q.nome,
  q.responsavel,
  u.employee_id as responsavel_employee_id_sugerido
from public.ci_equipes q
left join unique_map u on u.row_id = q.id
order by q.nome;

-- Para executar backfill de verdade, criar script separado com lote + WHERE estrito
-- e rodar somente após autorização explícita.

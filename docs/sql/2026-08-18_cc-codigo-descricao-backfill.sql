-- Workflux RH - Centro de Custo (código + descrição)
-- Escopo: adicionar campos estruturados e backfill seguro (não destrutivo)

-- 1) Novas colunas
alter table if exists public.ci_centros_custo
  add column if not exists codigo text;

alter table if exists public.employees
  add column if not exists centro_custo_codigo text,
  add column if not exists centro_custo_descricao text;

-- 2) Mapa oficial da planilha (code -> descrição)
with mapa(codigo, nome) as (
  values
    ('199',  'FACILITIES'),
    ('202',  'FINANCEIRO'),
    ('203',  'CONTABILIDADE'),
    ('204',  'TI / INFORMATICA'),
    ('206',  'RH / GESTAO DE PESSOAS'),
    ('210',  'JURÍDICO'),
    ('212',  'QSMS / EHS'),
    ('213',  'STAFF'),
    ('300',  'OPERACIONAL DE OBRAS'),
    ('302',  'MANUTENÇÃO / FROTA'),
    ('303',  'SUPRIMENTOS'),
    ('304',  'COMERCIAL'),
    ('312',  'TRANSPORTE E LOGÍSTICA'),
    ('317',  'PROJETO ASFALTO FRIO'),
    ('318',  'CENTRAL DE ABASTECIMENTO'),
    ('2339', 'COPASA  PV'),
    ('2525', 'CONS REQUALIFICAÇÃO INTEGRADA'),
    ('2529', 'GRU - AIRPORT'),
    ('2539', 'MOTIVA RODOVIAS')
),
cc_norm as (
  select
    c.id,
    c.nome,
    upper(regexp_replace(translate(c.nome,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    ), '\\s+', ' ', 'g')) as nome_norm
  from public.ci_centros_custo c
),
map_norm as (
  select
    m.codigo,
    m.nome,
    upper(regexp_replace(translate(m.nome,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    ), '\\s+', ' ', 'g')) as nome_norm
  from mapa m
)
update public.ci_centros_custo c
set codigo = m.codigo
from cc_norm cn
join map_norm m on m.nome_norm = cn.nome_norm
where c.id = cn.id
  and coalesce(c.codigo, '') <> m.codigo;

-- 3) Backfill em employees a partir do cadastro mestre
with cc as (
  select
    nome,
    codigo,
    upper(regexp_replace(translate(nome,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    ), '\\s+', ' ', 'g')) as nome_norm
  from public.ci_centros_custo
  where ativo = true and codigo is not null and trim(codigo) <> ''
)
update public.employees e
set
  centro_custo = cc.nome,
  centro_custo_descricao = cc.nome,
  centro_custo_codigo = cc.codigo
from cc
where upper(regexp_replace(translate(coalesce(e.centro_custo, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    ), '\\s+', ' ', 'g')) = cc.nome_norm
  and (
    coalesce(e.centro_custo_descricao, '') <> cc.nome
    or coalesce(e.centro_custo_codigo, '') <> cc.codigo
    or coalesce(e.centro_custo, '') <> cc.nome
  );

-- 4) Índice auxiliar para filtros/exports
create index if not exists idx_employees_company_cc_cod
  on public.employees (company_id, centro_custo_codigo);

-- 5) Verificação
select
  count(*) as total_cc,
  count(*) filter (where codigo is null or trim(codigo)='') as cc_sem_codigo
from public.ci_centros_custo;

select
  count(*) as total_employees,
  count(*) filter (where centro_custo_descricao is not null and trim(centro_custo_descricao) <> '') as com_cc_descricao,
  count(*) filter (where centro_custo_codigo is not null and trim(centro_custo_codigo) <> '') as com_cc_codigo
from public.employees
where company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

select
  centro_custo_codigo,
  centro_custo_descricao,
  count(*) as qtd
from public.employees
where company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
group by centro_custo_codigo, centro_custo_descricao
order by qtd desc, centro_custo_descricao;
-- Monitor diário de duplicidades RDO (read-only)
-- Uso:
--   npx supabase db query --linked --file supabase/queries/rdo_dedup_monitor_daily.sql

-- 1) Resumo por tabela
with
rdo_diarios_dup as (
  select
    'rdo_diarios'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_diarios
    group by
      coalesce(company_id::text, '__NULL__'),
      data,
      upper(trim(coalesce(obra_nome, ''))),
      upper(trim(coalesce(tipo_rdo, ''))),
      upper(trim(coalesce(preenchido_por, ''))),
      upper(trim(coalesce(turno, ''))),
      coalesce(user_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
rdo_nf_massa_dup as (
  select
    'rdo_nf_massa'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_nf_massa
    group by
      rdo_id,
      upper(trim(coalesce(nf, ''))),
      upper(trim(coalesce(placa, ''))),
      upper(trim(coalesce(usina, ''))),
      coalesce(tonelagem, -1),
      upper(trim(coalesce(tipo_material, ''))),
      coalesce(company_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
rdo_nf_concreto_dup as (
  select
    'rdo_nf_concreto'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_nf_concreto
    group by
      rdo_id,
      upper(trim(coalesce(nf, ''))),
      coalesce(quantidade_m3, -1),
      upper(trim(coalesce(tipo_concreto, ''))),
      upper(trim(coalesce(fornecedor, ''))),
      upper(trim(coalesce(foto_url, ''))),
      upper(trim(coalesce(equipamento, ''))),
      coalesce(company_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
rdo_equipamentos_dup as (
  select
    'rdo_equipamentos'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_equipamentos
    group by
      rdo_id,
      upper(trim(coalesce(frota, ''))),
      upper(trim(coalesce(categoria, ''))),
      upper(trim(coalesce(sub_tipo, ''))),
      upper(trim(coalesce(tipo, ''))),
      upper(trim(coalesce(nome, ''))),
      upper(trim(coalesce(patrimonio, ''))),
      upper(trim(coalesce(empresa_dona, ''))),
      coalesce(company_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
rdo_efetivo_dup as (
  select
    'rdo_efetivo'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_efetivo
    group by
      rdo_id,
      upper(trim(coalesce(funcao, ''))),
      coalesce(quantidade, -1),
      coalesce(entrada::text, ''),
      coalesce(saida::text, ''),
      upper(trim(coalesce(nome, ''))),
      upper(trim(coalesce(matricula, ''))),
      coalesce(employee_id::text, ''),
      coalesce(company_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
rdo_producao_dup as (
  select
    'rdo_producao'::text as tabela,
    count(*)::bigint as grupos,
    coalesce(sum(qtd - 1), 0)::bigint as excedentes
  from (
    select count(*) as qtd
    from public.rdo_producao
    group by
      rdo_id,
      upper(trim(coalesce(rodovia, ''))),
      coalesce(km_inicial, -1),
      coalesce(km_final, -1),
      upper(trim(coalesce(sentido, ''))),
      upper(trim(coalesce(faixa, ''))),
      upper(trim(coalesce(tipo_servico, ''))),
      coalesce(comprimento_m, -1),
      coalesce(largura_m, -1),
      coalesce(espessura_cm, -1),
      coalesce(area_m2, -1),
      coalesce(tonelagem, -1),
      upper(trim(coalesce(estaca_inicial, ''))),
      upper(trim(coalesce(estaca_final, ''))),
      upper(trim(coalesce(sentido_faixa, ''))),
      upper(trim(coalesce(observacoes, ''))),
      coalesce(densidade, -1),
      coalesce(volume_m3, -1),
      coalesce(is_retrabalho, false),
      coalesce(company_id::text, '__NULL__')
    having count(*) > 1
  ) x
),
all_dup as (
  select * from rdo_diarios_dup
  union all select * from rdo_nf_massa_dup
  union all select * from rdo_nf_concreto_dup
  union all select * from rdo_equipamentos_dup
  union all select * from rdo_efetivo_dup
  union all select * from rdo_producao_dup
)
select *
from all_dup
order by excedentes desc, grupos desc, tabela;

-- 2) Top 20 RDOs mais afetados (filhos)
with
all_child_dup as (
  select rdo_id, 'rdo_nf_massa'::text as tabela, count(*) as qtd
  from public.rdo_nf_massa
  group by rdo_id,
    upper(trim(coalesce(nf, ''))),
    upper(trim(coalesce(placa, ''))),
    upper(trim(coalesce(usina, ''))),
    coalesce(tonelagem, -1),
    upper(trim(coalesce(tipo_material, ''))),
    coalesce(company_id::text, '__NULL__')
  having count(*) > 1

  union all

  select rdo_id, 'rdo_nf_concreto'::text as tabela, count(*) as qtd
  from public.rdo_nf_concreto
  group by rdo_id,
    upper(trim(coalesce(nf, ''))),
    coalesce(quantidade_m3, -1),
    upper(trim(coalesce(tipo_concreto, ''))),
    upper(trim(coalesce(fornecedor, ''))),
    upper(trim(coalesce(foto_url, ''))),
    upper(trim(coalesce(equipamento, ''))),
    coalesce(company_id::text, '__NULL__')
  having count(*) > 1

  union all

  select rdo_id, 'rdo_equipamentos'::text as tabela, count(*) as qtd
  from public.rdo_equipamentos
  group by rdo_id,
    upper(trim(coalesce(frota, ''))),
    upper(trim(coalesce(categoria, ''))),
    upper(trim(coalesce(sub_tipo, ''))),
    upper(trim(coalesce(tipo, ''))),
    upper(trim(coalesce(nome, ''))),
    upper(trim(coalesce(patrimonio, ''))),
    upper(trim(coalesce(empresa_dona, ''))),
    coalesce(company_id::text, '__NULL__')
  having count(*) > 1

  union all

  select rdo_id, 'rdo_efetivo'::text as tabela, count(*) as qtd
  from public.rdo_efetivo
  group by rdo_id,
    upper(trim(coalesce(funcao, ''))),
    coalesce(quantidade, -1),
    coalesce(entrada::text, ''),
    coalesce(saida::text, ''),
    upper(trim(coalesce(nome, ''))),
    upper(trim(coalesce(matricula, ''))),
    coalesce(employee_id::text, ''),
    coalesce(company_id::text, '__NULL__')
  having count(*) > 1

  union all

  select rdo_id, 'rdo_producao'::text as tabela, count(*) as qtd
  from public.rdo_producao
  group by rdo_id,
    upper(trim(coalesce(rodovia, ''))),
    coalesce(km_inicial, -1),
    coalesce(km_final, -1),
    upper(trim(coalesce(sentido, ''))),
    upper(trim(coalesce(faixa, ''))),
    upper(trim(coalesce(tipo_servico, ''))),
    coalesce(comprimento_m, -1),
    coalesce(largura_m, -1),
    coalesce(espessura_cm, -1),
    coalesce(area_m2, -1),
    coalesce(tonelagem, -1),
    upper(trim(coalesce(estaca_inicial, ''))),
    upper(trim(coalesce(estaca_final, ''))),
    upper(trim(coalesce(sentido_faixa, ''))),
    upper(trim(coalesce(observacoes, ''))),
    coalesce(densidade, -1),
    coalesce(volume_m3, -1),
    coalesce(is_retrabalho, false),
    coalesce(company_id::text, '__NULL__')
  having count(*) > 1
),
agg as (
  select rdo_id,
         count(*) as grupos_duplicados,
         sum(qtd - 1) as excedentes
  from all_child_dup
  group by rdo_id
)
select
  d.data,
  d.obra_nome,
  d.tipo_rdo,
  d.preenchido_por,
  a.rdo_id,
  a.grupos_duplicados,
  a.excedentes
from agg a
join public.rdo_diarios d on d.id = a.rdo_id
order by a.excedentes desc, a.grupos_duplicados desc, d.data desc
limit 20;

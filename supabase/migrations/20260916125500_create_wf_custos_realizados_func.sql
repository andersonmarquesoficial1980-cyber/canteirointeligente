begin;

create or replace function public.wf_custos_realizados_por_ogs(p_company_id uuid, p_ogs text)
returns table (componente text, valor numeric)
language sql
stable
set search_path = public
as $$
with
comb as (
  select coalesce(sum(ar.valor_total), 0)::numeric as valor
  from public.abastecimento_registros ar
  where ar.company_id = p_company_id
    and exists (
      select 1
      from public.equipment_diaries ed
      where ed.company_id = ar.company_id
        and ed.equipamento_id = ar.maquina_id
        and ed.date = ar.data_abastecimento::date
        and ed.ogs_number = p_ogs
    )
),
sup as (
  select coalesce(sum(su.valor_total), 0)::numeric as valor
  from public.suprimentos_usos su
  join public.rdo_diarios rd
    on rd.id = su.rdo_id
   and rd.company_id = su.company_id
  join public.ogs_reference og
    on og.id = rd.ogs_id
   and og.company_id = rd.company_id
  where su.company_id = p_company_id
    and og.ogs_number = p_ogs
),
terc as (
  select coalesce(sum(tm.quantidade * coalesce(ts.valor_unitario, 0)), 0)::numeric as valor
  from public.terceiros_medicoes tm
  left join public.terceiros_servicos ts
    on ts.id = tm.servico_id
   and ts.empresa_id = tm.empresa_id
  join public.ogs_reference og
    on og.id = tm.obra_id
   and og.company_id = tm.company_id
  where tm.company_id = p_company_id
    and og.ogs_number = p_ogs
),
med as (
  with diario_counts as (
    select
      em.id as medicao_id,
      coalesce(em.valor_total, 0)::numeric as valor_total,
      count(ed.id)::numeric as dias_total,
      count(ed.id) filter (where ed.ogs_number = p_ogs)::numeric as dias_ogs
    from public.equipamentos_medicoes em
    left join public.equipment_diaries ed
      on ed.company_id = em.company_id
     and ed.equipment_fleet = em.frota
     and ed.date between em.periodo_inicio and em.periodo_fim
    where em.company_id = p_company_id
    group by em.id, em.valor_total
  )
  select coalesce(
    sum(
      case
        when dias_total > 0 then valor_total * (dias_ogs / dias_total)
        else 0
      end
    ),
    0
  )::numeric as valor
  from diario_counts
)
select 'combustivel'::text as componente, comb.valor from comb
union all
select 'suprimentos'::text as componente, sup.valor from sup
union all
select 'terceiros'::text as componente, terc.valor from terc
union all
select 'equipamentos_medicao_rateada'::text as componente, med.valor from med
union all
select 'total'::text as componente, (comb.valor + sup.valor + terc.valor + med.valor)::numeric as valor
from comb, sup, terc, med;
$$;

comment on function public.wf_custos_realizados_por_ogs(uuid, text)
is 'Retorna custos realizados por OGS (combustível, suprimentos, terceiros e medições rateadas de equipamentos) por company_id.';

commit;

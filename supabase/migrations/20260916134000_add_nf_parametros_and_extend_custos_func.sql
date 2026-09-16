begin;

create table if not exists public.wf_planejamento_parametros_ogs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  ogs text not null,
  preco_massa_ton numeric(14,4) not null default 0,
  preco_concreto_m3 numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create unique index if not exists ux_wf_planejamento_parametros_company_ogs
  on public.wf_planejamento_parametros_ogs (company_id, ogs);

create index if not exists idx_wf_planejamento_parametros_company
  on public.wf_planejamento_parametros_ogs (company_id);

alter table public.wf_planejamento_parametros_ogs enable row level security;

drop policy if exists "wf_planejamento_parametros_select" on public.wf_planejamento_parametros_ogs;
create policy "wf_planejamento_parametros_select"
on public.wf_planejamento_parametros_ogs
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs.company_id)
  )
);

drop policy if exists "wf_planejamento_parametros_insert" on public.wf_planejamento_parametros_ogs;
create policy "wf_planejamento_parametros_insert"
on public.wf_planejamento_parametros_ogs
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs.company_id)
  )
);

drop policy if exists "wf_planejamento_parametros_update" on public.wf_planejamento_parametros_ogs;
create policy "wf_planejamento_parametros_update"
on public.wf_planejamento_parametros_ogs
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs.company_id)
  )
);

drop policy if exists "wf_planejamento_parametros_delete" on public.wf_planejamento_parametros_ogs;
create policy "wf_planejamento_parametros_delete"
on public.wf_planejamento_parametros_ogs
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs.company_id)
  )
);

create or replace function public.wf_custos_realizados_por_ogs(p_company_id uuid, p_ogs text)
returns table (componente text, valor numeric)
language sql
stable
set search_path = public
as $$
with
params as (
  select
    coalesce(max(preco_massa_ton), 0)::numeric as preco_massa_ton,
    coalesce(max(preco_concreto_m3), 0)::numeric as preco_concreto_m3
  from public.wf_planejamento_parametros_ogs p
  where p.company_id = p_company_id
    and p.ogs = p_ogs
),
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
),
nf_massa as (
  select coalesce(sum(coalesce(nf.tonelagem, 0) * params.preco_massa_ton), 0)::numeric as valor
  from public.rdo_nf_massa nf
  join public.rdo_diarios rd
    on rd.id = nf.rdo_id
   and rd.company_id = nf.company_id
  join public.ogs_reference og
    on og.id = rd.ogs_id
   and og.company_id = rd.company_id
  cross join params
  where nf.company_id = p_company_id
    and og.ogs_number = p_ogs
),
nf_concreto as (
  select coalesce(sum(coalesce(nf.quantidade_m3, 0) * params.preco_concreto_m3), 0)::numeric as valor
  from public.rdo_nf_concreto nf
  join public.rdo_diarios rd
    on rd.id = nf.rdo_id
   and rd.company_id = nf.company_id
  join public.ogs_reference og
    on og.id = rd.ogs_id
   and og.company_id = rd.company_id
  cross join params
  where nf.company_id = p_company_id
    and og.ogs_number = p_ogs
)
select 'combustivel'::text as componente, comb.valor from comb
union all
select 'suprimentos'::text as componente, sup.valor from sup
union all
select 'terceiros'::text as componente, terc.valor from terc
union all
select 'equipamentos_medicao_rateada'::text as componente, med.valor from med
union all
select 'nf_massa_estimado'::text as componente, nf_massa.valor from nf_massa
union all
select 'nf_concreto_estimado'::text as componente, nf_concreto.valor from nf_concreto
union all
select 'total'::text as componente, (comb.valor + sup.valor + terc.valor + med.valor + nf_massa.valor + nf_concreto.valor)::numeric as valor
from comb, sup, terc, med, nf_massa, nf_concreto;
$$;

comment on function public.wf_custos_realizados_por_ogs(uuid, text)
is 'Retorna custos realizados por OGS incluindo estimativa financeira de NF Massa/Concreto via parâmetros por OGS (preço/ton e preço/m3).';

commit;

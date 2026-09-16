begin;

create table if not exists public.wf_planejamento_parametros_ogs_historico (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  ogs text not null,
  preco_massa_ton_anterior numeric(14,4) null,
  preco_massa_ton_novo numeric(14,4) not null,
  preco_concreto_m3_anterior numeric(14,4) null,
  preco_concreto_m3_novo numeric(14,4) not null,
  changed_by uuid null,
  origem text not null default 'ui',
  changed_at timestamptz not null default now()
);

create index if not exists idx_wf_planejamento_param_hist_company_ogs
  on public.wf_planejamento_parametros_ogs_historico (company_id, ogs, changed_at desc);

alter table public.wf_planejamento_parametros_ogs
  add constraint chk_wf_param_ogs_preco_massa_nonneg check (preco_massa_ton >= 0);

alter table public.wf_planejamento_parametros_ogs
  add constraint chk_wf_param_ogs_preco_concreto_nonneg check (preco_concreto_m3 >= 0);

drop trigger if exists trg_touch_wf_planejamento_parametros on public.wf_planejamento_parametros_ogs;
create trigger trg_touch_wf_planejamento_parametros
before update on public.wf_planejamento_parametros_ogs
for each row execute function public.touch_wf_timestamp();

alter table public.wf_planejamento_parametros_ogs_historico enable row level security;

drop policy if exists "wf_planejamento_param_hist_select" on public.wf_planejamento_parametros_ogs_historico;
create policy "wf_planejamento_param_hist_select"
on public.wf_planejamento_parametros_ogs_historico
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs_historico.company_id)
  )
);

drop policy if exists "wf_planejamento_param_hist_insert" on public.wf_planejamento_parametros_ogs_historico;
create policy "wf_planejamento_param_hist_insert"
on public.wf_planejamento_parametros_ogs_historico
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_parametros_ogs_historico.company_id)
  )
);

create or replace function public.wf_log_parametros_ogs_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wf_planejamento_parametros_ogs_historico (
      company_id,
      ogs,
      preco_massa_ton_anterior,
      preco_massa_ton_novo,
      preco_concreto_m3_anterior,
      preco_concreto_m3_novo,
      changed_by,
      origem
    ) values (
      new.company_id,
      new.ogs,
      null,
      new.preco_massa_ton,
      null,
      new.preco_concreto_m3,
      coalesce(new.updated_by, auth.uid()),
      'insert'
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and (
    old.preco_massa_ton is distinct from new.preco_massa_ton
    or old.preco_concreto_m3 is distinct from new.preco_concreto_m3
  ) then
    insert into public.wf_planejamento_parametros_ogs_historico (
      company_id,
      ogs,
      preco_massa_ton_anterior,
      preco_massa_ton_novo,
      preco_concreto_m3_anterior,
      preco_concreto_m3_novo,
      changed_by,
      origem
    ) values (
      new.company_id,
      new.ogs,
      old.preco_massa_ton,
      new.preco_massa_ton,
      old.preco_concreto_m3,
      new.preco_concreto_m3,
      coalesce(new.updated_by, auth.uid()),
      'update'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_wf_log_parametros_ogs_historico on public.wf_planejamento_parametros_ogs;
create trigger trg_wf_log_parametros_ogs_historico
after insert or update on public.wf_planejamento_parametros_ogs
for each row execute function public.wf_log_parametros_ogs_historico();

create or replace function public.wf_nf_resumo_por_ogs(p_company_id uuid, p_ogs text)
returns table (
  qtd_nf_massa bigint,
  ton_massa numeric,
  qtd_nf_concreto bigint,
  m3_concreto numeric
)
language sql
stable
set search_path = public
as $$
select
  coalesce((
    select count(*)
    from public.rdo_nf_massa nf
    join public.rdo_diarios rd on rd.id = nf.rdo_id and rd.company_id = nf.company_id
    join public.ogs_reference og on og.id = rd.ogs_id and og.company_id = rd.company_id
    where nf.company_id = p_company_id and og.ogs_number = p_ogs
  ), 0)::bigint as qtd_nf_massa,
  coalesce((
    select sum(nf.tonelagem)
    from public.rdo_nf_massa nf
    join public.rdo_diarios rd on rd.id = nf.rdo_id and rd.company_id = nf.company_id
    join public.ogs_reference og on og.id = rd.ogs_id and og.company_id = rd.company_id
    where nf.company_id = p_company_id and og.ogs_number = p_ogs
  ), 0)::numeric as ton_massa,
  coalesce((
    select count(*)
    from public.rdo_nf_concreto nf
    join public.rdo_diarios rd on rd.id = nf.rdo_id and rd.company_id = nf.company_id
    join public.ogs_reference og on og.id = rd.ogs_id and og.company_id = rd.company_id
    where nf.company_id = p_company_id and og.ogs_number = p_ogs
  ), 0)::bigint as qtd_nf_concreto,
  coalesce((
    select sum(nf.quantidade_m3)
    from public.rdo_nf_concreto nf
    join public.rdo_diarios rd on rd.id = nf.rdo_id and rd.company_id = nf.company_id
    join public.ogs_reference og on og.id = rd.ogs_id and og.company_id = rd.company_id
    where nf.company_id = p_company_id and og.ogs_number = p_ogs
  ), 0)::numeric as m3_concreto;
$$;

comment on function public.wf_nf_resumo_por_ogs(uuid, text)
is 'Resumo de NFs (massa/concreto) por OGS para validação de parâmetros de preço no WF Planejamento.';

commit;

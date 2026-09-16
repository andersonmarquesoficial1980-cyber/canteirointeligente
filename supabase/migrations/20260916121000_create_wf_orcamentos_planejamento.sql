begin;

create table if not exists public.wf_orcamentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  ogs text not null,
  cliente text not null,
  obra text not null,
  versao integer not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho','em_revisao','aprovado_interno','enviado_cliente','ganho','perdido','cancelado')),
  receita_proposta numeric(14,2) not null default 0,
  impostos_percentual numeric(8,2) not null default 0,
  contingencia_percentual numeric(8,2) not null default 0,
  bdi_percentual numeric(8,2) not null default 0,
  custo_direto_total numeric(14,2) not null default 0,
  impostos_total numeric(14,2) not null default 0,
  contingencia_total numeric(14,2) not null default 0,
  bdi_total numeric(14,2) not null default 0,
  total_orcado numeric(14,2) not null default 0,
  margem_prevista numeric(14,2) not null default 0,
  observacoes text null,
  baseline_execucao boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists ux_wf_orcamentos_company_ogs_versao
  on public.wf_orcamentos (company_id, ogs, versao);

create index if not exists idx_wf_orcamentos_company_status
  on public.wf_orcamentos (company_id, status, created_at desc);

create index if not exists idx_wf_orcamentos_company_obra
  on public.wf_orcamentos (company_id, obra);

create table if not exists public.wf_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.wf_orcamentos(id) on delete cascade,
  company_id uuid not null,
  ordem integer not null default 0,
  categoria text not null,
  descricao text not null,
  quantidade numeric(14,4) not null default 0,
  unitario numeric(14,4) not null default 0,
  total numeric(14,2) generated always as (round((quantidade * unitario)::numeric, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wf_orcamento_itens_orcamento
  on public.wf_orcamento_itens (orcamento_id, ordem);

create index if not exists idx_wf_orcamento_itens_company
  on public.wf_orcamento_itens (company_id);

create table if not exists public.wf_planejamento_obras (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  ogs text not null,
  obra text not null,
  cliente text null,
  orcamento_baseline_id uuid null references public.wf_orcamentos(id) on delete set null,
  receita_atualizada numeric(14,2) not null default 0,
  custo_realizado numeric(14,2) not null default 0,
  custo_comprometido numeric(14,2) not null default 0,
  previsao_a_executar numeric(14,2) not null default 0,
  saldo_obra numeric(14,2) generated always as (round((receita_atualizada - (custo_realizado + custo_comprometido))::numeric, 2)) stored,
  eac numeric(14,2) generated always as (round((custo_realizado + previsao_a_executar)::numeric, 2)) stored,
  desvio_vs_baseline numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists ux_wf_planejamento_company_ogs
  on public.wf_planejamento_obras (company_id, ogs);

create index if not exists idx_wf_planejamento_company_obra
  on public.wf_planejamento_obras (company_id, obra);

create or replace function public.touch_wf_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_wf_orcamentos on public.wf_orcamentos;
create trigger trg_touch_wf_orcamentos
before update on public.wf_orcamentos
for each row execute function public.touch_wf_timestamp();

drop trigger if exists trg_touch_wf_orcamento_itens on public.wf_orcamento_itens;
create trigger trg_touch_wf_orcamento_itens
before update on public.wf_orcamento_itens
for each row execute function public.touch_wf_timestamp();

drop trigger if exists trg_touch_wf_planejamento on public.wf_planejamento_obras;
create trigger trg_touch_wf_planejamento
before update on public.wf_planejamento_obras
for each row execute function public.touch_wf_timestamp();

alter table public.wf_orcamentos enable row level security;
alter table public.wf_orcamento_itens enable row level security;
alter table public.wf_planejamento_obras enable row level security;

drop policy if exists "wf_orcamentos_select" on public.wf_orcamentos;
create policy "wf_orcamentos_select"
on public.wf_orcamentos
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamentos.company_id)
  )
);

drop policy if exists "wf_orcamentos_insert" on public.wf_orcamentos;
create policy "wf_orcamentos_insert"
on public.wf_orcamentos
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamentos.company_id)
  )
);

drop policy if exists "wf_orcamentos_update" on public.wf_orcamentos;
create policy "wf_orcamentos_update"
on public.wf_orcamentos
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamentos.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamentos.company_id)
  )
);

drop policy if exists "wf_orcamentos_delete" on public.wf_orcamentos;
create policy "wf_orcamentos_delete"
on public.wf_orcamentos
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamentos.company_id)
  )
);

drop policy if exists "wf_orcamento_itens_select" on public.wf_orcamento_itens;
create policy "wf_orcamento_itens_select"
on public.wf_orcamento_itens
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamento_itens.company_id)
  )
);

drop policy if exists "wf_orcamento_itens_insert" on public.wf_orcamento_itens;
create policy "wf_orcamento_itens_insert"
on public.wf_orcamento_itens
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamento_itens.company_id)
  )
);

drop policy if exists "wf_orcamento_itens_update" on public.wf_orcamento_itens;
create policy "wf_orcamento_itens_update"
on public.wf_orcamento_itens
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamento_itens.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamento_itens.company_id)
  )
);

drop policy if exists "wf_orcamento_itens_delete" on public.wf_orcamento_itens;
create policy "wf_orcamento_itens_delete"
on public.wf_orcamento_itens
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_orcamento_itens.company_id)
  )
);

drop policy if exists "wf_planejamento_select" on public.wf_planejamento_obras;
create policy "wf_planejamento_select"
on public.wf_planejamento_obras
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_obras.company_id)
  )
);

drop policy if exists "wf_planejamento_insert" on public.wf_planejamento_obras;
create policy "wf_planejamento_insert"
on public.wf_planejamento_obras
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_obras.company_id)
  )
);

drop policy if exists "wf_planejamento_update" on public.wf_planejamento_obras;
create policy "wf_planejamento_update"
on public.wf_planejamento_obras
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_obras.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_obras.company_id)
  )
);

drop policy if exists "wf_planejamento_delete" on public.wf_planejamento_obras;
create policy "wf_planejamento_delete"
on public.wf_planejamento_obras
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_planejamento_obras.company_id)
  )
);

commit;

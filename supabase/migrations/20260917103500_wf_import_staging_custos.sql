begin;

-- Reuso de trigger padrão de updated_at (já usada em wf_orcamentos)
create or replace function public.touch_wf_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.wf_import_lotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  fonte text not null default 'xlsx',
  arquivo_nome text not null,
  arquivo_sha256 text null,
  competencia date null,
  status text not null default 'recebido' check (status in ('recebido','processado','validado','aplicado','cancelado')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists idx_wf_import_lotes_company_created
  on public.wf_import_lotes (company_id, created_at desc);

create table if not exists public.wf_stg_funcionarios (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.wf_import_lotes(id) on delete cascade,
  company_id uuid not null,
  linha_num integer not null,
  matricula_raw text null,
  matricula_norm text null,
  nome text null,
  funcao text null,
  centro_custo text null,
  status text null,
  admissao date null,
  nascimento date null,
  rg text null,
  cpf text null,
  salario numeric(14,2) null,
  payload jsonb not null default '{}'::jsonb,
  row_hash text null,
  process_status text not null default 'novo' check (process_status in ('novo','match_auto','match_manual','ignorado','erro')),
  process_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lote_id, linha_num)
);

create index if not exists idx_wf_stg_funcionarios_company_lote
  on public.wf_stg_funcionarios (company_id, lote_id);

create index if not exists idx_wf_stg_funcionarios_matricula
  on public.wf_stg_funcionarios (company_id, matricula_norm);

create index if not exists idx_wf_stg_funcionarios_cpf
  on public.wf_stg_funcionarios (company_id, cpf);

create table if not exists public.wf_stg_provisionamento (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.wf_import_lotes(id) on delete cascade,
  company_id uuid not null,
  linha_num integer not null,
  matricula_raw text null,
  matricula_norm text null,
  nome text null,
  funcao text null,
  status text null,
  salario numeric(14,2) null,
  provisao_13 numeric(14,4) null,
  provisao_ferias numeric(14,4) null,
  um_terco_ferias numeric(14,4) null,
  base_encargos numeric(14,4) null,
  inss_patronal numeric(14,4) null,
  fgts numeric(14,4) null,
  total_encargos numeric(14,4) null,
  total_provisao_mensal numeric(14,4) null,
  assistencia_medica numeric(14,4) null,
  seguro_vida numeric(14,4) null,
  vale_refeicao numeric(14,4) null,
  totalpass numeric(14,4) null,
  total_mensal numeric(14,4) null,
  payload jsonb not null default '{}'::jsonb,
  row_hash text null,
  process_status text not null default 'novo' check (process_status in ('novo','vinculado','ignorado','erro')),
  process_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lote_id, linha_num)
);

create index if not exists idx_wf_stg_provisionamento_company_lote
  on public.wf_stg_provisionamento (company_id, lote_id);

create index if not exists idx_wf_stg_provisionamento_matricula
  on public.wf_stg_provisionamento (company_id, matricula_norm);

create table if not exists public.wf_funcionario_match_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  lote_id uuid not null references public.wf_import_lotes(id) on delete cascade,
  stg_funcionario_id uuid not null references public.wf_stg_funcionarios(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  match_status text not null default 'pendente' check (match_status in ('pendente','auto_match','manual_review','aprovado','rejeitado')),
  match_score numeric(5,2) null,
  match_rule text null,
  motivo text null,
  decisao_payload jsonb not null default '{}'::jsonb,
  resolved_by uuid null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lote_id, stg_funcionario_id)
);

create index if not exists idx_wf_match_queue_company_status
  on public.wf_funcionario_match_queue (company_id, match_status, created_at desc);

create index if not exists idx_wf_match_queue_employee
  on public.wf_funcionario_match_queue (company_id, employee_id);

-- Triggers de updated_at

drop trigger if exists trg_touch_wf_import_lotes on public.wf_import_lotes;
create trigger trg_touch_wf_import_lotes
before update on public.wf_import_lotes
for each row execute function public.touch_wf_timestamp();

drop trigger if exists trg_touch_wf_stg_funcionarios on public.wf_stg_funcionarios;
create trigger trg_touch_wf_stg_funcionarios
before update on public.wf_stg_funcionarios
for each row execute function public.touch_wf_timestamp();

drop trigger if exists trg_touch_wf_stg_provisionamento on public.wf_stg_provisionamento;
create trigger trg_touch_wf_stg_provisionamento
before update on public.wf_stg_provisionamento
for each row execute function public.touch_wf_timestamp();

drop trigger if exists trg_touch_wf_match_queue on public.wf_funcionario_match_queue;
create trigger trg_touch_wf_match_queue
before update on public.wf_funcionario_match_queue
for each row execute function public.touch_wf_timestamp();

-- RLS
alter table public.wf_import_lotes enable row level security;
alter table public.wf_stg_funcionarios enable row level security;
alter table public.wf_stg_provisionamento enable row level security;
alter table public.wf_funcionario_match_queue enable row level security;

-- Políticas: wf_import_lotes

drop policy if exists "wf_import_lotes_select" on public.wf_import_lotes;
create policy "wf_import_lotes_select"
on public.wf_import_lotes
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_import_lotes.company_id)
  )
);

drop policy if exists "wf_import_lotes_insert" on public.wf_import_lotes;
create policy "wf_import_lotes_insert"
on public.wf_import_lotes
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_import_lotes.company_id)
  )
);

drop policy if exists "wf_import_lotes_update" on public.wf_import_lotes;
create policy "wf_import_lotes_update"
on public.wf_import_lotes
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_import_lotes.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_import_lotes.company_id)
  )
);

drop policy if exists "wf_import_lotes_delete" on public.wf_import_lotes;
create policy "wf_import_lotes_delete"
on public.wf_import_lotes
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_import_lotes.company_id)
  )
);

-- Políticas: wf_stg_funcionarios

drop policy if exists "wf_stg_funcionarios_select" on public.wf_stg_funcionarios;
create policy "wf_stg_funcionarios_select"
on public.wf_stg_funcionarios
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_funcionarios.company_id)
  )
);

drop policy if exists "wf_stg_funcionarios_insert" on public.wf_stg_funcionarios;
create policy "wf_stg_funcionarios_insert"
on public.wf_stg_funcionarios
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_funcionarios.company_id)
  )
);

drop policy if exists "wf_stg_funcionarios_update" on public.wf_stg_funcionarios;
create policy "wf_stg_funcionarios_update"
on public.wf_stg_funcionarios
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_funcionarios.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_funcionarios.company_id)
  )
);

drop policy if exists "wf_stg_funcionarios_delete" on public.wf_stg_funcionarios;
create policy "wf_stg_funcionarios_delete"
on public.wf_stg_funcionarios
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_funcionarios.company_id)
  )
);

-- Políticas: wf_stg_provisionamento

drop policy if exists "wf_stg_provisionamento_select" on public.wf_stg_provisionamento;
create policy "wf_stg_provisionamento_select"
on public.wf_stg_provisionamento
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_provisionamento.company_id)
  )
);

drop policy if exists "wf_stg_provisionamento_insert" on public.wf_stg_provisionamento;
create policy "wf_stg_provisionamento_insert"
on public.wf_stg_provisionamento
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_provisionamento.company_id)
  )
);

drop policy if exists "wf_stg_provisionamento_update" on public.wf_stg_provisionamento;
create policy "wf_stg_provisionamento_update"
on public.wf_stg_provisionamento
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_provisionamento.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_provisionamento.company_id)
  )
);

drop policy if exists "wf_stg_provisionamento_delete" on public.wf_stg_provisionamento;
create policy "wf_stg_provisionamento_delete"
on public.wf_stg_provisionamento
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_stg_provisionamento.company_id)
  )
);

-- Políticas: wf_funcionario_match_queue

drop policy if exists "wf_funcionario_match_queue_select" on public.wf_funcionario_match_queue;
create policy "wf_funcionario_match_queue_select"
on public.wf_funcionario_match_queue
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_funcionario_match_queue.company_id)
  )
);

drop policy if exists "wf_funcionario_match_queue_insert" on public.wf_funcionario_match_queue;
create policy "wf_funcionario_match_queue_insert"
on public.wf_funcionario_match_queue
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_funcionario_match_queue.company_id)
  )
);

drop policy if exists "wf_funcionario_match_queue_update" on public.wf_funcionario_match_queue;
create policy "wf_funcionario_match_queue_update"
on public.wf_funcionario_match_queue
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_funcionario_match_queue.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_funcionario_match_queue.company_id)
  )
);

drop policy if exists "wf_funcionario_match_queue_delete" on public.wf_funcionario_match_queue;
create policy "wf_funcionario_match_queue_delete"
on public.wf_funcionario_match_queue
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_funcionario_match_queue.company_id)
  )
);

commit;

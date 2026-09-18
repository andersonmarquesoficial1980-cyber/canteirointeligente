-- Integração PontoMais (VR) — trilha de sincronização para Banco de Horas

create table if not exists public.pontomais_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competencia date not null,
  status text not null default 'ok' check (status in ('ok','erro')),
  endpoint text null,
  http_status integer null,
  items_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pontomais_sync_runs_company_competencia
  on public.pontomais_sync_runs(company_id, competencia, created_at desc);

alter table public.pontomais_sync_runs enable row level security;

drop policy if exists "pontomais_sync_runs_select" on public.pontomais_sync_runs;
create policy "pontomais_sync_runs_select"
  on public.pontomais_sync_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or p.company_id = pontomais_sync_runs.company_id
        )
    )
  );

drop policy if exists "pontomais_sync_runs_insert" on public.pontomais_sync_runs;
create policy "pontomais_sync_runs_insert"
  on public.pontomais_sync_runs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = pontomais_sync_runs.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );
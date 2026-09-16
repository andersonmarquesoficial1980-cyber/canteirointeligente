-- Telemetria de tentativas bloqueadas de duplicidade em RDO

create table if not exists public.rdo_duplicate_block_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid null,
  user_id uuid null,
  stage text not null check (stage in ('rascunho','envio','filhos','desconhecido')),
  scope text not null,
  rdo_id uuid null,
  error_code text null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_rdo_dup_block_events_created_at
  on public.rdo_duplicate_block_events (created_at desc);
create index if not exists idx_rdo_dup_block_events_company
  on public.rdo_duplicate_block_events (company_id, created_at desc);
create index if not exists idx_rdo_dup_block_events_scope
  on public.rdo_duplicate_block_events (scope, created_at desc);

alter table public.rdo_duplicate_block_events enable row level security;

-- leitura por empresa
DROP POLICY IF EXISTS "rdo_duplicate_block_events_select_company" ON public.rdo_duplicate_block_events;
create policy "rdo_duplicate_block_events_select_company"
  on public.rdo_duplicate_block_events
  for select
  using (
    company_id is not distinct from (
      select p.company_id from public.profiles p where p.user_id = auth.uid() limit 1
    )
  );

-- sem insert direto via cliente (somente função SECURITY DEFINER)
DROP POLICY IF EXISTS "rdo_duplicate_block_events_no_direct_insert" ON public.rdo_duplicate_block_events;
create policy "rdo_duplicate_block_events_no_direct_insert"
  on public.rdo_duplicate_block_events
  for insert
  with check (false);

create or replace function public.log_rdo_dup_block_event(
  p_stage text,
  p_scope text,
  p_rdo_id uuid default null,
  p_error_code text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_event_id uuid;
  v_stage text;
begin
  v_stage := case
    when p_stage in ('rascunho','envio','filhos','desconhecido') then p_stage
    else 'desconhecido'
  end;

  if v_user_id is not null then
    select p.company_id into v_company_id
    from public.profiles p
    where p.user_id = v_user_id
    limit 1;
  end if;

  insert into public.rdo_duplicate_block_events (
    company_id, user_id, stage, scope, rdo_id, error_code, payload
  ) values (
    v_company_id,
    v_user_id,
    v_stage,
    coalesce(nullif(trim(p_scope), ''), 'rdo_desconhecido'),
    p_rdo_id,
    p_error_code,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.log_rdo_dup_block_event(text, text, uuid, text, jsonb) to authenticated;

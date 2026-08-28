-- Fechamento/Reabertura de competência para Horas Extras (RH)

create table if not exists public.ponto_he_competencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competencia date not null,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  observacao text null,
  fechado_em timestamptz null,
  fechado_por uuid null,
  reaberto_em timestamptz null,
  reaberto_por uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_ponto_he_competencias unique (company_id, competencia)
);

create index if not exists idx_ponto_he_competencias_company_competencia
  on public.ponto_he_competencias(company_id, competencia);

alter table public.ponto_he_competencias enable row level security;

drop policy if exists "ponto_he_competencias_select" on public.ponto_he_competencias;
create policy "ponto_he_competencias_select"
  on public.ponto_he_competencias
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.role = 'superadmin' or p.company_id = ponto_he_competencias.company_id)
    )
  );

drop policy if exists "ponto_he_competencias_write" on public.ponto_he_competencias;
create policy "ponto_he_competencias_write"
  on public.ponto_he_competencias
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = ponto_he_competencias.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = ponto_he_competencias.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );

create or replace function public.trg_ponto_he_competencias_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ponto_he_competencias_set_updated_at on public.ponto_he_competencias;
create trigger trg_ponto_he_competencias_set_updated_at
before update on public.ponto_he_competencias
for each row execute function public.trg_ponto_he_competencias_set_updated_at();

-- Helper para status de fechamento
create or replace function public.fn_ponto_he_competencia_fechada(
  p_company_id uuid,
  p_competencia date
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.ponto_he_competencias c
    where c.company_id = p_company_id
      and c.competencia = p_competencia
      and c.status = 'fechado'
  );
$$;

-- Bloqueia escrita no resumo quando competência estiver fechada
create or replace function public.trg_block_ponto_he_resumo_when_closed()
returns trigger
language plpgsql
as $$
declare
  v_company_id uuid;
  v_competencia date;
begin
  v_company_id := coalesce(new.company_id, old.company_id);
  v_competencia := coalesce(new.competencia, old.competencia);

  if public.fn_ponto_he_competencia_fechada(v_company_id, v_competencia) then
    raise exception 'Competência % está fechada para esta empresa. Reabra para editar.', v_competencia
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_block_ponto_he_resumo_when_closed on public.ponto_he_resumo_mensal;
create trigger trg_block_ponto_he_resumo_when_closed
before insert or update or delete on public.ponto_he_resumo_mensal
for each row execute function public.trg_block_ponto_he_resumo_when_closed();

-- RPC: fechar competência
create or replace function public.fn_ponto_he_fechar_competencia(
  p_company_id uuid,
  p_competencia date,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean := false;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.user_id = v_uid
      and (
        p.role = 'superadmin'
        or (
          p.company_id = p_company_id
          and (
            p.role = 'admin'
            or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
          )
        )
      )
  ) into v_ok;

  if not v_ok then
    raise exception 'Sem permissão para fechar competência';
  end if;

  insert into public.ponto_he_competencias (company_id, competencia, status, observacao, fechado_em, fechado_por)
  values (p_company_id, p_competencia, 'fechado', p_observacao, now(), v_uid)
  on conflict (company_id, competencia)
  do update set
    status = 'fechado',
    observacao = excluded.observacao,
    fechado_em = now(),
    fechado_por = v_uid,
    updated_at = now();

  return jsonb_build_object('ok', true, 'status', 'fechado', 'competencia', p_competencia);
end;
$$;

grant execute on function public.fn_ponto_he_fechar_competencia(uuid, date, text) to authenticated;

-- RPC: reabrir competência
create or replace function public.fn_ponto_he_reabrir_competencia(
  p_company_id uuid,
  p_competencia date,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean := false;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.user_id = v_uid
      and (
        p.role = 'superadmin'
        or (
          p.company_id = p_company_id
          and (
            p.role = 'admin'
            or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
          )
        )
      )
  ) into v_ok;

  if not v_ok then
    raise exception 'Sem permissão para reabrir competência';
  end if;

  insert into public.ponto_he_competencias (company_id, competencia, status, observacao, reaberto_em, reaberto_por)
  values (p_company_id, p_competencia, 'aberto', p_observacao, now(), v_uid)
  on conflict (company_id, competencia)
  do update set
    status = 'aberto',
    observacao = excluded.observacao,
    reaberto_em = now(),
    reaberto_por = v_uid,
    updated_at = now();

  return jsonb_build_object('ok', true, 'status', 'aberto', 'competencia', p_competencia);
end;
$$;

grant execute on function public.fn_ponto_he_reabrir_competencia(uuid, date, text) to authenticated;

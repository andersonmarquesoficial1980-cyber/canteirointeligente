-- Pipeline de importação de PDF PontoMais (por equipe/competência)
-- Objetivo: substituir API como fonte oficial de fechamento do Banco de Horas

begin;

-- 1) JOB principal de importação
create table if not exists public.ponto_he_import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competencia date not null,
  equipe_nome text null,
  origem text not null default 'pdf' check (origem in ('pdf','api','manual')),
  status text not null default 'criado' check (
    status in (
      'criado',
      'arquivos_enviados',
      'parseado',
      'precheck_pendente',
      'precheck_ok',
      'aplicando',
      'aplicado',
      'erro'
    )
  ),
  observacao text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz null,
  applied_by uuid null
);

create index if not exists idx_ponto_he_import_jobs_company_competencia
  on public.ponto_he_import_jobs(company_id, competencia, created_at desc);

-- 2) Arquivos enviados no job
create table if not exists public.ponto_he_import_arquivos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.ponto_he_import_jobs(id) on delete cascade,
  file_name text not null,
  storage_path text null,
  sha256 text null,
  pages integer null,
  status text not null default 'enviado' check (status in ('enviado','processando','parseado','erro')),
  parser_version text null,
  parser_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  unique (company_id, job_id, file_name)
);

create index if not exists idx_ponto_he_import_arquivos_job
  on public.ponto_he_import_arquivos(company_id, job_id);

-- 3) Staging consolidado por colaborador
create table if not exists public.ponto_he_import_colaboradores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.ponto_he_import_jobs(id) on delete cascade,

  employee_id uuid null references public.employees(id) on delete set null,

  fonte_nome text not null,
  fonte_matricula text null,
  equipe_nome text null,
  funcao_nome text null,

  periodo_inicio date not null,
  periodo_fim date not null,

  credito_horas numeric(10,2) not null default 0,
  debito_horas numeric(10,2) not null default 0,
  horas_normais numeric(10,2) not null default 0,
  he_70_horas numeric(10,2) not null default 0,
  he_100_horas numeric(10,2) not null default 0,
  adicional_noturno_horas numeric(10,2) not null default 0,
  total_horas_extras_horas numeric(10,2) not null default 0,

  mapping_status text not null default 'pendente' check (mapping_status in ('ok','pendente','ambiguous','ignorado')),
  mapping_reason text null,
  source_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, job_id, fonte_nome)
);

create index if not exists idx_ponto_he_import_colabs_job
  on public.ponto_he_import_colaboradores(company_id, job_id);

create index if not exists idx_ponto_he_import_colabs_employee
  on public.ponto_he_import_colaboradores(company_id, employee_id);

-- 4) Staging detalhado de batidas diárias
create table if not exists public.ponto_he_import_batidas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.ponto_he_import_jobs(id) on delete cascade,
  colaborador_id uuid not null references public.ponto_he_import_colaboradores(id) on delete cascade,

  data date not null,
  entrada1 text null,
  saida1 text null,
  entrada2 text null,
  saida2 text null,

  horas_trabalhadas_h numeric(10,2) null,
  he_dia_h numeric(10,2) null,
  linha_origem text null,
  source_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  unique (company_id, job_id, colaborador_id, data)
);

create index if not exists idx_ponto_he_import_batidas_job
  on public.ponto_he_import_batidas(company_id, job_id, data);

-- triggers de updated_at
create or replace function public.trg_ponto_he_import_jobs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ponto_he_import_jobs_set_updated_at on public.ponto_he_import_jobs;
create trigger trg_ponto_he_import_jobs_set_updated_at
before update on public.ponto_he_import_jobs
for each row execute function public.trg_ponto_he_import_jobs_set_updated_at();

create or replace function public.trg_ponto_he_import_colabs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ponto_he_import_colabs_set_updated_at on public.ponto_he_import_colaboradores;
create trigger trg_ponto_he_import_colabs_set_updated_at
before update on public.ponto_he_import_colaboradores
for each row execute function public.trg_ponto_he_import_colabs_set_updated_at();

-- RLS
alter table public.ponto_he_import_jobs enable row level security;
alter table public.ponto_he_import_arquivos enable row level security;
alter table public.ponto_he_import_colaboradores enable row level security;
alter table public.ponto_he_import_batidas enable row level security;

-- helper ACL
create or replace function public.fn_ponto_he_can_write_company(p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
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
  );
$$;

-- JOBS policies
 drop policy if exists "ponto_he_import_jobs_select" on public.ponto_he_import_jobs;
create policy "ponto_he_import_jobs_select"
  on public.ponto_he_import_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.role = 'superadmin' or p.company_id = ponto_he_import_jobs.company_id)
    )
  );

drop policy if exists "ponto_he_import_jobs_write" on public.ponto_he_import_jobs;
create policy "ponto_he_import_jobs_write"
  on public.ponto_he_import_jobs
  for all
  to authenticated
  using (public.fn_ponto_he_can_write_company(company_id))
  with check (public.fn_ponto_he_can_write_company(company_id));

-- ARQUIVOS policies
 drop policy if exists "ponto_he_import_arquivos_select" on public.ponto_he_import_arquivos;
create policy "ponto_he_import_arquivos_select"
  on public.ponto_he_import_arquivos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.role = 'superadmin' or p.company_id = ponto_he_import_arquivos.company_id)
    )
  );

drop policy if exists "ponto_he_import_arquivos_write" on public.ponto_he_import_arquivos;
create policy "ponto_he_import_arquivos_write"
  on public.ponto_he_import_arquivos
  for all
  to authenticated
  using (public.fn_ponto_he_can_write_company(company_id))
  with check (public.fn_ponto_he_can_write_company(company_id));

-- COLABORADORES policies
 drop policy if exists "ponto_he_import_colabs_select" on public.ponto_he_import_colaboradores;
create policy "ponto_he_import_colabs_select"
  on public.ponto_he_import_colaboradores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.role = 'superadmin' or p.company_id = ponto_he_import_colaboradores.company_id)
    )
  );

drop policy if exists "ponto_he_import_colabs_write" on public.ponto_he_import_colaboradores;
create policy "ponto_he_import_colabs_write"
  on public.ponto_he_import_colaboradores
  for all
  to authenticated
  using (public.fn_ponto_he_can_write_company(company_id))
  with check (public.fn_ponto_he_can_write_company(company_id));

-- BATIDAS policies
 drop policy if exists "ponto_he_import_batidas_select" on public.ponto_he_import_batidas;
create policy "ponto_he_import_batidas_select"
  on public.ponto_he_import_batidas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.role = 'superadmin' or p.company_id = ponto_he_import_batidas.company_id)
    )
  );

drop policy if exists "ponto_he_import_batidas_write" on public.ponto_he_import_batidas;
create policy "ponto_he_import_batidas_write"
  on public.ponto_he_import_batidas
  for all
  to authenticated
  using (public.fn_ponto_he_can_write_company(company_id))
  with check (public.fn_ponto_he_can_write_company(company_id));

-- 5) Pré-check de cobertura/vínculo
create or replace function public.fn_ponto_he_pdf_precheck(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_total_colabs integer := 0;
  v_mapeados integer := 0;
  v_nao_mapeados integer := 0;
  v_total_batidas integer := 0;
  v_competencia_fechada boolean := false;
begin
  select *
  into v_job
  from public.ponto_he_import_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job % não encontrado', p_job_id;
  end if;

  if not public.fn_ponto_he_can_write_company(v_job.company_id) then
    raise exception 'Sem permissão para processar este job';
  end if;

  v_competencia_fechada := public.fn_ponto_he_competencia_fechada(v_job.company_id, v_job.competencia);
  if v_competencia_fechada then
    raise exception 'Competência % já está fechada. Reabra para importar.', v_job.competencia;
  end if;

  select count(*) into v_total_colabs
  from public.ponto_he_import_colaboradores c
  where c.company_id = v_job.company_id
    and c.job_id = p_job_id;

  select count(*) into v_mapeados
  from public.ponto_he_import_colaboradores c
  where c.company_id = v_job.company_id
    and c.job_id = p_job_id
    and c.employee_id is not null;

  v_nao_mapeados := v_total_colabs - v_mapeados;

  select count(*) into v_total_batidas
  from public.ponto_he_import_batidas b
  join public.ponto_he_import_colaboradores c
    on c.id = b.colaborador_id
   and c.company_id = b.company_id
  where b.company_id = v_job.company_id
    and b.job_id = p_job_id
    and c.employee_id is not null;

  update public.ponto_he_import_jobs
  set status = case when v_nao_mapeados = 0 then 'precheck_ok' else 'precheck_pendente' end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'precheck_at', now(),
        'total_colaboradores', v_total_colabs,
        'mapeados', v_mapeados,
        'nao_mapeados', v_nao_mapeados,
        'total_batidas', v_total_batidas
      )
  where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'total_colaboradores', v_total_colabs,
    'mapeados', v_mapeados,
    'nao_mapeados', v_nao_mapeados,
    'total_batidas', v_total_batidas,
    'status', case when v_nao_mapeados = 0 then 'precheck_ok' else 'precheck_pendente' end
  );
end;
$$;

grant execute on function public.fn_ponto_he_pdf_precheck(uuid) to authenticated;

-- 6) Apply não-destrutivo: staging -> resumo + batidas
create or replace function public.fn_ponto_he_pdf_apply(
  p_job_id uuid,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_uid uuid := auth.uid();
  v_nao_mapeados integer := 0;
  v_upsert_resumo integer := 0;
  v_ins_batidas integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into v_job
  from public.ponto_he_import_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job % não encontrado', p_job_id;
  end if;

  if not public.fn_ponto_he_can_write_company(v_job.company_id) then
    raise exception 'Sem permissão para aplicar este job';
  end if;

  if public.fn_ponto_he_competencia_fechada(v_job.company_id, v_job.competencia) then
    raise exception 'Competência % está fechada. Reabra para aplicar importação.', v_job.competencia;
  end if;

  select count(*)
    into v_nao_mapeados
  from public.ponto_he_import_colaboradores c
  where c.company_id = v_job.company_id
    and c.job_id = p_job_id
    and c.employee_id is null;

  if v_nao_mapeados > 0 then
    raise exception 'Existem % colaboradores sem vínculo. Corrija antes do apply.', v_nao_mapeados;
  end if;

  update public.ponto_he_import_jobs
     set status = 'aplicando'
   where id = p_job_id;

  -- resumo mensal (upsert)
  with src as (
    select
      c.company_id,
      v_job.competencia as competencia,
      c.periodo_inicio,
      c.periodo_fim,
      c.employee_id,
      c.fonte_nome as colaborador_nome,
      coalesce(c.equipe_nome, e.equipe) as equipe_nome,
      concat('job:', p_job_id::text) as fonte_pdf,
      c.credito_horas,
      c.debito_horas,
      c.horas_normais,
      c.he_70_horas,
      c.he_100_horas,
      c.adicional_noturno_horas,
      c.total_horas_extras_horas,
      jsonb_build_object(
        'source', 'pdf_import',
        'job_id', p_job_id,
        'applied_at', now(),
        'applied_by', v_uid,
        'mapping_status', c.mapping_status,
        'source_payload', c.source_payload
      ) as payload
    from public.ponto_he_import_colaboradores c
    left join public.employees e
      on e.id = c.employee_id
     and e.company_id = c.company_id
    where c.company_id = v_job.company_id
      and c.job_id = p_job_id
      and c.employee_id is not null
  ), upserted as (
    insert into public.ponto_he_resumo_mensal (
      company_id,
      competencia,
      periodo_inicio,
      periodo_fim,
      employee_id,
      colaborador_nome,
      equipe_nome,
      fonte_pdf,
      credito_horas,
      debito_horas,
      horas_normais,
      he_70_horas,
      he_100_horas,
      adicional_noturno_horas,
      total_horas_extras_horas,
      payload
    )
    select
      company_id,
      competencia,
      periodo_inicio,
      periodo_fim,
      employee_id,
      colaborador_nome,
      equipe_nome,
      fonte_pdf,
      credito_horas,
      debito_horas,
      horas_normais,
      he_70_horas,
      he_100_horas,
      adicional_noturno_horas,
      total_horas_extras_horas,
      payload
    from src
    on conflict (company_id, competencia, colaborador_nome)
    do update set
      employee_id = excluded.employee_id,
      periodo_inicio = excluded.periodo_inicio,
      periodo_fim = excluded.periodo_fim,
      equipe_nome = excluded.equipe_nome,
      fonte_pdf = excluded.fonte_pdf,
      credito_horas = excluded.credito_horas,
      debito_horas = excluded.debito_horas,
      horas_normais = excluded.horas_normais,
      he_70_horas = excluded.he_70_horas,
      he_100_horas = excluded.he_100_horas,
      adicional_noturno_horas = excluded.adicional_noturno_horas,
      total_horas_extras_horas = excluded.total_horas_extras_horas,
      payload = coalesce(public.ponto_he_resumo_mensal.payload, '{}'::jsonb) || excluded.payload,
      updated_at = now()
    returning 1
  )
  select count(*) into v_upsert_resumo from upserted;

  -- batidas dia-a-dia (idempotente)
  with base as (
    select
      b.company_id,
      c.employee_id as staff_id,
      b.data,
      b.entrada1,
      b.saida1,
      b.entrada2,
      b.saida2
    from public.ponto_he_import_batidas b
    join public.ponto_he_import_colaboradores c
      on c.id = b.colaborador_id
     and c.company_id = b.company_id
    where b.company_id = v_job.company_id
      and b.job_id = p_job_id
      and c.employee_id is not null
  ), marks as (
    select company_id, staff_id, data, 'entrada'::text as tipo, entrada1 as hora from base
    union all
    select company_id, staff_id, data, 'saida'::text as tipo, saida1 as hora from base
    union all
    select company_id, staff_id, data, 'entrada'::text as tipo, entrada2 as hora from base
    union all
    select company_id, staff_id, data, 'saida'::text as tipo, saida2 as hora from base
  ), valid_marks as (
    select
      company_id,
      staff_id,
      data,
      tipo,
      case
        when hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then hora || ':00'
        else null
      end as hora
    from marks
  ), ins as (
    insert into public.ponto_registros (
      staff_id,
      tipo,
      data,
      hora,
      turno,
      company_id,
      metodo
    )
    select
      vm.staff_id,
      vm.tipo,
      vm.data,
      vm.hora,
      null,
      vm.company_id,
      'import_pdf_pontomais'
    from valid_marks vm
    where vm.hora is not null
      and not exists (
        select 1
        from public.ponto_registros pr
        where pr.company_id = vm.company_id
          and pr.staff_id = vm.staff_id
          and pr.data = vm.data
          and pr.hora = vm.hora
          and pr.tipo = vm.tipo
      )
    returning 1
  )
  select count(*) into v_ins_batidas from ins;

  update public.ponto_he_import_jobs
     set status = 'aplicado',
         observacao = coalesce(p_observacao, observacao),
         applied_at = now(),
         applied_by = v_uid,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'applied_at', now(),
           'applied_by', v_uid,
           'upsert_resumo', v_upsert_resumo,
           'batidas_inseridas', v_ins_batidas
         )
   where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'status', 'aplicado',
    'upsert_resumo', v_upsert_resumo,
    'batidas_inseridas', v_ins_batidas
  );
exception
  when others then
    update public.ponto_he_import_jobs
       set status = 'erro',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_error', sqlerrm, 'error_at', now())
     where id = p_job_id;
    raise;
end;
$$;

grant execute on function public.fn_ponto_he_pdf_apply(uuid, text) to authenticated;

-- 7) Endurecimento do fechamento: exige cobertura 100% dos ativos
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
  v_total_ativos integer := 0;
  v_sem_resumo integer := 0;
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

  select count(*)
    into v_total_ativos
  from public.employees e
  where e.company_id = p_company_id
    and coalesce(e.status, 'ativo') = 'ativo';

  select count(*)
    into v_sem_resumo
  from public.employees e
  left join public.ponto_he_resumo_mensal r
    on r.company_id = e.company_id
   and r.competencia = p_competencia
   and r.employee_id = e.id
  where e.company_id = p_company_id
    and coalesce(e.status, 'ativo') = 'ativo'
    and r.id is null;

  if v_total_ativos > 0 and v_sem_resumo > 0 then
    raise exception 'Fechamento bloqueado: % colaborador(es) ativo(s) sem resumo na competência %.', v_sem_resumo, p_competencia
      using errcode = 'P0001';
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

  return jsonb_build_object(
    'ok', true,
    'status', 'fechado',
    'competencia', p_competencia,
    'total_ativos', v_total_ativos,
    'sem_resumo', v_sem_resumo
  );
end;
$$;

grant execute on function public.fn_ponto_he_fechar_competencia(uuid, date, text) to authenticated;

-- 8) Bucket de storage para PDFs (se não existir)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ponto-he-imports',
  'ponto-he-imports',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

-- Policies de storage por company_id no prefixo do path: <company_id>/<competencia>/<job_id>/arquivo.pdf
-- leitura
 drop policy if exists "ponto_he_imports_select" on storage.objects;
create policy "ponto_he_imports_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ponto-he-imports'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            and p.company_id = split_part(name, '/', 1)::uuid
          )
        )
    )
  );

-- escrita
 drop policy if exists "ponto_he_imports_write" on storage.objects;
create policy "ponto_he_imports_write"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'ponto-he-imports'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            and p.company_id = split_part(name, '/', 1)::uuid
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  )
  with check (
    bucket_id = 'ponto-he-imports'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            and p.company_id = split_part(name, '/', 1)::uuid
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );

commit;

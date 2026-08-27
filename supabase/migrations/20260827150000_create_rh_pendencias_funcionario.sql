-- WF Gestão de Pessoas — Pendências por funcionário
-- Fluxo: aberta -> em_analise -> aprovada/reprovada/cancelada
-- Tipos: classificacao, aumento_salarial, demissao, substituicao

begin;

create table if not exists public.rh_pendencias_funcionario (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  tipo text not null check (tipo in ('classificacao', 'aumento_salarial', 'demissao', 'substituicao')),
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'aprovada', 'reprovada', 'cancelada')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  justificativa text not null,
  data_efetiva date null,
  payload jsonb not null default '{}'::jsonb,
  solicitado_por_user_id uuid null,
  solicitado_por_nome text null,
  parecer_gp text null,
  motivo_reprovacao text null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rh_pendencias_company_status
  on public.rh_pendencias_funcionario (company_id, status, created_at desc);

create index if not exists idx_rh_pendencias_employee
  on public.rh_pendencias_funcionario (employee_id, created_at desc);

create index if not exists idx_rh_pendencias_tipo
  on public.rh_pendencias_funcionario (tipo);

create table if not exists public.rh_pendencias_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  pendencia_id uuid not null references public.rh_pendencias_funcionario(id) on delete cascade,
  company_id uuid not null,
  acao text not null default 'movimentacao',
  status_anterior text null,
  status_novo text not null,
  comentario text null,
  created_by uuid null,
  created_by_nome text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rh_pendencias_mov_pendencia
  on public.rh_pendencias_movimentacoes (pendencia_id, created_at desc);

create index if not exists idx_rh_pendencias_mov_company
  on public.rh_pendencias_movimentacoes (company_id, created_at desc);

create or replace function public.touch_rh_pendencias_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_rh_pendencias_updated_at on public.rh_pendencias_funcionario;
create trigger trg_touch_rh_pendencias_updated_at
before update on public.rh_pendencias_funcionario
for each row execute function public.touch_rh_pendencias_updated_at();

create or replace function public.rh_pendencias_log_movimentacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  select coalesce(p.nome_completo, p.email)
    into v_nome
    from public.profiles p
   where p.user_id = auth.uid()
   limit 1;

  if tg_op = 'INSERT' then
    insert into public.rh_pendencias_movimentacoes (
      pendencia_id, company_id, acao, status_anterior, status_novo, comentario, created_by, created_by_nome
    ) values (
      new.id, new.company_id, 'abertura', null, new.status, new.justificativa, auth.uid(), coalesce(v_nome, new.solicitado_por_nome)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.rh_pendencias_movimentacoes (
      pendencia_id, company_id, acao, status_anterior, status_novo, comentario, created_by, created_by_nome
    ) values (
      new.id,
      new.company_id,
      'status',
      old.status,
      new.status,
      coalesce(new.parecer_gp, new.motivo_reprovacao),
      auth.uid(),
      v_nome
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rh_pendencias_log_movimentacao on public.rh_pendencias_funcionario;
create trigger trg_rh_pendencias_log_movimentacao
after insert or update on public.rh_pendencias_funcionario
for each row execute function public.rh_pendencias_log_movimentacao();

alter table public.rh_pendencias_funcionario enable row level security;
alter table public.rh_pendencias_movimentacoes enable row level security;

drop policy if exists "rh_pendencias_select" on public.rh_pendencias_funcionario;
create policy "rh_pendencias_select"
on public.rh_pendencias_funcionario
for select
using (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or p.company_id = rh_pendencias_funcionario.company_id
       )
  )
);

drop policy if exists "rh_pendencias_insert" on public.rh_pendencias_funcionario;
create policy "rh_pendencias_insert"
on public.rh_pendencias_funcionario
for insert
with check (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or p.company_id = rh_pendencias_funcionario.company_id
       )
  )
);

drop policy if exists "rh_pendencias_update_gp" on public.rh_pendencias_funcionario;
create policy "rh_pendencias_update_gp"
on public.rh_pendencias_funcionario
for update
using (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = rh_pendencias_funcionario.company_id
           and (
             p.role = 'admin'
             or p.perfil in ('Administrador', 'Gerente', 'RH', 'Gestão de Pessoas')
             or exists (
               select 1
                 from public.user_permissions up
                where up.user_id = auth.uid()
                  and up.is_admin = true
             )
           )
         )
       )
  )
)
with check (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = rh_pendencias_funcionario.company_id
           and (
             p.role = 'admin'
             or p.perfil in ('Administrador', 'Gerente', 'RH', 'Gestão de Pessoas')
             or exists (
               select 1
                 from public.user_permissions up
                where up.user_id = auth.uid()
                  and up.is_admin = true
             )
           )
         )
       )
  )
);

drop policy if exists "rh_pendencias_mov_select" on public.rh_pendencias_movimentacoes;
create policy "rh_pendencias_mov_select"
on public.rh_pendencias_movimentacoes
for select
using (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or p.company_id = rh_pendencias_movimentacoes.company_id
       )
  )
);

drop policy if exists "rh_pendencias_mov_insert_gp" on public.rh_pendencias_movimentacoes;
create policy "rh_pendencias_mov_insert_gp"
on public.rh_pendencias_movimentacoes
for insert
with check (
  exists (
    select 1
      from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = rh_pendencias_movimentacoes.company_id
           and (
             p.role = 'admin'
             or p.perfil in ('Administrador', 'Gerente', 'RH', 'Gestão de Pessoas')
             or exists (
               select 1
                 from public.user_permissions up
                where up.user_id = auth.uid()
                  and up.is_admin = true
             )
           )
         )
       )
  )
);

commit;

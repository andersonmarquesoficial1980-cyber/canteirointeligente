-- Gestão de Horas Extras (baseado no layout Pontomais dos PDFs)
-- Tabela de resumo mensal por colaborador para fechamento e conferência

create table if not exists public.ponto_he_resumo_mensal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,

  competencia date not null, -- 1º dia do mês de referência (ex.: 2026-08-01)
  periodo_inicio date not null,
  periodo_fim date not null,

  colaborador_nome text not null,
  equipe_nome text null,
  fonte_pdf text null,

  credito_horas numeric(10,2) not null default 0,         -- Crédito (h)
  debito_horas numeric(10,2) not null default 0,          -- Débito (h)
  horas_normais numeric(10,2) not null default 0,         -- Horas normais (h)
  he_70_horas numeric(10,2) not null default 0,           -- H.E. 1 (70%)
  he_100_horas numeric(10,2) not null default 0,          -- H.E. 2 (100%)
  adicional_noturno_horas numeric(10,2) not null default 0,
  total_horas_extras_horas numeric(10,2) not null default 0,

  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_ponto_he_resumo_mensal
    unique (company_id, competencia, colaborador_nome)
);

create index if not exists idx_ponto_he_resumo_mensal_company_competencia
  on public.ponto_he_resumo_mensal(company_id, competencia);

create index if not exists idx_ponto_he_resumo_mensal_employee
  on public.ponto_he_resumo_mensal(employee_id);

alter table public.ponto_he_resumo_mensal enable row level security;

-- Isolamento por empresa / superadmin
drop policy if exists "ponto_he_resumo_select" on public.ponto_he_resumo_mensal;
create policy "ponto_he_resumo_select"
  on public.ponto_he_resumo_mensal
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or p.company_id = ponto_he_resumo_mensal.company_id
        )
    )
  );

drop policy if exists "ponto_he_resumo_insert" on public.ponto_he_resumo_mensal;
create policy "ponto_he_resumo_insert"
  on public.ponto_he_resumo_mensal
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
            p.company_id = ponto_he_resumo_mensal.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );

drop policy if exists "ponto_he_resumo_update" on public.ponto_he_resumo_mensal;
create policy "ponto_he_resumo_update"
  on public.ponto_he_resumo_mensal
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = ponto_he_resumo_mensal.company_id
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
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = ponto_he_resumo_mensal.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );

drop policy if exists "ponto_he_resumo_delete" on public.ponto_he_resumo_mensal;
create policy "ponto_he_resumo_delete"
  on public.ponto_he_resumo_mensal
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.company_id = ponto_he_resumo_mensal.company_id
            and (
              p.role = 'admin'
              or p.perfil = any (array['Administrador','Gerente','RH','Gestão de Pessoas'])
            )
          )
        )
    )
  );

create or replace function public.trg_ponto_he_resumo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ponto_he_resumo_set_updated_at on public.ponto_he_resumo_mensal;
create trigger trg_ponto_he_resumo_set_updated_at
before update on public.ponto_he_resumo_mensal
for each row execute function public.trg_ponto_he_resumo_set_updated_at();

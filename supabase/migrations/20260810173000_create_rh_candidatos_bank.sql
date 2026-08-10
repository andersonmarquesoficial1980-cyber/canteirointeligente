-- Banco de Candidatos (WF Gestão de Pessoas)
-- Objetivo: centralizar entrevistas e histórico de contato para futuras contratações.

begin;

create table if not exists public.rh_candidatos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  funcao text,
  idade integer,
  indicacao text,
  observacoes text,
  status_candidatura text not null default 'triagem', -- triagem | aprovado | reprovado | teste | contratado | standby
  telefone_1 text,
  telefone_2 text,
  data_entrevista date,
  data_teste date,
  resultado_teste text,
  motivo_reprovacao text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rh_candidatos_status_check check (
    status_candidatura in ('triagem', 'aprovado', 'reprovado', 'teste', 'contratado', 'standby')
  )
);

create index if not exists idx_rh_candidatos_company_id on public.rh_candidatos(company_id);
create index if not exists idx_rh_candidatos_status on public.rh_candidatos(status_candidatura);
create index if not exists idx_rh_candidatos_nome on public.rh_candidatos(nome);

create table if not exists public.rh_candidato_contatos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references public.rh_candidatos(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  data_contato timestamptz not null default now(),
  canal text not null default 'telefone', -- telefone | whatsapp | presencial | outro
  resultado text,
  observacao text,
  proximo_passo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint rh_candidato_contatos_canal_check check (
    canal in ('telefone', 'whatsapp', 'presencial', 'outro')
  )
);

create index if not exists idx_rh_candidato_contatos_company on public.rh_candidato_contatos(company_id);
create index if not exists idx_rh_candidato_contatos_candidato on public.rh_candidato_contatos(candidato_id, data_contato desc);

alter table public.rh_candidatos enable row level security;
alter table public.rh_candidato_contatos enable row level security;

-- RLS: leitura e escrita apenas na empresa do usuário autenticado.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rh_candidatos'
      and policyname = 'rh_candidatos_company_isolation'
  ) then
    create policy rh_candidatos_company_isolation
      on public.rh_candidatos
      for all
      to authenticated
      using (
        company_id = (
          select p.company_id
          from public.profiles p
          where p.user_id = auth.uid()
          limit 1
        )
      )
      with check (
        company_id = (
          select p.company_id
          from public.profiles p
          where p.user_id = auth.uid()
          limit 1
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rh_candidato_contatos'
      and policyname = 'rh_candidato_contatos_company_isolation'
  ) then
    create policy rh_candidato_contatos_company_isolation
      on public.rh_candidato_contatos
      for all
      to authenticated
      using (
        company_id = (
          select p.company_id
          from public.profiles p
          where p.user_id = auth.uid()
          limit 1
        )
      )
      with check (
        company_id = (
          select p.company_id
          from public.profiles p
          where p.user_id = auth.uid()
          limit 1
        )
      );
  end if;
end $$;

commit;
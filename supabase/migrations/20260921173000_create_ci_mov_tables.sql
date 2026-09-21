-- Recria trilhas de auditoria do WF Programador quando ausentes no banco
-- Tabelas: ci_mov_funcionarios, ci_mov_equipamentos

begin;

create table if not exists public.ci_mov_funcionarios (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null,
  funcionario_id uuid null references public.employees(id) on delete set null,
  funcionario_nome text not null,
  matricula text null,
  equipe_origem text null,
  equipe_destino text null,
  funcao text null,
  status text null,
  data_admissao date null,
  obs text null,
  company_id uuid null references public.companies(id) on delete set null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.ci_mov_equipamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null,
  equipamento_id uuid null references public.equipamentos(id) on delete set null,
  frota text not null,
  tipo_equipamento text null,
  equipe_origem text null,
  equipe_destino text null,
  status text null,
  responsavel_destino text null,
  obs text null,
  company_id uuid null references public.companies(id) on delete set null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_mov_funcionarios_data on public.ci_mov_funcionarios(data);
create index if not exists idx_ci_mov_funcionarios_funcionario on public.ci_mov_funcionarios(funcionario_id);
create index if not exists idx_ci_mov_funcionarios_equipe_destino on public.ci_mov_funcionarios(equipe_destino);
create index if not exists idx_ci_mov_funcionarios_company on public.ci_mov_funcionarios(company_id);

create index if not exists idx_ci_mov_equipamentos_data on public.ci_mov_equipamentos(data);
create index if not exists idx_ci_mov_equipamentos_equipamento on public.ci_mov_equipamentos(equipamento_id);
create index if not exists idx_ci_mov_equipamentos_frota on public.ci_mov_equipamentos(frota);
create index if not exists idx_ci_mov_equipamentos_equipe_destino on public.ci_mov_equipamentos(equipe_destino);
create index if not exists idx_ci_mov_equipamentos_company on public.ci_mov_equipamentos(company_id);

alter table public.ci_mov_funcionarios enable row level security;
alter table public.ci_mov_equipamentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ci_mov_funcionarios' and policyname='auth_mov_funcionarios'
  ) then
    create policy auth_mov_funcionarios
      on public.ci_mov_funcionarios
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='ci_mov_equipamentos' and policyname='auth_mov_equipamentos'
  ) then
    create policy auth_mov_equipamentos
      on public.ci_mov_equipamentos
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

commit;

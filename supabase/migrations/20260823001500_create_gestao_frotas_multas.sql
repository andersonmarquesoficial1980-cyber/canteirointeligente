-- Gestão de Frotas: gerenciamento de multas operacionais
-- Objetivo: registrar multa, vincular frota/condutor e permitir acesso à CNH (employee_documentos)

create table if not exists public.gestao_frotas_multas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  equipamento_id uuid null references public.equipamentos(id) on delete set null,
  data_infracao date not null,
  hora_infracao time null,
  placa text not null,
  equipment_fleet text null,
  auto_infracao text null,
  local_infracao text null,
  descricao text null,
  valor numeric(12,2) not null default 0,
  status text not null default 'pendente',
  condutor_nome text null,
  condutor_employee_id uuid null references public.employees(id) on delete set null,
  observacoes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gestao_frotas_multas_company_data
  on public.gestao_frotas_multas(company_id, data_infracao desc, hora_infracao desc);

create index if not exists idx_gestao_frotas_multas_company_placa
  on public.gestao_frotas_multas(company_id, placa);

create index if not exists idx_gestao_frotas_multas_condutor_employee
  on public.gestao_frotas_multas(condutor_employee_id)
  where condutor_employee_id is not null;

alter table public.gestao_frotas_multas enable row level security;

drop policy if exists "gestao_frotas_multas_select" on public.gestao_frotas_multas;
create policy "gestao_frotas_multas_select"
on public.gestao_frotas_multas
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = gestao_frotas_multas.company_id
      )
  )
);

drop policy if exists "gestao_frotas_multas_insert" on public.gestao_frotas_multas;
create policy "gestao_frotas_multas_insert"
on public.gestao_frotas_multas
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = gestao_frotas_multas.company_id
      )
  )
);

drop policy if exists "gestao_frotas_multas_update" on public.gestao_frotas_multas;
create policy "gestao_frotas_multas_update"
on public.gestao_frotas_multas
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = gestao_frotas_multas.company_id
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
        or p.company_id = gestao_frotas_multas.company_id
      )
  )
);

drop policy if exists "gestao_frotas_multas_delete" on public.gestao_frotas_multas;
create policy "gestao_frotas_multas_delete"
on public.gestao_frotas_multas
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = gestao_frotas_multas.company_id
      )
  )
);

create or replace function public.touch_gestao_frotas_multas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_gestao_frotas_multas_updated_at on public.gestao_frotas_multas;
create trigger trg_touch_gestao_frotas_multas_updated_at
before update on public.gestao_frotas_multas
for each row execute function public.touch_gestao_frotas_multas_updated_at();

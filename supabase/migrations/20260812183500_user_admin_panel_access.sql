-- Controle por usuário do acesso ao Painel de Controle (Admin)
create table if not exists public.user_admin_panel_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  can_access_panel boolean not null default true,
  allowed_sections text[] not null default '{}',
  created_by uuid null references public.profiles(user_id),
  updated_by uuid null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_user_admin_panel_access_company_user
  on public.user_admin_panel_access(company_id, user_id);

alter table public.user_admin_panel_access enable row level security;

-- leitura para autenticados do mesmo tenant
drop policy if exists "user_admin_panel_access_select" on public.user_admin_panel_access;
create policy "user_admin_panel_access_select"
on public.user_admin_panel_access
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = user_admin_panel_access.company_id
  )
);

-- escrita apenas para admins
drop policy if exists "user_admin_panel_access_insert_admin" on public.user_admin_panel_access;
create policy "user_admin_panel_access_insert_admin"
on public.user_admin_panel_access
for insert
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_admin_panel_access_update_admin" on public.user_admin_panel_access;
create policy "user_admin_panel_access_update_admin"
on public.user_admin_panel_access
for update
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- trigger simples para updated_at
create or replace function public.set_user_admin_panel_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_admin_panel_access_updated_at on public.user_admin_panel_access;
create trigger trg_user_admin_panel_access_updated_at
before update on public.user_admin_panel_access
for each row
execute function public.set_user_admin_panel_access_updated_at();
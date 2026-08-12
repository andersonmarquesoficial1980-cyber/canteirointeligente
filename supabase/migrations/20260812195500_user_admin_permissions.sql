-- Permissões detalhadas por usuário no Painel de Controle (sem quebrar RBAC por role)
create table if not exists public.user_admin_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  resource text not null,
  action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint user_admin_permissions_unique unique (company_id, user_id, resource, action)
);

create index if not exists idx_user_admin_permissions_company_user
  on public.user_admin_permissions (company_id, user_id);

create index if not exists idx_user_admin_permissions_resource_action
  on public.user_admin_permissions (resource, action);

create or replace function public.touch_user_admin_permissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_admin_permissions_updated_at on public.user_admin_permissions;
create trigger trg_touch_user_admin_permissions_updated_at
before update on public.user_admin_permissions
for each row execute function public.touch_user_admin_permissions_updated_at();

alter table public.user_admin_permissions enable row level security;

drop policy if exists "user_admin_permissions_select" on public.user_admin_permissions;
create policy "user_admin_permissions_select"
on public.user_admin_permissions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = user_admin_permissions.company_id
      )
  )
);

drop policy if exists "user_admin_permissions_write" on public.user_admin_permissions;
create policy "user_admin_permissions_write"
on public.user_admin_permissions
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.company_id = user_admin_permissions.company_id
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
        or p.company_id = user_admin_permissions.company_id
      )
  )
);
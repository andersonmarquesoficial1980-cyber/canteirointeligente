-- Hardening: impedir exclusão de roles de sistema (is_system_role = true)
-- Data: 2026-08-12

create or replace function public.prevent_delete_system_admin_roles()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.is_system_role, false) then
    raise exception 'Roles de sistema não podem ser excluídos (%).', old.name
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_system_admin_roles on public.admin_roles;

create trigger trg_prevent_delete_system_admin_roles
before delete on public.admin_roles
for each row
execute function public.prevent_delete_system_admin_roles();

-- Fix 48h deadline bypass for Admin Roles
-- Contexto: usuários com admin_roles ativos (has_role(...,'admin') = true)
-- estavam bloqueados pela regra de 48h porque fn_can_bypass_diary_deadline
-- só avaliava profiles.role/perfil.

create or replace function public.fn_can_bypass_diary_deadline(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_perfil text;
begin
  if p_user_id is null then
    return true; -- service_role / SQL editor / system operations
  end if;

  -- Regra principal: se o backend já considera admin, também deve bypassar 48h
  if public.has_role(p_user_id, 'admin') then
    return true;
  end if;

  -- Fallback legado por profile (mantido por compatibilidade)
  select lower(coalesce(role, '')), lower(coalesce(perfil, ''))
    into v_role, v_perfil
  from public.profiles
  where user_id = p_user_id
  limit 1;

  return v_role in ('admin', 'superadmin')
      or v_perfil in ('admin', 'administrador', 'superadmin');
end;
$$;

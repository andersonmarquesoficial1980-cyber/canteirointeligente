-- Enforce 48h launch window for RDO and Equipment Diaries at database layer
-- Rule: non-admin users can only INSERT/UPDATE records whose date is between today and today-2 (São Paulo timezone)
-- Late records require explicit admin unlock in public.diary_unlock_requests

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

  select lower(coalesce(role, '')), lower(coalesce(perfil, ''))
    into v_role, v_perfil
  from public.profiles
  where user_id = p_user_id
  limit 1;

  return v_role in ('admin', 'superadmin')
      or v_perfil in ('admin', 'administrador', 'superadmin');
end;
$$;

create or replace function public.fn_assert_diary_deadline_48h(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_diary_date date,
  p_tipo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_sp date;
  v_in_window boolean;
  v_has_unlock boolean;
begin
  if p_diary_date is null then
    return;
  end if;

  if public.fn_can_bypass_diary_deadline(p_actor_user_id) then
    return;
  end if;

  v_today_sp := (now() at time zone 'America/Sao_Paulo')::date;
  v_in_window := p_diary_date between (v_today_sp - 2) and v_today_sp;

  if v_in_window then
    return;
  end if;

  select exists (
    select 1
    from public.diary_unlock_requests dur
    where dur.user_id = p_actor_user_id
      and dur.tipo = p_tipo
      and dur.data_liberada = p_diary_date
      and (
        dur.company_id is null
        or dur.company_id is not distinct from p_company_id
      )
  )
  into v_has_unlock;

  if not v_has_unlock then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Prazo de 48h expirado para %s em %s. Solicite liberação ao administrador.',
        p_tipo,
        to_char(p_diary_date, 'DD/MM/YYYY')
      ),
      hint = 'Admin deve cadastrar liberação na tela Configurações > Desbloqueio de Lançamentos.';
  end if;
end;
$$;

create or replace function public.trg_enforce_rdo_deadline_48h()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_assert_diary_deadline_48h(
    auth.uid(),
    new.company_id,
    new.data::date,
    'rdo'
  );
  return new;
end;
$$;

create or replace function public.trg_enforce_equipment_diary_deadline_48h()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_assert_diary_deadline_48h(
    auth.uid(),
    new.company_id,
    new.date::date,
    'equipamento'
  );
  return new;
end;
$$;

drop trigger if exists trg_enforce_rdo_deadline_48h on public.rdo_diarios;
create trigger trg_enforce_rdo_deadline_48h
before insert or update on public.rdo_diarios
for each row
execute function public.trg_enforce_rdo_deadline_48h();

drop trigger if exists trg_enforce_equipment_diary_deadline_48h on public.equipment_diaries;
create trigger trg_enforce_equipment_diary_deadline_48h
before insert or update on public.equipment_diaries
for each row
execute function public.trg_enforce_equipment_diary_deadline_48h();

-- Alinha comunicação da regra de prazo para 72h
-- Observação: a janela funcional já é 72h (hoje + 2 dias anteriores),
-- este patch ajusta a mensagem para evitar interpretação de 48h.

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

  -- 72h operacionais: D0, D-1 e D-2
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
        'Prazo de 72h expirado para %s em %s. Solicite liberação ao administrador.',
        p_tipo,
        to_char(p_diary_date, 'DD/MM/YYYY')
      ),
      hint = 'Admin deve cadastrar liberação na tela Configurações > Desbloqueio de Lançamentos.';
  end if;
end;
$$;
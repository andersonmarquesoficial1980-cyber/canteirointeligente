-- Hotfix: diário de equipamento NÃO pode ser bloqueado por checklist ausente.
-- Mantém: auto-vínculo por chave + bloqueio de duplicidade de diário enviado.

begin;

create or replace function public.equipment_diaries_guardrails_before()
returns trigger
language plpgsql
as $$
declare
  v_checklist_id uuid;
begin
  -- Auto-vínculo por chave quando não veio preop_checklist_id
  if new.preop_checklist_id is null
     and new.company_id is not null
     and new.date is not null
     and new.equipment_fleet is not null
     and new.period is not null then

    select c.id
      into v_checklist_id
    from public.equipment_preop_checklists c
    where c.company_id = new.company_id
      and c.date = new.date
      and c.equipment_fleet = new.equipment_fleet
      and c.period = new.period
    limit 1;

    if v_checklist_id is not null then
      new.preop_checklist_id := v_checklist_id;
    end if;
  end if;

  -- Regra de negócio (Anderson/Fremix): checklist é controle separado e não bloqueia envio do diário.
  -- O alerta/cobrança deve ocorrer em relatórios, sem impedir o lançamento operacional.

  -- Bloqueio de duplicidade para status ENVIADO na mesma chave
  if new.status = 'enviado'
     and new.company_id is not null
     and new.date is not null
     and new.equipment_fleet is not null
     and new.period is not null then

    if exists (
      select 1
      from public.equipment_diaries d
      where d.company_id = new.company_id
        and d.date = new.date
        and d.equipment_fleet = new.equipment_fleet
        and d.period = new.period
        and d.status = 'enviado'
        and (tg_op = 'INSERT' or d.id <> new.id)
    ) then
      raise exception using
        message = format(
          'Já existe diário ENVIADO para %s | %s | %s | %s',
          new.company_id, new.date, new.equipment_fleet, new.period
        ),
        errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

commit;

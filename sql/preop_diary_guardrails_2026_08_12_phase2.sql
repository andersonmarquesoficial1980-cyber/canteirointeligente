-- Phase 2: endurecimento para caminhões
-- Regra: diário ENVIADO de caminhão em status Trabalhando/Em Transporte precisa de checklist vinculado

begin;

create or replace function public.equipment_diaries_guardrails_before()
returns trigger
language plpgsql
as $$
declare
  v_checklist_id uuid;
  v_tipo text;
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

  -- Checklist obrigatório para caminhões em trabalho/transporte no envio
  if new.status = 'enviado' and new.preop_checklist_id is null then
    select coalesce(e.tipo, new.equipment_type)
      into v_tipo
    from public.equipamentos e
    where e.company_id = new.company_id
      and e.frota = new.equipment_fleet
    limit 1;

    if (
      coalesce(v_tipo, new.equipment_type, '') ilike '%CAMINH%'
      or coalesce(v_tipo, new.equipment_type, '') ilike '%CARRETA%'
      or coalesce(v_tipo, new.equipment_type, '') ilike '%BASCULANTE%'
    )
    and coalesce(new.work_status, '') in ('Trabalhando', 'Em Transporte') then
      raise exception using
        message = format(
          'Checklist obrigatório antes do envio do diário (%s | %s | %s | %s).',
          new.company_id, new.date, new.equipment_fleet, new.period
        ),
        errcode = '23514';
    end if;
  end if;

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

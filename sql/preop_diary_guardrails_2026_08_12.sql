-- Guardrails checklist pré-operação x diário de equipamento (Workflux)
-- Escopo: não destrutivo
-- 1) Backfill de vínculos faltantes (duas pontas)
-- 2) Trigger para auto-vincular checklist por chave (company/date/fleet/period)
-- 3) Trigger para evitar duplicidade de diário ENVIADO na mesma chave
-- 4) Trigger para manter checklist.diary_id sincronizado

begin;

-- 1A) Backfill checklist.diary_id quando diário já aponta preop_checklist_id
update public.equipment_preop_checklists c
set diary_id = d.id,
    updated_at = now()
from public.equipment_diaries d
where d.preop_checklist_id = c.id
  and (c.diary_id is null or c.diary_id is distinct from d.id);

-- 1B) Backfill diário.preop_checklist_id por chave (somente quando nulo)
--     Usa a chave única já existente no checklist:
--     (company_id, equipment_fleet, date, period)
update public.equipment_diaries d
set preop_checklist_id = c.id
from public.equipment_preop_checklists c
where d.preop_checklist_id is null
  and d.company_id = c.company_id
  and d.equipment_fleet = c.equipment_fleet
  and d.date = c.date
  and d.period = c.period;

-- 2) BEFORE: auto-vincula checklist por chave e bloqueia duplicidade de enviado
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

drop trigger if exists trg_equipment_diaries_guardrails_before on public.equipment_diaries;
create trigger trg_equipment_diaries_guardrails_before
before insert or update of status, company_id, date, equipment_fleet, period, preop_checklist_id
on public.equipment_diaries
for each row
execute function public.equipment_diaries_guardrails_before();

-- 3) AFTER: sincroniza checklist.diary_id com diário.preop_checklist_id
create or replace function public.sync_preop_checklist_diary_id_after_diary()
returns trigger
language plpgsql
as $$
begin
  -- Desvincula checklist antigo (se mudou)
  if tg_op = 'UPDATE'
     and old.preop_checklist_id is not null
     and (new.preop_checklist_id is distinct from old.preop_checklist_id) then
    update public.equipment_preop_checklists
       set diary_id = null,
           updated_at = now()
     where id = old.preop_checklist_id
       and diary_id = new.id;
  end if;

  -- Vincula checklist atual
  if new.preop_checklist_id is not null then
    update public.equipment_preop_checklists
       set diary_id = new.id,
           updated_at = now()
     where id = new.preop_checklist_id
       and (diary_id is null or diary_id is distinct from new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_preop_checklist_diary_id_after_diary on public.equipment_diaries;
create trigger trg_sync_preop_checklist_diary_id_after_diary
after insert or update of preop_checklist_id
on public.equipment_diaries
for each row
execute function public.sync_preop_checklist_diary_id_after_diary();

commit;

-- WF Checklist (fase 2): módulo próprio + horário do envio confiável (servidor)
-- Aditivo e idempotente. Não altera permissões de usuários existentes.

alter table public.user_permissions
  add column if not exists modulo_checklist boolean not null default false;

insert into public.company_modules (company_id, modulo, ativo)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'checklist', true)
on conflict (company_id, modulo) do nothing;

-- submitted_at passa a ser sempre o relógio do servidor no INSERT e imutável no UPDATE
-- (reenvio/correção não "reseta" o horário e esconde atraso).
create or replace function public.preop_checklist_server_time()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.submitted_at := now();
  elsif tg_op = 'UPDATE' then
    new.submitted_at := old.submitted_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_preop_checklist_server_time on public.equipment_preop_checklists;
create trigger trg_preop_checklist_server_time
  before insert or update on public.equipment_preop_checklists
  for each row execute function public.preop_checklist_server_time();

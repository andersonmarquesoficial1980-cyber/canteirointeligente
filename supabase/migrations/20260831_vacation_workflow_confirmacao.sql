-- Workflux RH/Férias: workflow de programação + confirmação prévia
-- Objetivo: diferenciar "programar" de "confirmar" antes da data de início

begin;

alter table public.vacation_records
  add column if not exists workflow_status text not null default 'programada',
  add column if not exists reminder_sent_at timestamptz null,
  add column if not exists confirmado_em timestamptz null,
  add column if not exists confirmado_por_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists confirmacao_observacao text null;

alter table public.vacation_records
  drop constraint if exists vacation_records_workflow_status_check;

alter table public.vacation_records
  add constraint vacation_records_workflow_status_check
  check (workflow_status in ('programada', 'aguardando_confirmacao', 'confirmada', 'nao_confirmada'));

create index if not exists idx_vacation_records_workflow_status
  on public.vacation_records (company_id, workflow_status, data_inicio);

commit;

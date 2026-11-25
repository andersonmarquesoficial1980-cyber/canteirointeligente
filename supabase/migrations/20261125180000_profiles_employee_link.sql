-- WF Checklist: vínculo usuário (profiles) -> funcionário (employees), para restringir
-- o checklist aos equipamentos em que o operador está habilitado (equipment_type_operators).
-- Aditivo. Nenhum dado existente é alterado.
alter table public.profiles
  add column if not exists employee_id uuid null references public.employees(id) on delete set null;
create unique index if not exists profiles_employee_id_key on public.profiles(employee_id) where employee_id is not null;

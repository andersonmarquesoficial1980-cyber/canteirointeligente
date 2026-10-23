-- Histórico de férias informado manualmente. Não altera saldos/estado dos registros legados.
-- Implantar somente após preflight, teste PostgreSQL e autorização para DDL em produção.
begin;

create table if not exists public.vacation_manual_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  data_inicio date not null,
  data_fim date not null,
  dias integer generated always as (data_fim - data_inicio + 1) stored,
  tipo text not null check (tipo in ('individual', 'coletiva')),
  periodo_inicio date,
  periodo_fim date,
  fonte text not null check (length(btrim(fonte)) >= 8),
  observacao text,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint vacation_manual_history_datas check (data_inicio <= data_fim),
  constraint vacation_manual_history_periodo_par check ((periodo_inicio is null) = (periodo_fim is null)),
  constraint vacation_manual_history_periodo_ordem check (periodo_inicio is null or periodo_fim >= periodo_inicio),
  constraint vacation_manual_history_unico unique (company_id, employee_id, data_inicio, data_fim, tipo)
);
create index if not exists vacation_manual_history_employee_idx on public.vacation_manual_history(company_id, employee_id, data_inicio desc);
alter table public.vacation_manual_history enable row level security;

-- Leituras limitadas a usuários de Gestão de Pessoas da própria empresa.
drop policy if exists vacation_manual_history_select on public.vacation_manual_history;
create policy vacation_manual_history_select on public.vacation_manual_history for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.company_id = vacation_manual_history.company_id
      and exists (
        select 1 from public.user_permissions u
        where u.user_id = p.user_id and u.company_id = p.company_id
          and (u.modulo_gestao_pessoas is true or u.modulo_rh is true)
      )
  )
);
revoke all on public.vacation_manual_history from public, anon, authenticated;
grant select on public.vacation_manual_history to authenticated;

create or replace function public.rh_ferias_registrar_gozo_passado(
  p_company_id uuid, p_employee_id uuid, p_inicio date, p_fim date,
  p_tipo text, p_fonte text, p_observacao text default null,
  p_periodo_inicio date default null, p_periodo_fim date default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_admissao text;
  v_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.user_id = v_actor and p.company_id = p_company_id
      and exists (
        select 1 from public.user_permissions u where u.user_id = v_actor
          and u.company_id = p_company_id and u.modulo_rh is true
      )
  ) then raise exception 'Sem permissão de Gestão de Pessoas nesta empresa' using errcode = '42501'; end if;

  select e.data_admissao into v_admissao from public.employees e
   where e.id = p_employee_id and e.company_id = p_company_id
     and (e.origem is null or e.origem <> 'TERCEIRO')
   for update;
  if not found then raise exception 'Funcionário próprio não encontrado nesta empresa'; end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim >= current_date then
    raise exception 'Informe um gozo passado com datas válidas'; end if;
  if p_tipo not in ('individual','coletiva') or p_tipo is null then
    raise exception 'Tipo de férias inválido'; end if;
  if length(btrim(coalesce(p_fonte,''))) < 8 then
    raise exception 'Informe a fonte da conferência (mínimo 8 caracteres)'; end if;
  if (p_periodo_inicio is null) <> (p_periodo_fim is null)
    or (p_periodo_inicio is not null and p_periodo_fim < p_periodo_inicio) then
    raise exception 'Informe as duas datas aquisitivas, ou nenhuma'; end if;
  if v_admissao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(to_date(v_admissao, 'YYYY-MM-DD'), 'YYYY-MM-DD') = v_admissao
    and p_inicio < v_admissao::date then
    raise exception 'Gozo anterior à admissão'; end if;
  if exists (
    select 1 from public.vacation_manual_history h where h.employee_id = p_employee_id
      and h.company_id = p_company_id and p_inicio <= h.data_fim and p_fim >= h.data_inicio
  ) or exists (
    select 1 from public.vacation_records r where r.employee_id = p_employee_id
      and r.company_id = p_company_id and r.workflow_status <> 'nao_confirmada'
      and p_inicio <= r.data_fim and p_fim >= r.data_inicio
  ) then raise exception 'Já existem férias neste intervalo; reconcilie antes de lançar'; end if;

  insert into public.vacation_manual_history(
    company_id, employee_id, data_inicio, data_fim, tipo,
    periodo_inicio, periodo_fim, fonte, observacao, criado_por
  ) values (
    p_company_id, p_employee_id, p_inicio, p_fim, p_tipo,
    p_periodo_inicio, p_periodo_fim, btrim(p_fonte), nullif(btrim(p_observacao), ''), v_actor
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.rh_ferias_registrar_gozo_passado(uuid,uuid,date,date,text,text,text,date,date) from public, anon;
grant execute on function public.rh_ferias_registrar_gozo_passado(uuid,uuid,date,date,text,text,text,date,date) to authenticated;
commit;

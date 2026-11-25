-- Sincronização única de férias: vacation_records é a fonte; pendência "Dar férias" e employees.status derivam dela.
begin;

create or replace function public.rh_ferias_hoje_br() returns date language sql stable as
$$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- 1) Baixa pendências "Dar férias" abertas quando existe programação válida (qualquer tela que grave).
create or replace function public.trg_vacation_records_baixa_pendencia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.workflow_status in ('programada','aguardando_confirmacao','confirmada') and new.data_fim >= public.rh_ferias_hoje_br() then
    update public.rh_pendencias_funcionario p
       set status = 'aprovada', resolved_at = now(),
           parecer_gp = 'Baixa automática: férias programadas de ' || to_char(new.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(new.data_fim,'DD/MM/YYYY') || ' (' || new.dias || 'd)'
     where p.employee_id = new.employee_id and p.company_id = new.company_id
       and p.tipo = 'outros' and p.payload->>'subtipo' = 'ferias' and p.status in ('aberta','em_analise');
  end if;
  return new;
end $$;

drop trigger if exists trg_vacation_records_baixa_pendencia on public.vacation_records;
create trigger trg_vacation_records_baixa_pendencia
after insert or update of workflow_status, data_inicio, data_fim on public.vacation_records
for each row execute function public.trg_vacation_records_baixa_pendencia();

-- 2) employees.status acompanha as férias vigentes (ativo <-> ferias). Não toca afastado/demitido.
create or replace function public.rh_ferias_sync_status(p_employee uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare hoje date := public.rh_ferias_hoje_br(); n1 int; n2 int;
begin
  update public.employees e set status = 'ferias'
   where e.status = 'ativo' and (p_employee is null or e.id = p_employee)
     and exists (select 1 from public.vacation_records r where r.employee_id = e.id
                  and r.workflow_status in ('programada','aguardando_confirmacao','confirmada')
                  and r.data_inicio <= hoje and r.data_fim >= hoje);
  get diagnostics n1 = row_count;
  update public.employees e set status = 'ativo'
   where e.status = 'ferias' and (p_employee is null or e.id = p_employee)
     and not exists (select 1 from public.vacation_records r where r.employee_id = e.id
                  and r.workflow_status in ('programada','aguardando_confirmacao','confirmada')
                  and r.data_inicio <= hoje and r.data_fim >= hoje)
     and exists (select 1 from public.vacation_records r where r.employee_id = e.id
                  and r.workflow_status in ('programada','aguardando_confirmacao','confirmada') and r.data_fim < hoje);
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;

create or replace function public.trg_vacation_records_sync_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.rh_ferias_sync_status(coalesce(new.employee_id, old.employee_id));
  return null;
end $$;

drop trigger if exists trg_vacation_records_sync_status on public.vacation_records;
create trigger trg_vacation_records_sync_status
after insert or update or delete on public.vacation_records
for each row execute function public.trg_vacation_records_sync_status();

revoke all on function public.rh_ferias_sync_status(uuid) from public, anon, authenticated;
revoke all on function public.trg_vacation_records_baixa_pendencia() from public, anon, authenticated;
revoke all on function public.trg_vacation_records_sync_status() from public, anon, authenticated;

-- 3) Rotina diária (03:05 BRT) para virar o status na data de início/fim.
select cron.unschedule(jobid) from cron.job where jobname = 'rh_ferias_sync_status';
select cron.schedule('rh_ferias_sync_status', '5 6 * * *', $$select public.rh_ferias_sync_status()$$);

-- 4) Backfill: baixa as pendências que já têm programação e alinha o status de hoje.
update public.rh_pendencias_funcionario p
   set status='aprovada', resolved_at=now(), parecer_gp='Baixa automática: férias já programadas em vacation_records'
 where p.tipo='outros' and p.payload->>'subtipo'='ferias' and p.status in ('aberta','em_analise')
   and exists (select 1 from public.vacation_records r where r.employee_id=p.employee_id and r.company_id=p.company_id
               and r.workflow_status in ('programada','aguardando_confirmacao','confirmada') and r.data_fim >= public.rh_ferias_hoje_br());
select public.rh_ferias_sync_status();

commit;

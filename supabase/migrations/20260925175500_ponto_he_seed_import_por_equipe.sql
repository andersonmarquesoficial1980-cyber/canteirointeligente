begin;

create or replace function public.fn_ponto_he_pdf_seed_job_team(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ponto_he_import_jobs%rowtype;
  v_uid uuid := auth.uid();
  v_seeded integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
    into v_job
  from public.ponto_he_import_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job % não encontrado', p_job_id;
  end if;

  if not public.fn_ponto_he_can_write_company(v_job.company_id) then
    raise exception 'Sem permissão para este job';
  end if;

  if public.fn_ponto_he_competencia_fechada(v_job.company_id, v_job.competencia) then
    raise exception 'Competência % está fechada. Reabra para importar.', v_job.competencia;
  end if;

  if nullif(trim(coalesce(v_job.equipe_nome, '')), '') is null then
    raise exception 'Selecione uma equipe antes de anexar PDF para usar seed por equipe.';
  end if;

  with src as (
    select
      e.id as employee_id,
      e.name as fonte_nome,
      e.matricula as fonte_matricula,
      e.equipe as equipe_nome,
      e.role as funcao_nome
    from public.employees e
    where e.company_id = v_job.company_id
      and coalesce(e.status,'ativo') = 'ativo'
      and trim(coalesce(e.equipe, '')) = trim(v_job.equipe_nome)
  ), ins as (
    insert into public.ponto_he_import_colaboradores (
      company_id,
      job_id,
      employee_id,
      fonte_nome,
      fonte_matricula,
      equipe_nome,
      funcao_nome,
      periodo_inicio,
      periodo_fim,
      credito_horas,
      debito_horas,
      horas_normais,
      he_70_horas,
      he_100_horas,
      adicional_noturno_horas,
      total_horas_extras_horas,
      mapping_status,
      mapping_reason,
      source_payload
    )
    select
      v_job.company_id,
      p_job_id,
      s.employee_id,
      s.fonte_nome,
      s.fonte_matricula,
      s.equipe_nome,
      s.funcao_nome,
      v_job.competencia,
      (date_trunc('month', v_job.competencia)::date + interval '1 month - 1 day')::date,
      0,0,0,0,0,0,0,
      'ok',
      null,
      jsonb_build_object('source','seed_job_team','seed_at',now(),'seed_by',v_uid,'job_id',p_job_id)
    from src s
    on conflict (company_id, job_id, fonte_nome)
    do update set
      employee_id = excluded.employee_id,
      fonte_matricula = excluded.fonte_matricula,
      equipe_nome = excluded.equipe_nome,
      funcao_nome = excluded.funcao_nome,
      mapping_status = 'ok',
      mapping_reason = null,
      source_payload = coalesce(public.ponto_he_import_colaboradores.source_payload,'{}'::jsonb) || excluded.source_payload,
      updated_at = now()
    returning 1
  )
  select count(*) into v_seeded from ins;

  update public.ponto_he_import_jobs
     set status = 'parseado',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'seed_team_at', now(),
           'seed_team_count', v_seeded,
           'seed_team_name', v_job.equipe_nome
         )
   where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'team', v_job.equipe_nome,
    'seeded', v_seeded,
    'status', 'parseado'
  );
end;
$$;

grant execute on function public.fn_ponto_he_pdf_seed_job_team(uuid) to authenticated;

commit;

begin;

create or replace function public.fn_ponto_he_pdf_apply(
  p_job_id uuid,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_uid uuid := auth.uid();
  v_nao_mapeados integer := 0;
  v_upsert_resumo integer := 0;
  v_ins_batidas integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_job
  from public.ponto_he_import_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception 'Job % não encontrado', p_job_id;
  end if;

  if not public.fn_ponto_he_can_write_company(v_job.company_id) then
    raise exception 'Sem permissão para aplicar este job';
  end if;

  if public.fn_ponto_he_competencia_fechada(v_job.company_id, v_job.competencia) then
    raise exception 'Competência % está fechada. Reabra para aplicar importação.', v_job.competencia;
  end if;

  select count(*) into v_nao_mapeados
  from public.ponto_he_import_colaboradores c
  where c.company_id = v_job.company_id
    and c.job_id = p_job_id
    and c.employee_id is null;

  if v_nao_mapeados > 0 then
    raise exception 'Existem % colaboradores sem vínculo. Corrija antes do apply.', v_nao_mapeados;
  end if;

  update public.ponto_he_import_jobs
     set status = 'aplicando'
   where id = p_job_id;

  with batidas_calc as (
    select
      b.colaborador_id,
      (
        case
          when coalesce(b.entrada1, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and coalesce(b.saida1, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and b.entrada1 <> '00:00'
           and b.saida1 <> '00:00'
          then (
            (
              (
                (split_part(b.saida1, ':', 1)::int * 60 + split_part(b.saida1, ':', 2)::int)
                - (split_part(b.entrada1, ':', 1)::int * 60 + split_part(b.entrada1, ':', 2)::int)
                + 1440
              ) % 1440
            ) / 60.0
          )
          else 0
        end
      ) + (
        case
          when coalesce(b.entrada2, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and coalesce(b.saida2, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and b.entrada2 <> '00:00'
           and b.saida2 <> '00:00'
          then (
            (
              (
                (split_part(b.saida2, ':', 1)::int * 60 + split_part(b.saida2, ':', 2)::int)
                - (split_part(b.entrada2, ':', 1)::int * 60 + split_part(b.entrada2, ':', 2)::int)
                + 1440
              ) % 1440
            ) / 60.0
          )
          else 0
        end
      ) as horas_dia
    from public.ponto_he_import_batidas b
    where b.company_id = v_job.company_id
      and b.job_id = p_job_id
  ), batidas_agg as (
    select
      bc.colaborador_id,
      round(sum(least(bc.horas_dia, 8))::numeric, 2) as horas_normais_calc,
      round(sum(greatest(bc.horas_dia - 8, 0))::numeric, 2) as credito_calc
    from batidas_calc bc
    group by bc.colaborador_id
  ), src as (
    select
      c.company_id,
      v_job.competencia as competencia,
      c.periodo_inicio,
      c.periodo_fim,
      c.employee_id,
      c.fonte_nome as colaborador_nome,
      coalesce(c.equipe_nome, e.equipe) as equipe_nome,
      concat('job:', p_job_id::text) as fonte_pdf,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then coalesce(ba.credito_calc, 0)
        else c.credito_horas
      end as credito_horas,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then 0
        else c.debito_horas
      end as debito_horas,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then coalesce(ba.horas_normais_calc, 0)
        else c.horas_normais
      end as horas_normais,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then coalesce(ba.credito_calc, 0)
        else c.he_70_horas
      end as he_70_horas,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then 0
        else c.he_100_horas
      end as he_100_horas,

      c.adicional_noturno_horas,

      case
        when (
          (coalesce(c.credito_horas,0)=0 and coalesce(c.debito_horas,0)=0 and coalesce(c.horas_normais,0)=0
           and coalesce(c.he_70_horas,0)=0 and coalesce(c.he_100_horas,0)=0 and coalesce(c.total_horas_extras_horas,0)=0)
          or coalesce(c.horas_normais,0) < 0
          or coalesce(c.total_horas_extras_horas,0) < 0
          or coalesce(c.he_70_horas,0) < 0
          or coalesce(c.he_100_horas,0) < 0
          or coalesce(c.credito_horas,0) < 0
          or coalesce(c.debito_horas,0) < 0
        )
        then coalesce(ba.credito_calc, 0)
        else c.total_horas_extras_horas
      end as total_horas_extras_horas,

      jsonb_build_object(
        'source', 'pdf_import',
        'job_id', p_job_id,
        'applied_at', now(),
        'applied_by', v_uid,
        'mapping_status', c.mapping_status,
        'source_payload', c.source_payload
      ) as payload
    from public.ponto_he_import_colaboradores c
    left join public.employees e
      on e.id = c.employee_id and e.company_id = c.company_id
    left join batidas_agg ba
      on ba.colaborador_id = c.id
    where c.company_id = v_job.company_id
      and c.job_id = p_job_id
      and c.employee_id is not null
  ), upserted as (
    insert into public.ponto_he_resumo_mensal (
      company_id, competencia, periodo_inicio, periodo_fim,
      employee_id, colaborador_nome, equipe_nome, fonte_pdf,
      credito_horas, debito_horas, horas_normais,
      he_70_horas, he_100_horas, adicional_noturno_horas, total_horas_extras_horas,
      payload
    )
    select
      company_id, competencia, periodo_inicio, periodo_fim,
      employee_id, colaborador_nome, equipe_nome, fonte_pdf,
      credito_horas, debito_horas, horas_normais,
      he_70_horas, he_100_horas, adicional_noturno_horas, total_horas_extras_horas,
      payload
    from src
    on conflict (company_id, competencia, colaborador_nome)
    do update set
      employee_id = excluded.employee_id,
      periodo_inicio = excluded.periodo_inicio,
      periodo_fim = excluded.periodo_fim,
      equipe_nome = excluded.equipe_nome,
      fonte_pdf = excluded.fonte_pdf,
      credito_horas = excluded.credito_horas,
      debito_horas = excluded.debito_horas,
      horas_normais = excluded.horas_normais,
      he_70_horas = excluded.he_70_horas,
      he_100_horas = excluded.he_100_horas,
      adicional_noturno_horas = excluded.adicional_noturno_horas,
      total_horas_extras_horas = excluded.total_horas_extras_horas,
      payload = coalesce(public.ponto_he_resumo_mensal.payload, '{}'::jsonb) || excluded.payload,
      updated_at = now()
    returning 1
  )
  select count(*) into v_upsert_resumo from upserted;

  with base as (
    select
      b.company_id,
      c.employee_id as staff_id,
      b.data,
      b.entrada1,
      b.saida1,
      b.entrada2,
      b.saida2
    from public.ponto_he_import_batidas b
    join public.ponto_he_import_colaboradores c
      on c.id = b.colaborador_id
     and c.company_id = b.company_id
    where b.company_id = v_job.company_id
      and b.job_id = p_job_id
      and c.employee_id is not null
  ), marks as (
    select company_id, staff_id, data, 'entrada'::text as tipo, entrada1 as hora from base
    union all
    select company_id, staff_id, data, 'saida'::text as tipo, saida1 as hora from base
    union all
    select company_id, staff_id, data, 'entrada'::text as tipo, entrada2 as hora from base
    union all
    select company_id, staff_id, data, 'saida'::text as tipo, saida2 as hora from base
  ), valid_marks as (
    select
      company_id,
      staff_id,
      data,
      tipo,
      case
        when hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and hora <> '00:00' then (hora || ':00')::time
        else null
      end as hora
    from marks
  ), ins as (
    insert into public.ponto_registros (
      staff_id, tipo, data, hora, turno, company_id, metodo
    )
    select
      vm.staff_id,
      vm.tipo,
      vm.data,
      vm.hora,
      null,
      vm.company_id,
      'import_pdf_pontomais'
    from valid_marks vm
    where vm.hora is not null
      and not exists (
        select 1
        from public.ponto_registros pr
        where pr.company_id = vm.company_id
          and pr.staff_id = vm.staff_id
          and pr.data = vm.data
          and pr.hora = vm.hora
          and pr.tipo = vm.tipo
      )
    returning 1
  )
  select count(*) into v_ins_batidas from ins;

  update public.ponto_he_import_jobs
     set status = 'aplicado',
         observacao = coalesce(p_observacao, observacao),
         applied_at = now(),
         applied_by = v_uid,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'applied_at', now(),
           'applied_by', v_uid,
           'upsert_resumo', v_upsert_resumo,
           'batidas_inseridas', v_ins_batidas
         )
   where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'status', 'aplicado',
    'upsert_resumo', v_upsert_resumo,
    'batidas_inseridas', v_ins_batidas
  );
exception
  when others then
    update public.ponto_he_import_jobs
       set status = 'erro',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_error', sqlerrm, 'error_at', now())
     where id = p_job_id;
    raise;
end;
$$;

grant execute on function public.fn_ponto_he_pdf_apply(uuid, text) to authenticated;

commit;

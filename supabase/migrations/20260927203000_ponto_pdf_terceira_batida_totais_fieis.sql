begin;

alter table public.ponto_he_import_batidas
  add column if not exists entrada3 text null,
  add column if not exists saida3 text null;

create or replace function public.fn_ponto_he_pdf_stage_payload(
  p_job_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ponto_he_import_jobs%rowtype;
  v_uid uuid := auth.uid();
  v_col jsonb;
  v_bat jsonb;
  v_col_id uuid;
  v_total_colabs integer := 0;
  v_total_batidas integer := 0;

  v_nome text;
  v_matricula text;
  v_equipe text;
  v_funcao text;
  v_periodo_inicio date;
  v_periodo_fim date;

  v_credito numeric(10,2);
  v_debito numeric(10,2);
  v_horas_normais numeric(10,2);
  v_he70 numeric(10,2);
  v_he100 numeric(10,2);
  v_ad_not numeric(10,2);
  v_he_total numeric(10,2);

  v_employee_id uuid;
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
    raise exception 'Sem permissão para este job';
  end if;

  if public.fn_ponto_he_competencia_fechada(v_job.company_id, v_job.competencia) then
    raise exception 'Competência % está fechada. Reabra para importar.', v_job.competencia;
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload inválido (esperado objeto JSON)';
  end if;

  if jsonb_typeof(coalesce(p_payload->'colaboradores', '[]'::jsonb)) <> 'array' then
    raise exception 'Payload inválido: campo colaboradores deve ser array';
  end if;

  for v_col in
    select value
    from jsonb_array_elements(coalesce(p_payload->'colaboradores', '[]'::jsonb))
  loop
    v_nome := nullif(trim(coalesce(v_col->>'nome', '')), '');
    if v_nome is null then
      continue;
    end if;

    v_matricula := nullif(trim(coalesce(v_col->>'matricula', '')), '');
    v_equipe := nullif(trim(coalesce(v_col->>'equipe', '')), '');
    v_funcao := nullif(trim(coalesce(v_col->>'funcao', '')), '');

    v_periodo_inicio := coalesce(nullif(v_col->>'periodo_inicio', '')::date, v_job.competencia);
    v_periodo_fim := coalesce(
      nullif(v_col->>'periodo_fim', '')::date,
      (date_trunc('month', v_job.competencia)::date + interval '1 month - 1 day')::date
    );

    v_credito := coalesce((v_col->>'credito_horas')::numeric, 0);
    v_debito := coalesce((v_col->>'debito_horas')::numeric, 0);
    v_horas_normais := coalesce((v_col->>'horas_normais')::numeric, 0);
    v_he70 := coalesce((v_col->>'he_70_horas')::numeric, 0);
    v_he100 := coalesce((v_col->>'he_100_horas')::numeric, 0);
    v_ad_not := coalesce((v_col->>'adicional_noturno_horas')::numeric, 0);
    v_he_total := coalesce((v_col->>'total_horas_extras_horas')::numeric, (v_he70 + v_he100));

    v_employee_id := null;

    if v_matricula is not null then
      select e.id
        into v_employee_id
      from public.employees e
      where e.company_id = v_job.company_id
        and regexp_replace(lower(coalesce(e.matricula,'')), '[^0-9a-z]', '', 'g') = regexp_replace(lower(v_matricula), '[^0-9a-z]', '', 'g')
      order by e.id
      limit 1;
    end if;

    if v_employee_id is null then
      select e.id
        into v_employee_id
      from public.employees e
      where e.company_id = v_job.company_id
        and lower(trim(coalesce(e.name,''))) = lower(trim(v_nome))
      order by e.id
      limit 1;
    end if;

    if v_employee_id is null then
      with src as (
        select array_remove(regexp_split_to_array(regexp_replace(lower(v_nome), '[^a-z0-9 ]', '', 'g'), ' +'), '') as t
      )
      select e.id
        into v_employee_id
      from public.employees e
      cross join src
      cross join lateral (
        select array_remove(regexp_split_to_array(regexp_replace(lower(coalesce(e.name, '')), '[^a-z0-9 ]', '', 'g'), ' +'), '') as te
      ) norm
      where e.company_id = v_job.company_id
        and coalesce(array_length(src.t, 1), 0) >= 3
        and coalesce(array_length(norm.te, 1), 0) >= 3
        and norm.te[1] = src.t[1]
        and norm.te[2] = src.t[2]
        and norm.te[array_length(norm.te, 1)] = src.t[array_length(src.t, 1)]
        and left(norm.te[3], 1) = left(src.t[3], 1)
      order by e.id
      limit 1;
    end if;

    insert into public.ponto_he_import_colaboradores (
      company_id, job_id, employee_id, fonte_nome, fonte_matricula,
      equipe_nome, funcao_nome, periodo_inicio, periodo_fim,
      credito_horas, debito_horas, horas_normais,
      he_70_horas, he_100_horas, adicional_noturno_horas, total_horas_extras_horas,
      mapping_status, mapping_reason, source_payload
    ) values (
      v_job.company_id, p_job_id, v_employee_id, v_nome, v_matricula,
      v_equipe, v_funcao, v_periodo_inicio, v_periodo_fim,
      v_credito, v_debito, v_horas_normais,
      v_he70, v_he100, v_ad_not, v_he_total,
      case when v_employee_id is not null then 'ok' else 'pendente' end,
      case when v_employee_id is not null then null else 'sem_vinculo' end,
      coalesce(v_col, '{}'::jsonb)
    )
    on conflict (company_id, job_id, fonte_nome)
    do update set
      employee_id = excluded.employee_id,
      fonte_matricula = excluded.fonte_matricula,
      equipe_nome = excluded.equipe_nome,
      funcao_nome = excluded.funcao_nome,
      periodo_inicio = excluded.periodo_inicio,
      periodo_fim = excluded.periodo_fim,
      credito_horas = excluded.credito_horas,
      debito_horas = excluded.debito_horas,
      horas_normais = excluded.horas_normais,
      he_70_horas = excluded.he_70_horas,
      he_100_horas = excluded.he_100_horas,
      adicional_noturno_horas = excluded.adicional_noturno_horas,
      total_horas_extras_horas = excluded.total_horas_extras_horas,
      mapping_status = excluded.mapping_status,
      mapping_reason = excluded.mapping_reason,
      source_payload = excluded.source_payload,
      updated_at = now()
    returning id into v_col_id;

    v_total_colabs := v_total_colabs + 1;

    delete from public.ponto_he_import_batidas
    where company_id = v_job.company_id
      and job_id = p_job_id
      and colaborador_id = v_col_id;

    if jsonb_typeof(coalesce(v_col->'batidas', '[]'::jsonb)) = 'array' then
      for v_bat in
        select value
        from jsonb_array_elements(coalesce(v_col->'batidas', '[]'::jsonb))
      loop
        insert into public.ponto_he_import_batidas (
          company_id, job_id, colaborador_id, data,
          entrada1, saida1, entrada2, saida2, entrada3, saida3,
          horas_trabalhadas_h, he_dia_h, linha_origem, source_payload
        ) values (
          v_job.company_id,
          p_job_id,
          v_col_id,
          nullif(v_bat->>'data', '')::date,
          nullif(v_bat->>'entrada1', ''),
          nullif(v_bat->>'saida1', ''),
          nullif(v_bat->>'entrada2', ''),
          nullif(v_bat->>'saida2', ''),
          nullif(v_bat->>'entrada3', ''),
          nullif(v_bat->>'saida3', ''),
          (v_bat->>'horas_trabalhadas_h')::numeric,
          (v_bat->>'he_dia_h')::numeric,
          nullif(v_bat->>'linha_origem', ''),
          coalesce(v_bat, '{}'::jsonb)
        )
        on conflict (company_id, job_id, colaborador_id, data)
        do update set
          entrada1 = excluded.entrada1,
          saida1 = excluded.saida1,
          entrada2 = excluded.entrada2,
          saida2 = excluded.saida2,
          entrada3 = excluded.entrada3,
          saida3 = excluded.saida3,
          horas_trabalhadas_h = excluded.horas_trabalhadas_h,
          he_dia_h = excluded.he_dia_h,
          linha_origem = excluded.linha_origem,
          source_payload = excluded.source_payload;

        v_total_batidas := v_total_batidas + 1;
      end loop;
    end if;
  end loop;

  update public.ponto_he_import_jobs
    set status = 'parseado',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'parser_staged_at', now(),
          'parser_staged_by', v_uid,
          'parser_colaboradores', v_total_colabs,
          'parser_batidas', v_total_batidas
        )
  where id = p_job_id;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'staged_colaboradores', v_total_colabs,
    'staged_batidas', v_total_batidas,
    'status', 'parseado'
  );
end;
$$;

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
          then (
            case
              when (b.saida1::time - b.entrada1::time) >= interval '0'
              then extract(epoch from (b.saida1::time - b.entrada1::time)) / 3600.0
              else extract(epoch from ((b.saida1::time + interval '24 hour') - b.entrada1::time)) / 3600.0
            end
          )
          else 0
        end
      ) + (
        case
          when coalesce(b.entrada2, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and coalesce(b.saida2, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          then (
            case
              when (b.saida2::time - b.entrada2::time) >= interval '0'
              then extract(epoch from (b.saida2::time - b.entrada2::time)) / 3600.0
              else extract(epoch from ((b.saida2::time + interval '24 hour') - b.entrada2::time)) / 3600.0
            end
          )
          else 0
        end
      ) + (
        case
          when coalesce(b.entrada3, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           and coalesce(b.saida3, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          then (
            case
              when (b.saida3::time - b.entrada3::time) >= interval '0'
              then extract(epoch from (b.saida3::time - b.entrada3::time)) / 3600.0
              else extract(epoch from ((b.saida3::time + interval '24 hour') - b.entrada3::time)) / 3600.0
            end
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

      c.credito_horas,
      c.debito_horas,
      c.horas_normais,
      c.he_70_horas,
      c.he_100_horas,
      c.adicional_noturno_horas,
      c.total_horas_extras_horas,

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
      b.saida2,
      b.entrada3,
      b.saida3
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
    union all
    select company_id, staff_id, data, 'entrada'::text as tipo, entrada3 as hora from base
    union all
    select company_id, staff_id, data, 'saida'::text as tipo, saida3 as hora from base
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
end;
$$;

grant execute on function public.fn_ponto_he_pdf_stage_payload(uuid, jsonb) to authenticated;
grant execute on function public.fn_ponto_he_pdf_apply(uuid, text) to authenticated;

commit;

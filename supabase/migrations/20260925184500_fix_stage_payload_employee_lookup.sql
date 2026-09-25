begin;

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

    -- Resolução de vínculo por matrícula e nome
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
    values (
      v_job.company_id,
      p_job_id,
      v_employee_id,
      v_nome,
      v_matricula,
      v_equipe,
      v_funcao,
      v_periodo_inicio,
      v_periodo_fim,
      v_credito,
      v_debito,
      v_horas_normais,
      v_he70,
      v_he100,
      v_ad_not,
      v_he_total,
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
          company_id,
          job_id,
          colaborador_id,
          data,
          entrada1,
          saida1,
          entrada2,
          saida2,
          horas_trabalhadas_h,
          he_dia_h,
          linha_origem,
          source_payload
        )
        values (
          v_job.company_id,
          p_job_id,
          v_col_id,
          nullif(v_bat->>'data', '')::date,
          nullif(v_bat->>'entrada1', ''),
          nullif(v_bat->>'saida1', ''),
          nullif(v_bat->>'entrada2', ''),
          nullif(v_bat->>'saida2', ''),
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

grant execute on function public.fn_ponto_he_pdf_stage_payload(uuid, jsonb) to authenticated;

commit;

-- Exemplo: popular staging de importação PDF via RPC
-- Pré-requisito: já existir um job em public.ponto_he_import_jobs

-- 1) Criar job (se necessário)
-- insert into public.ponto_he_import_jobs (company_id, competencia, equipe_nome, origem, status)
-- values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, '2026-09-01'::date, 'GRU - AIRPORT', 'pdf', 'criado')
-- returning id;

-- 2) Chamar RPC de stage
select public.fn_ponto_he_pdf_stage_payload(
  p_job_id := '<JOB_ID>'::uuid,
  p_payload := jsonb_build_object(
    'colaboradores', jsonb_build_array(
      jsonb_build_object(
        'nome', 'ABIMAEL DA SILVA',
        'matricula', '1363',
        'equipe', 'GRU - AIRPORT',
        'funcao', 'MOTORISTA DE CAMINHÃO BASCULANTE',
        'periodo_inicio', '2026-09-01',
        'periodo_fim', '2026-09-30',
        'credito_horas', 10.50,
        'debito_horas', 0.00,
        'horas_normais', 176.00,
        'he_70_horas', 8.00,
        'he_100_horas', 2.50,
        'adicional_noturno_horas', 0.00,
        'total_horas_extras_horas', 10.50,
        'batidas', jsonb_build_array(
          jsonb_build_object('data','2026-09-02','entrada1','07:00','saida1','11:00','entrada2','12:00','saida2','17:30'),
          jsonb_build_object('data','2026-09-03','entrada1','07:00','saida1','11:00','entrada2','12:00','saida2','17:10')
        )
      )
    )
  )
);

-- 3) Rodar pré-check
-- select public.fn_ponto_he_pdf_precheck('<JOB_ID>'::uuid);

-- 4) Apply
-- select public.fn_ponto_he_pdf_apply('<JOB_ID>'::uuid, 'Apply após stage payload');

-- Backfill não destrutivo, Fremix: somente pendências com match ÚNICO e ativo.
-- Não aprova/rejeita registros; não toca em 93 RDOs sem engenheiro ou nomes ambíguos.
DO $fix$
DECLARE v_company uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;
DECLARE v_enc int;
DECLARE v_eng int;
BEGIN
  WITH matches AS (
    SELECT r.id, e.id AS employee_id,
      count(*) OVER (PARTITION BY r.id) AS candidatos
    FROM public.rdo_diarios r
    JOIN public.employees e ON e.company_id = r.company_id
      AND e.is_encarregado IS TRUE AND e.status = 'ativo'
      AND public.wf_normalize_name(e.name) = public.wf_normalize_name(r.encarregado)
    WHERE r.company_id = v_company AND r.encarregado_employee_id IS NULL
      AND r.data >= DATE '2026-07-17' AND r.status_validacao <> 'rascunho'
      AND r.validado_encarregado IS FALSE AND r.nao_aprovado_encarregado IS FALSE
  )
  UPDATE public.rdo_diarios r SET encarregado_employee_id = m.employee_id
  FROM matches m WHERE m.id = r.id AND m.candidatos = 1
    AND r.company_id = v_company AND r.encarregado_employee_id IS NULL;
  GET DIAGNOSTICS v_enc = ROW_COUNT;

  WITH matches AS (
    SELECT r.id, p.user_id, count(*) OVER (PARTITION BY r.id) AS candidatos
    FROM public.rdo_diarios r
    JOIN public.profiles p ON p.company_id = r.company_id AND p.status = 'ativo'
      AND p.user_id IS DISTINCT FROM r.user_id
      AND cardinality(public.wf_name_tokens(p.nome_completo)) >= 2
      AND public.wf_name_tokens(p.nome_completo) <@ public.wf_name_tokens(r.engenheiro_responsavel)
    JOIN public.user_permissions up ON up.user_id = p.user_id AND up.modulo_engenharia IS TRUE
    WHERE r.company_id = v_company AND r.engenheiro_responsavel_user_id IS NULL
      AND r.data >= DATE '2026-07-17' AND r.status_validacao IN ('enviado','aguardando_validacao')
      AND r.validado_por IS NULL AND nullif(btrim(r.engenheiro_responsavel),'') IS NOT NULL
  )
  UPDATE public.rdo_diarios r SET engenheiro_responsavel_user_id = m.user_id
  FROM matches m WHERE m.id = r.id AND m.candidatos = 1
    AND r.company_id = v_company AND r.engenheiro_responsavel_user_id IS NULL;
  GET DIAGNOSTICS v_eng = ROW_COUNT;
  RAISE NOTICE 'Vínculos seguros preenchidos: encarregado %, engenharia %', v_enc, v_eng;
END;
$fix$;

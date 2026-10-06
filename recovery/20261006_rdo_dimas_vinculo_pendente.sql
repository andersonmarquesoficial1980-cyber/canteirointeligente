-- Correção pontual, não destrutiva: três RDOs pendentes do Alan destinados ao Dimas.
-- Reexecutável enquanto os três estiverem pendentes: mantém o ID correto; nunca valida automaticamente.
DO $fix$
DECLARE
  v_dimas uuid := '69541574-3a1a-42c3-b7e9-956e4f782241'::uuid;
  v_alan uuid := 'f3dc3c2f-0606-492a-887a-f4a83140a095'::uuid;
  v_company uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;
  v_ids uuid[] := ARRAY[
    '57876a8e-0e33-4bbc-9138-1de143def0cb',
    'e2f258ed-15fc-42a8-8241-df5257bcf540',
    '977b4612-3a79-41d6-aa50-347355acb339'
  ]::uuid[];
  v_present int;
  v_valid int;
BEGIN
  SELECT count(*) INTO v_present FROM public.rdo_diarios WHERE id = ANY(v_ids);
  IF v_present = 0 THEN RETURN; END IF; -- schema novo, sem registros de produção
  IF v_present <> 3 OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.user_permissions up ON up.user_id = p.user_id
    WHERE p.user_id = v_dimas AND p.company_id = v_company
      AND p.nome_completo = 'DIMAS DE SOUZA IBIAPINA' AND p.status = 'ativo'
      AND up.modulo_engenharia IS TRUE
  ) THEN
    RAISE EXCEPTION 'Pré-condições de vínculo do Dimas não atendidas';
  END IF;
  SELECT count(*) INTO v_valid FROM public.rdo_diarios r
  WHERE r.id = ANY(v_ids) AND r.company_id = v_company AND r.user_id = v_alan
    AND r.preenchido_por = 'ALAN KARDEC'
    AND r.engenheiro_responsavel = 'DIMAS DE SOUZA IBIAPINA'
    AND r.status_validacao IN ('enviado', 'aguardando_validacao')
    AND r.validado_por IS NULL
    AND (r.engenheiro_responsavel_user_id IS NULL OR r.engenheiro_responsavel_user_id = v_dimas);
  IF v_valid <> 3 THEN RAISE EXCEPTION 'RDOs alterados desde o preflight; nenhuma alteração aplicada'; END IF;
  UPDATE public.rdo_diarios r SET engenheiro_responsavel_user_id = v_dimas
  WHERE r.id = ANY(v_ids) AND r.engenheiro_responsavel_user_id IS NULL;
END;
$fix$;

-- Regressão em produção: todas as alterações são revertidas pelo ROLLBACK final.
BEGIN;
SELECT set_config('request.jwt.claim.sub', p.user_id::text, true)
FROM public.profiles p WHERE p.nome_completo = 'DIMAS DE SOUZA IBIAPINA' AND p.status='ativo';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_rdo uuid;
  v_result uuid;
  v_actor uuid := auth.uid();
  v_denied boolean := false;

BEGIN
  SELECT r.id INTO v_rdo FROM public.rdo_diarios r
  WHERE r.engenheiro_responsavel_user_id = v_actor
    AND r.preenchido_por = 'ALAN KARDEC'
    AND r.status_validacao IN ('enviado','aguardando_validacao')
    AND r.validado_por IS NULL
    AND r.data < (now() AT TIME ZONE 'America/Sao_Paulo')::date - 2
  ORDER BY r.data LIMIT 1;
  IF v_rdo IS NULL THEN RAISE EXCEPTION 'Teste sem RDO antigo pendente do Dimas'; END IF;

  -- Decisão de RDO antigo passa apesar do prazo, sem status persisitido fora desta transação.
  v_result := public.wf_validar_rdo_apontador(v_rdo, 'validado', NULL);
  IF v_result <> v_rdo OR NOT EXISTS (
    SELECT 1 FROM public.rdo_diarios
    WHERE id=v_rdo AND status_validacao='validado' AND validado_por=v_actor
  ) THEN RAISE EXCEPTION 'Validação antiga não persistiu na transação'; END IF;

  BEGIN
    PERFORM public.wf_validar_rdo_apontador(v_rdo,'validado',NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Dupla validação foi permitida'; END IF;


END;
$test$;
ROLLBACK;

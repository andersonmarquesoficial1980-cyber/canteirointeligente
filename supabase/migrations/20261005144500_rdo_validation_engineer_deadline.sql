-- Validação da Engenharia não é lançamento do apontador: não se sujeita ao prazo do RDO.
-- Mantém o bloqueio em INSERT e em qualquer alteração de conteúdo/data do RDO.
CREATE OR REPLACE FUNCTION public.trg_enforce_rdo_deadline_48h()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status_validacao IN ('enviado', 'aguardando_validacao')
    AND OLD.validado_por IS NULL
    AND NEW.status_validacao IN ('validado', 'rejeitado')
    AND NEW.validado_por = auth.uid()
    AND (to_jsonb(NEW) - ARRAY['status_validacao','validado_por','validado_em','motivo_rejeicao_eng'])
        = (to_jsonb(OLD) - ARRAY['status_validacao','validado_por','validado_em','motivo_rejeicao_eng'])
    AND (
      (OLD.engenheiro_responsavel_user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_permissions up ON up.user_id = p.user_id
        WHERE p.user_id = auth.uid() AND p.company_id = OLD.company_id
          AND p.status = 'ativo' AND up.modulo_engenharia IS TRUE
      ))
      OR EXISTS (
        SELECT 1 FROM public.user_admin_roles uar
        JOIN public.admin_roles ar ON ar.id = uar.role_id
        WHERE uar.user_id = auth.uid() AND uar.company_id = OLD.company_id
          AND uar.is_active IS TRUE AND ar.name IN ('RDO_Admin', 'Super_Admin')
      )
    )
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.fn_assert_diary_deadline_48h(auth.uid(), NEW.company_id, NEW.data::date, 'rdo');
  RETURN NEW;
END;
$fn$;

-- Apenas a decisão: não concede UPDATE livre em RDOs de terceiros.
CREATE OR REPLACE FUNCTION public.wf_validar_rdo_apontador(p_rdo_id uuid, p_acao text, p_motivo text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_rdo public.rdo_diarios%ROWTYPE;
  v_admin boolean;
BEGIN
  IF v_actor IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Autenticação necessária para validar RDO' USING ERRCODE = '42501';
  END IF;
  IF p_acao NOT IN ('validado','rejeitado') OR p_acao IS NULL THEN
    RAISE EXCEPTION 'Decisão inválida para RDO' USING ERRCODE = '22023';
  END IF;
  IF p_acao = 'rejeitado' AND nullif(btrim(coalesce(p_motivo,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rdo FROM public.rdo_diarios WHERE id = p_rdo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_rdo.status_validacao NOT IN ('enviado','aguardando_validacao') OR v_rdo.validado_por IS NOT NULL THEN
    RAISE EXCEPTION 'RDO não está pendente de validação' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_admin_roles uar
    JOIN public.admin_roles ar ON ar.id = uar.role_id
    WHERE uar.user_id = v_actor AND uar.company_id = v_rdo.company_id
      AND uar.is_active IS TRUE AND ar.name IN ('RDO_Admin','Super_Admin')
  ) INTO v_admin;

  IF NOT v_admin AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_permissions up ON up.user_id = p.user_id
    WHERE p.user_id = v_actor AND p.company_id = v_rdo.company_id
      AND p.status = 'ativo' AND up.modulo_engenharia IS TRUE
      AND v_rdo.engenheiro_responsavel_user_id = p.user_id
      AND v_rdo.user_id IS DISTINCT FROM p.user_id
  ) THEN
    RAISE EXCEPTION 'Somente o engenheiro responsável pode validar este RDO' USING ERRCODE = '42501';
  END IF;

  UPDATE public.rdo_diarios
     SET status_validacao = p_acao,
         validado_por = v_actor,
         validado_em = now(),
         motivo_rejeicao_eng = CASE WHEN p_acao = 'rejeitado' THEN btrim(p_motivo) ELSE NULL END
   WHERE id = p_rdo_id
     AND status_validacao IN ('enviado','aguardando_validacao')
     AND validado_por IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RDO não foi atualizado' USING ERRCODE = 'P0001';
  END IF;
  RETURN p_rdo_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.wf_validar_rdo_apontador(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_validar_rdo_apontador(uuid,text,text) TO authenticated;

-- Vínculo pontual autorizado: somente os RDOs ainda pendentes do Alan destinados ao Dimas.
DO $fn$
DECLARE
  v_dimas uuid;
  v_empresa uuid;
BEGIN
  IF (SELECT count(*) FROM public.profiles
      WHERE nome_completo = 'DIMAS DE SOUZA IBIAPINA' AND status = 'ativo') <> 1 THEN
    RAISE EXCEPTION 'Vínculo do Dimas ambíguo; abortando backfill';
  END IF;
  SELECT user_id, company_id INTO v_dimas, v_empresa FROM public.profiles
    WHERE nome_completo = 'DIMAS DE SOUZA IBIAPINA' AND status = 'ativo';
  IF v_empresa IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = v_dimas AND modulo_engenharia IS TRUE
  ) THEN
    RAISE EXCEPTION 'Dimas sem empresa ou sem permissão de Engenharia';
  END IF;
  UPDATE public.rdo_diarios r
     SET engenheiro_responsavel_user_id = v_dimas
   WHERE r.company_id = v_empresa
     AND r.preenchido_por = 'ALAN KARDEC'
     AND r.engenheiro_responsavel = 'DIMAS DE SOUZA IBIAPINA'
     AND r.engenheiro_responsavel_user_id IS NULL
     AND r.status_validacao IN ('enviado','aguardando_validacao')
     AND r.validado_por IS NULL;
END;
$fn$;

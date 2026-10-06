-- Uma identidade única para fila e decisão do encarregado; não altera permissões gerais de RDO.
CREATE OR REPLACE FUNCTION public.wf_encarregado_employee_for_user(p_actor uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(e.id ORDER BY e.id) INTO v_ids
  FROM public.profiles p
  JOIN public.user_permissions up ON up.user_id = p.user_id AND up.modulo_encarregado IS TRUE
  JOIN public.employees e ON e.company_id = p.company_id AND e.is_encarregado IS TRUE AND e.status = 'ativo'
  WHERE p.user_id = p_actor AND p.status = 'ativo' AND p.company_id IS NOT NULL
    AND cardinality(public.wf_name_tokens(p.nome_completo)) >= 2
    AND public.wf_name_tokens(p.nome_completo) <@ public.wf_name_tokens(e.name);
  IF cardinality(coalesce(v_ids, '{}'::uuid[])) <> 1 THEN RETURN NULL; END IF;
  RETURN v_ids[1];
END;
$fn$;
REVOKE ALL ON FUNCTION public.wf_encarregado_employee_for_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wf_meu_encarregado()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_emp uuid := public.wf_encarregado_employee_for_user(auth.uid());
DECLARE v_result jsonb;
BEGIN
  IF auth.role() <> 'authenticated' OR v_emp IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('id', e.id, 'name', e.name, 'company_id', e.company_id)
  INTO v_result FROM public.employees e WHERE e.id = v_emp;
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wf_meu_encarregado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_meu_encarregado() TO authenticated;

-- Registra o funcionário canônico quando o apontador escolhe um nome único.
CREATE OR REPLACE FUNCTION public.trg_bind_rdo_encarregado_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.encarregado IS NOT DISTINCT FROM OLD.encarregado THEN RETURN NEW; END IF;
  SELECT array_agg(e.id ORDER BY e.id) INTO v_ids FROM public.employees e
  WHERE e.company_id = NEW.company_id AND e.is_encarregado IS TRUE AND e.status = 'ativo'
    AND nullif(btrim(NEW.encarregado), '') IS NOT NULL
    AND public.wf_normalize_name(e.name) = public.wf_normalize_name(NEW.encarregado);
  NEW.encarregado_employee_id := CASE WHEN cardinality(coalesce(v_ids,'{}'::uuid[])) = 1 THEN v_ids[1] ELSE NULL END;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_z_bind_rdo_encarregado_employee ON public.rdo_diarios;
CREATE TRIGGER trg_z_bind_rdo_encarregado_employee BEFORE INSERT OR UPDATE OF company_id, encarregado
ON public.rdo_diarios FOR EACH ROW EXECUTE FUNCTION public.trg_bind_rdo_encarregado_employee();
REVOKE ALL ON FUNCTION public.trg_bind_rdo_encarregado_employee() FROM PUBLIC, anon, authenticated;

-- O guard impede que uma decisão de encarregado seja gravada em RDO alheio,
-- inclusive quando uma policy ALL permissiva conceder UPDATE da empresa.
CREATE OR REPLACE FUNCTION public.trg_guard_rdo_encarregado_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_emp uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.validado_encarregado IS FALSE AND OLD.nao_aprovado_encarregado IS FALSE
     AND (NEW.validado_encarregado IS TRUE OR NEW.nao_aprovado_encarregado IS TRUE) THEN
    v_emp := public.wf_encarregado_employee_for_user(auth.uid());
    IF auth.role() <> 'authenticated' OR v_emp IS NULL OR OLD.user_id = auth.uid()
       OR OLD.status_validacao = 'rascunho' OR OLD.data < DATE '2026-07-17'
       OR NOT EXISTS (
          SELECT 1 FROM public.employees e WHERE e.id = v_emp AND e.company_id = OLD.company_id
            AND (OLD.encarregado_employee_id = e.id OR
              (OLD.encarregado_employee_id IS NULL AND public.wf_normalize_name(OLD.encarregado) = public.wf_normalize_name(e.name)))
       ) OR NEW.validado_encarregado = NEW.nao_aprovado_encarregado
       OR NEW.validado_encarregado_por IS DISTINCT FROM auth.uid()
       OR (NEW.nao_aprovado_encarregado IS TRUE AND nullif(btrim(NEW.motivo_rejeicao_enc), '') IS NULL)
       OR (to_jsonb(NEW) - ARRAY['validado_encarregado','nao_aprovado_encarregado','validado_encarregado_por','validado_encarregado_em','motivo_rejeicao_enc'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['validado_encarregado','nao_aprovado_encarregado','validado_encarregado_por','validado_encarregado_em','motivo_rejeicao_enc'])
    THEN RAISE EXCEPTION 'Somente o encarregado responsável pode decidir este RDO' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_a_guard_rdo_encarregado_decision ON public.rdo_diarios;
CREATE TRIGGER trg_a_guard_rdo_encarregado_decision BEFORE UPDATE ON public.rdo_diarios
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_rdo_encarregado_decision();
REVOKE ALL ON FUNCTION public.trg_guard_rdo_encarregado_decision() FROM PUBLIC, anon, authenticated;

-- Validação não é lançamento: eximir apenas a decisão, nunca alterações de conteúdo/data.
CREATE OR REPLACE FUNCTION public.trg_enforce_rdo_deadline_48h()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - ARRAY['encarregado_employee_id','engenheiro_responsavel_user_id'])
       = (to_jsonb(OLD) - ARRAY['encarregado_employee_id','engenheiro_responsavel_user_id'])
     AND (NEW.encarregado_employee_id IS DISTINCT FROM OLD.encarregado_employee_id
       OR NEW.engenheiro_responsavel_user_id IS DISTINCT FROM OLD.engenheiro_responsavel_user_id)
     AND (NEW.encarregado_employee_id IS NOT DISTINCT FROM OLD.encarregado_employee_id OR
       (OLD.encarregado_employee_id IS NULL AND EXISTS (SELECT 1 FROM public.employees e
         WHERE e.id=NEW.encarregado_employee_id AND e.company_id=OLD.company_id AND e.is_encarregado IS TRUE
           AND e.status='ativo' AND public.wf_normalize_name(e.name)=public.wf_normalize_name(OLD.encarregado))))
     AND (NEW.engenheiro_responsavel_user_id IS NOT DISTINCT FROM OLD.engenheiro_responsavel_user_id OR
       (OLD.engenheiro_responsavel_user_id IS NULL AND NEW.engenheiro_responsavel_user_id =
          public.wf_resolve_engenheiro_user_id(OLD.company_id,OLD.engenheiro_responsavel)))
  THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
    AND OLD.status_validacao IN ('enviado', 'aguardando_validacao')
    AND OLD.validado_por IS NULL
    AND NEW.status_validacao IN ('validado', 'rejeitado')
    AND NEW.validado_por = auth.uid()
    AND (to_jsonb(NEW) - ARRAY['status_validacao','validado_por','validado_em','motivo_rejeicao_eng'])
        = (to_jsonb(OLD) - ARRAY['status_validacao','validado_por','validado_em','motivo_rejeicao_eng'])
    AND (
      (OLD.engenheiro_responsavel_user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.profiles p JOIN public.user_permissions up ON up.user_id = p.user_id
        WHERE p.user_id = auth.uid() AND p.company_id = OLD.company_id
          AND p.status = 'ativo' AND up.modulo_engenharia IS TRUE
      ))
      OR EXISTS (
        SELECT 1 FROM public.user_admin_roles uar JOIN public.admin_roles ar ON ar.id = uar.role_id
        WHERE uar.user_id = auth.uid() AND uar.company_id = OLD.company_id
          AND uar.is_active IS TRUE AND ar.name IN ('RDO_Admin', 'Super_Admin')
      )
    ) THEN RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.validado_encarregado IS FALSE AND OLD.nao_aprovado_encarregado IS FALSE
     AND NEW.validado_encarregado_por = auth.uid()
     AND ((NEW.validado_encarregado IS TRUE AND NEW.nao_aprovado_encarregado IS FALSE)
       OR (NEW.validado_encarregado IS FALSE AND NEW.nao_aprovado_encarregado IS TRUE))
     AND (to_jsonb(NEW) - ARRAY['validado_encarregado','nao_aprovado_encarregado','validado_encarregado_por','validado_encarregado_em','motivo_rejeicao_enc'])
       = (to_jsonb(OLD) - ARRAY['validado_encarregado','nao_aprovado_encarregado','validado_encarregado_por','validado_encarregado_em','motivo_rejeicao_enc'])
     AND OLD.user_id IS DISTINCT FROM auth.uid()
     AND EXISTS (SELECT 1 FROM public.employees e
       WHERE e.id = public.wf_encarregado_employee_for_user(auth.uid()) AND e.company_id = OLD.company_id
         AND (OLD.encarregado_employee_id = e.id OR (OLD.encarregado_employee_id IS NULL
           AND public.wf_normalize_name(OLD.encarregado) = public.wf_normalize_name(e.name))))
  THEN RETURN NEW; END IF;
  PERFORM public.fn_assert_diary_deadline_48h(auth.uid(), NEW.company_id, NEW.data::date, 'rdo');
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.wf_validar_rdo_encarregado(p_rdo_id uuid, p_acao text, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_actor uuid := auth.uid();
DECLARE v_emp uuid;
DECLARE v_rdo public.rdo_diarios%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Autenticação necessária para validar RDO' USING ERRCODE='42501'; END IF;
  IF p_acao IS NULL OR p_acao NOT IN ('aprovado','nao_aprovado') THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE='22023'; END IF;
  IF p_acao = 'nao_aprovado' AND nullif(btrim(coalesce(p_motivo,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição' USING ERRCODE='22023'; END IF;
  v_emp := public.wf_encarregado_employee_for_user(v_actor);
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Vínculo único de encarregado não encontrado' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_rdo FROM public.rdo_diarios WHERE id = p_rdo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RDO não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_rdo.validado_encarregado IS NOT FALSE OR v_rdo.nao_aprovado_encarregado IS NOT FALSE THEN
    RAISE EXCEPTION 'RDO não está pendente de validação' USING ERRCODE='P0001'; END IF;
  IF v_rdo.user_id = v_actor OR v_rdo.status_validacao = 'rascunho' OR v_rdo.data < DATE '2026-07-17'
     OR NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id=v_emp AND e.company_id=v_rdo.company_id
       AND (v_rdo.encarregado_employee_id=e.id OR (v_rdo.encarregado_employee_id IS NULL
         AND public.wf_normalize_name(v_rdo.encarregado)=public.wf_normalize_name(e.name)))) THEN
    RAISE EXCEPTION 'Somente o encarregado responsável pode decidir este RDO' USING ERRCODE='42501'; END IF;
  UPDATE public.rdo_diarios SET validado_encarregado = (p_acao='aprovado'),
    nao_aprovado_encarregado = (p_acao='nao_aprovado'), validado_encarregado_por = v_actor,
    validado_encarregado_em = now(), motivo_rejeicao_enc = CASE WHEN p_acao='nao_aprovado' THEN btrim(p_motivo) ELSE NULL END
  WHERE id=p_rdo_id AND validado_encarregado IS FALSE AND nao_aprovado_encarregado IS FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RDO não foi atualizado' USING ERRCODE='P0001'; END IF;
  RETURN p_rdo_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wf_validar_rdo_encarregado(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_validar_rdo_encarregado(uuid,text,text) TO authenticated;

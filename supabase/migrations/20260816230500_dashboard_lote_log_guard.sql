-- Hotfix: não falhar edição do dashboard quando log_admin_action não existir
-- ou estiver com assinatura divergente em ambientes legados.

CREATE OR REPLACE FUNCTION public.update_equipamentos_dashboard_lote(
  p_ids uuid[],
  p_status text DEFAULT NULL,
  p_setor text DEFAULT NULL,
  p_local_atual text DEFAULT NULL,
  p_valor_mode text DEFAULT 'manter', -- manter | definir | zerar
  p_valor_mensal numeric DEFAULT NULL
)
RETURNS TABLE(updated_count integer, denied_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_can_access_panel boolean := true;
  v_allowed_sections text[] := '{}';
  v_has_perm boolean := false;
  v_has_user_level_perms boolean := false;
  v_total_ids integer := COALESCE(array_length(p_ids, 1), 0);
  v_updated integer := 0;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_ids IS NULL OR v_total_ids = 0 THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  SELECT p.company_id, p.role
    INTO v_company_id, v_role
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;

  IF v_role IN ('superadmin', 'admin') THEN
    v_has_perm := true;
  ELSE
    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'company_id do usuário não encontrado';
    END IF;

    SELECT uapa.can_access_panel, uapa.allowed_sections
      INTO v_can_access_panel, v_allowed_sections
    FROM public.user_admin_panel_access uapa
    WHERE uapa.company_id = v_company_id
      AND uapa.user_id = v_user_id
    LIMIT 1;

    IF COALESCE(v_can_access_panel, true) = false THEN
      RAISE EXCEPTION 'Acesso ao Painel de Controle bloqueado para este usuário';
    END IF;

    IF COALESCE(array_length(v_allowed_sections, 1), 0) > 0
       AND NOT ('maquinas' = ANY(v_allowed_sections)) THEN
      RAISE EXCEPTION 'Usuário sem acesso à seção Frota/Equipamentos no Painel';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_admin_permissions uap
      WHERE uap.company_id = v_company_id
        AND uap.user_id = v_user_id
    )
    INTO v_has_user_level_perms;

    IF v_has_user_level_perms THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_admin_permissions uap
        WHERE uap.company_id = v_company_id
          AND uap.user_id = v_user_id
          AND (
            (uap.resource = 'all' AND uap.action = 'manage')
            OR (uap.resource = 'admin_section.maquinas' AND uap.action IN ('manage', 'edit'))
          )
      )
      INTO v_has_perm;
    ELSE
      SELECT (
        public.has_admin_permission(v_user_id, 'all', 'manage', v_company_id)
        OR public.has_admin_permission(v_user_id, 'admin_section.maquinas', 'manage', v_company_id)
        OR public.has_admin_permission(v_user_id, 'admin_section.maquinas', 'edit', v_company_id)
      )
      INTO v_has_perm;
    END IF;
  END IF;

  IF NOT v_has_perm THEN
    RAISE EXCEPTION 'Sem permissão para edição de equipamentos no dashboard';
  END IF;

  IF p_valor_mode NOT IN ('manter', 'definir', 'zerar') THEN
    RAISE EXCEPTION 'p_valor_mode inválido. Use: manter, definir ou zerar';
  END IF;

  IF p_valor_mode = 'definir' AND p_valor_mensal IS NULL THEN
    RAISE EXCEPTION 'p_valor_mensal é obrigatório quando p_valor_mode=definir';
  END IF;

  IF p_valor_mode = 'definir' AND p_valor_mensal < 0 THEN
    RAISE EXCEPTION 'p_valor_mensal não pode ser negativo';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'frota', e.frota,
        'status', e.status,
        'setor', e.setor,
        'local_atual', e.local_atual,
        'valor_mensal', e.valor_mensal
      )
    ),
    '[]'::jsonb
  )
  INTO v_before
  FROM public.equipamentos e
  WHERE e.id = ANY(p_ids)
    AND (v_role = 'superadmin' OR e.company_id = v_company_id);

  UPDATE public.equipamentos e
  SET
    status = CASE WHEN p_status IS NOT NULL THEN p_status ELSE e.status END,
    setor = CASE WHEN p_setor IS NOT NULL THEN p_setor ELSE e.setor END,
    local_atual = CASE WHEN p_local_atual IS NOT NULL THEN p_local_atual ELSE e.local_atual END,
    valor_mensal = CASE
      WHEN p_valor_mode = 'zerar' THEN 0
      WHEN p_valor_mode = 'definir' THEN p_valor_mensal
      ELSE e.valor_mensal
    END,
    updated_at = now()
  WHERE e.id = ANY(p_ids)
    AND (v_role = 'superadmin' OR e.company_id = v_company_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'frota', e.frota,
        'status', e.status,
        'setor', e.setor,
        'local_atual', e.local_atual,
        'valor_mensal', e.valor_mensal
      )
    ),
    '[]'::jsonb
  )
  INTO v_after
  FROM public.equipamentos e
  WHERE e.id = ANY(p_ids)
    AND (v_role = 'superadmin' OR e.company_id = v_company_id);

  -- Guardrail: não derrubar a operação caso o logger não exista/esteja divergente.
  IF to_regprocedure('public.log_admin_action(uuid,text,text,text,jsonb,jsonb)') IS NOT NULL THEN
    BEGIN
      PERFORM public.log_admin_action(
        v_user_id,
        'update'::text,
        'equipamentos.dashboard_lote'::text,
        v_updated::text,
        jsonb_build_object(
          'ids', p_ids,
          'before', v_before
        ),
        jsonb_build_object(
          'payload', jsonb_build_object(
            'status', p_status,
            'setor', p_setor,
            'local_atual', p_local_atual,
            'valor_mode', p_valor_mode,
            'valor_mensal', p_valor_mensal
          ),
          'after', v_after
        )
      );
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN QUERY SELECT v_updated, GREATEST(v_total_ids - v_updated, 0);
END;
$$;

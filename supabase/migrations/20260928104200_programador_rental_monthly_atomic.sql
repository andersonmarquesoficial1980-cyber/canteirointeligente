-- Permite ao WF Programador autorizado alterar somente o valor mensal de
-- equipamentos TERCEIRO da própria empresa, com auditoria transacional.
-- Não altera nenhum registro existente durante a instalação.
BEGIN;
CREATE OR REPLACE FUNCTION public.programador_atualizar_valor_mensal(
  p_company_id uuid,
  p_equipment_id uuid,
  p_valor_mensal numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_equipment public.equipamentos%ROWTYPE;
BEGIN
  IF v_user IS NULL OR p_company_id IS NULL OR p_equipment_id IS NULL
     OR p_valor_mensal IS NULL THEN
    RAISE EXCEPTION 'Usuário, empresa, equipamento e valor são obrigatórios';
  END IF;
  IF p_valor_mensal < 0 OR p_valor_mensal > 1000000000
     OR round(p_valor_mensal, 2) <> p_valor_mensal THEN
    RAISE EXCEPTION 'Valor mensal inválido: informe no máximo duas casas decimais';
  END IF;
  -- Acesso ao Programador é a permissão para editar o valor; não libera o cadastro
  -- de outra empresa nem equipamentos próprios.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user AND p.company_id = p_company_id AND p.status = 'ativo'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = v_user AND up.company_id = p_company_id
      AND (up.modulo_programador IS TRUE OR up.is_admin IS TRUE)
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao WF Programador nesta empresa';
  END IF;

  SELECT * INTO v_equipment FROM public.equipamentos
  WHERE id = p_equipment_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado nesta empresa'; END IF;
  IF upper(trim(coalesce(v_equipment.condicao, ''))) <> 'TERCEIRO' THEN
    RAISE EXCEPTION 'Somente equipamentos de terceiro aceitam valor mensal neste fluxo';
  END IF;
  IF v_equipment.valor_mensal IS NOT DISTINCT FROM p_valor_mensal THEN
    RAISE EXCEPTION 'Valor mensal não foi alterado';
  END IF;

  UPDATE public.equipamentos SET valor_mensal = p_valor_mensal, updated_at = now()
  WHERE id = p_equipment_id AND company_id = p_company_id;
  INSERT INTO public.ci_mov_equipamentos
    (data, tipo, equipamento_id, frota, tipo_equipamento,
     equipe_origem, equipe_destino, status, company_id, created_by, obs)
  VALUES
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'valor_mensal',
     v_equipment.id, v_equipment.frota, v_equipment.tipo,
     v_equipment.setor, v_equipment.setor, v_equipment.status,
     p_company_id, v_user,
     'Valor mensal de terceiro: ' || coalesce(v_equipment.valor_mensal::text, 'não cadastrado')
       || ' -> ' || p_valor_mensal::text || ' (R$/mês)');

  RETURN jsonb_build_object('antes', v_equipment.valor_mensal, 'depois', p_valor_mensal);
END;
$fn$;
REVOKE ALL ON FUNCTION public.programador_atualizar_valor_mensal(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_atualizar_valor_mensal(uuid,uuid,numeric) TO authenticated;
COMMIT;

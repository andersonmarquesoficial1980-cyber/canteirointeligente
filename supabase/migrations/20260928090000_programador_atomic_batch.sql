-- Aplicação atômica do WF Programador: mestres e auditoria na mesma transação.
-- Não migra registros antigos nem altera papéis de usuários.
BEGIN;

CREATE OR REPLACE FUNCTION public.programador_aplicar_lote(
  p_company_id uuid,
  p_data date,
  p_equipe text,
  p_override_reason text,
  p_func_changes jsonb,
  p_equip_changes jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_id uuid;
  v_employee public.employees%ROWTYPE;
  v_equipment public.equipamentos%ROWTYPE;
  v_team text;
  v_status text;
  v_seen_employees uuid[] := ARRAY[]::uuid[];
  v_seen_equipments uuid[] := ARRAY[]::uuid[];
  v_employee_count integer := 0;
  v_equipment_count integer := 0;
  v_obs text;
  v_date_demissao date;
BEGIN
  IF v_user IS NULL OR p_company_id IS NULL OR p_data IS NULL THEN
    RAISE EXCEPTION 'Usuário, empresa e data são obrigatórios';
  END IF;

  -- SECURITY DEFINER bypasses RLS: authenticate, bind tenant and verify capability here.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user AND p.company_id = p_company_id AND p.status = 'ativo'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = v_user AND up.company_id = p_company_id
      AND (up.modulo_programador IS TRUE OR up.is_admin IS TRUE)
  ) THEN
    RAISE EXCEPTION 'Sem permissão de Programador nesta empresa';
  END IF;

  IF jsonb_typeof(p_func_changes) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_equip_changes) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_func_changes) + jsonb_array_length(p_equip_changes) > 100 THEN
    RAISE EXCEPTION 'Lote inválido ou maior que 100 alterações';
  END IF;
  IF length(coalesce(p_override_reason, '')) > 1000 THEN
    RAISE EXCEPTION 'Motivo de override muito longo';
  END IF;
  v_obs := 'Movimentação via WF Programador (Equipe: ' || coalesce(nullif(trim(p_equipe), ''), '-') || ')';
  IF nullif(trim(coalesce(p_override_reason, '')), '') IS NOT NULL THEN
    v_obs := v_obs || ' [FORÇADO INTEGRAÇÃO: ' || trim(p_override_reason) || ']';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_func_changes) LOOP
    v_id := (v_item->>'id')::uuid;
    IF v_id IS NULL OR v_id = ANY(v_seen_employees) THEN
      RAISE EXCEPTION 'ID de funcionário inválido ou repetido';
    END IF;
    v_seen_employees := array_append(v_seen_employees, v_id);
    v_team := nullif(trim(v_item->>'equipe'), '');
    v_status := v_item->>'status';
    IF v_status IS NULL OR v_status NOT IN ('ativo','afastado','demitido','ferias') THEN
      RAISE EXCEPTION 'Status de funcionário inválido';
    END IF;

    SELECT * INTO v_employee FROM public.employees
      WHERE id = v_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não pertence à empresa'; END IF;
    IF v_employee.equipe IS NOT DISTINCT FROM v_team
       AND v_employee.status IS NOT DISTINCT FROM v_status THEN CONTINUE; END IF;
    v_date_demissao := CASE WHEN v_status = 'demitido'
      THEN CASE WHEN v_employee.status = 'demitido' THEN coalesce(v_employee.data_demissao, p_data)
                ELSE p_data END
      ELSE NULL END;

    UPDATE public.employees SET equipe = v_team, status = v_status,
      data_demissao = v_date_demissao WHERE id = v_id AND company_id = p_company_id;
    INSERT INTO public.ci_mov_funcionarios
      (data, tipo, funcionario_id, funcionario_nome, matricula,
       equipe_origem, equipe_destino, status, company_id, created_by, obs)
    VALUES
      (p_data,
       CASE WHEN v_employee.equipe IS DISTINCT FROM v_team AND v_employee.status IS DISTINCT FROM v_status
            THEN 'transferencia_status'
            WHEN v_employee.equipe IS DISTINCT FROM v_team THEN 'transferencia' ELSE 'status' END,
       v_id, v_employee.name, v_employee.matricula,
       v_employee.equipe, v_team, v_status, p_company_id, v_user, v_obs);
    v_employee_count := v_employee_count + 1;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_equip_changes) LOOP
    v_id := (v_item->>'id')::uuid;
    IF v_id IS NULL OR v_id = ANY(v_seen_equipments) THEN
      RAISE EXCEPTION 'ID de equipamento inválido ou repetido';
    END IF;
    v_seen_equipments := array_append(v_seen_equipments, v_id);
    v_team := nullif(trim(v_item->>'setor'), '');
    v_status := v_item->>'status';
    IF v_status IS NULL OR v_status NOT IN
      ('ativo','em_manutencao','inoperante','inativo','devolver','devolvido','diaria','disposicao') THEN
      RAISE EXCEPTION 'Status de equipamento inválido';
    END IF;

    SELECT * INTO v_equipment FROM public.equipamentos
      WHERE id = v_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não pertence à empresa'; END IF;
    IF v_equipment.setor IS NOT DISTINCT FROM v_team
       AND v_equipment.status IS NOT DISTINCT FROM v_status THEN CONTINUE; END IF;

    UPDATE public.equipamentos SET setor = v_team, status = v_status,
      updated_at = now() WHERE id = v_id AND company_id = p_company_id;
    INSERT INTO public.ci_mov_equipamentos
      (data, tipo, equipamento_id, frota, tipo_equipamento,
       equipe_origem, equipe_destino, status, responsavel_destino,
       company_id, created_by, obs)
    VALUES
      (p_data,
       CASE WHEN v_equipment.setor IS DISTINCT FROM v_team AND v_equipment.status IS DISTINCT FROM v_status
            THEN 'transferencia_status'
            WHEN v_equipment.setor IS DISTINCT FROM v_team THEN 'transferencia' ELSE 'status' END,
       v_id, v_equipment.frota, v_equipment.tipo,
       v_equipment.setor, v_team, v_status, nullif(trim(v_item->>'responsavel_destino'), ''),
       p_company_id, v_user, v_obs);
    v_equipment_count := v_equipment_count + 1;
  END LOOP;

  RETURN jsonb_build_object('funcionarios', v_employee_count, 'equipamentos', v_equipment_count);
END;
$fn$;

REVOKE ALL ON FUNCTION public.programador_aplicar_lote(uuid,date,text,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_aplicar_lote(uuid,date,text,text,jsonb,jsonb) TO authenticated;
COMMIT;

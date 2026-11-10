-- RDO automático de presença (GRU - Airport -> OGS 2529 | COPASA -> OGS 2339)
-- Gera, por OGS/dia, 1 RDO tipo AUTOMATICO apenas para funcionários ATIVOS elegíveis
-- que NÃO aparecem em nenhum outro RDO (não-rascunho) na data. Sem horário (entrada/saída NULL).
-- Nasce 'enviado'. Validação direta restrita (trigger abaixo). Idempotente. Suporta dry-run.
-- Alvo: data = hoje_SP - 2 (último dia da janela de 72h), rodando às 23:50 BRT,
-- para não conflitar com trg_enforce_rdo_deadline_48h e dar o prazo inteiro ao apontador.

CREATE OR REPLACE FUNCTION public.wf_auto_rdo_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(translate(coalesce(p,''),'ÁÀÃÂÉÊÍÓÕÔÚÇáàãâéêíóõôúç','AAAAEEIOOOUCaaaaeeiooouc'))
$$;

CREATE OR REPLACE FUNCTION public.gerar_rdo_automatico(p_data date DEFAULT NULL, p_dry_run boolean DEFAULT true)
RETURNS TABLE(ogs text, data date, elegiveis int, ja_em_rdo int, a_gerar int, acao text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_data date := coalesce(p_data, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 2));
  v_ogs record;
  v_rdo_id uuid;
  v_exist uuid;
  v_n_eleg int; v_n_ja int; v_n_ger int;
BEGIN
  FOR v_ogs IN
    SELECT o.id, o.ogs_number, o.company_id, o.location_address,
           CASE o.ogs_number WHEN '2529' THEN 'GRU' WHEN '2339' THEN 'COPASA' END AS chave
    FROM ogs_reference o WHERE o.ogs_number IN ('2529','2339')
  LOOP
    CREATE TEMP TABLE IF NOT EXISTS _auto_rdo_alvo (id uuid, name text, matricula text, funcao text, ja boolean) ON COMMIT DROP;
    TRUNCATE _auto_rdo_alvo;

    INSERT INTO _auto_rdo_alvo
    SELECT e.id, e.name, e.matricula, coalesce(f.nome, e.role),
      EXISTS (
        SELECT 1 FROM rdo_efetivo ef JOIN rdo_diarios r ON r.id = ef.rdo_id
        WHERE r.data = v_data AND r.status_validacao <> 'rascunho' AND r.company_id = v_ogs.company_id
          AND (ef.employee_id = e.id
               OR wf_auto_rdo_norm(e.name) IN (SELECT wf_auto_rdo_norm(trim(x)) FROM unnest(string_to_array(ef.nome,'|||')) x)))
    FROM employees e LEFT JOIN funcoes f ON f.id = e.funcao_id
    WHERE e.company_id = v_ogs.company_id
      AND e.status = 'ativo'
      AND (e.data_admissao IS NULL OR e.data_admissao !~ '^\d{4}-\d{2}-\d{2}' OR left(e.data_admissao,10) <= v_data::text)
      AND (e.data_demissao IS NULL OR e.data_demissao >= v_data)
      AND (wf_auto_rdo_norm(e.equipe) LIKE '%' || v_ogs.chave || '%'
           OR wf_auto_rdo_norm(e.centro_custo::text) LIKE '%' || v_ogs.chave || '%'
           OR e.centro_custo::text = v_ogs.ogs_number)
      AND NOT (
        wf_auto_rdo_norm(coalesce(e.equipe,'') || ' | ' || coalesce(e.centro_custo::text,'')) ~
        '(ADMINISTRATIV|CONTABIL|DEMITID|DEPARTAMENTO DE TI|(^| )TI( |$)|FACILIT|FINANCEIR|GESTAO DE PESSOAS|JURIDIC|MANUTENCAO|MASSA FRIA|SEGURANCA|SUPRIMENT|COMERCIAL|ESCRITORIO)'
      );

    SELECT count(*), count(*) FILTER (WHERE ja), count(*) FILTER (WHERE NOT ja)
      INTO v_n_eleg, v_n_ja, v_n_ger FROM _auto_rdo_alvo;

    ogs := v_ogs.ogs_number; data := v_data; elegiveis := v_n_eleg; ja_em_rdo := v_n_ja; a_gerar := v_n_ger;

    IF v_n_ger = 0 THEN
      acao := 'nada a gerar'; RETURN NEXT; CONTINUE;
    END IF;
    IF p_dry_run THEN
      acao := 'dry-run (nada gravado)'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT r.id INTO v_exist FROM rdo_diarios r
     WHERE r.company_id = v_ogs.company_id AND r.obra_nome = v_ogs.ogs_number
       AND r.data = v_data AND r.tipo_rdo = 'AUTOMATICO' LIMIT 1;

    IF v_exist IS NULL THEN
      INSERT INTO rdo_diarios (company_id, obra_nome, ogs_id, data, turno, tipo_rdo, status_validacao,
                               preenchido_por, local, observacoes_gerais)
      VALUES (v_ogs.company_id, v_ogs.ogs_number, v_ogs.id, v_data, 'diurno', 'AUTOMATICO', 'enviado',
              'Sistema (RDO automático)', v_ogs.location_address,
              'RDO gerado automaticamente: presença presumida, sem horário informado. Conferir antes de validar.')
      RETURNING id INTO v_rdo_id;
    ELSE
      v_rdo_id := v_exist;
    END IF;

    INSERT INTO rdo_efetivo (rdo_id, company_id, employee_id, nome, matricula, funcao, quantidade, entrada, saida)
    SELECT v_rdo_id, v_ogs.company_id, a.id, a.name, a.matricula, a.funcao, 1, NULL, NULL
    FROM _auto_rdo_alvo a
    WHERE NOT a.ja
      AND NOT EXISTS (SELECT 1 FROM rdo_efetivo x WHERE x.rdo_id = v_rdo_id AND x.employee_id = a.id);

    acao := CASE WHEN v_exist IS NULL THEN 'RDO criado' ELSE 'RDO existente complementado' END;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.gerar_rdo_automatico(date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_rdo_automatico(date, boolean) TO service_role;

-- Só Super_Admin / RDO_Admin (Programador de Obras) valida direto um RDO AUTOMATICO.
CREATE OR REPLACE FUNCTION public.trg_guard_rdo_automatico_validacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.tipo_rdo = 'AUTOMATICO'
     AND NEW.status_validacao = 'validado' AND OLD.status_validacao IS DISTINCT FROM 'validado'
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM user_admin_roles uar JOIN admin_roles ar ON ar.id = uar.role_id
       WHERE uar.user_id = auth.uid() AND uar.company_id = OLD.company_id AND uar.is_active IS TRUE
         AND ar.name IN ('RDO_Admin','Super_Admin'))
  THEN
    RAISE EXCEPTION 'RDO automático só pode ser validado pelo Programador de Obras.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_a_guard_rdo_automatico_validacao ON public.rdo_diarios;
CREATE TRIGGER trg_a_guard_rdo_automatico_validacao
  BEFORE UPDATE ON public.rdo_diarios
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_rdo_automatico_validacao();

-- Agendamento (NÃO ativado nesta migração): rodar só após conferir o dry-run.
-- SELECT cron.schedule('rdo-automatico-presenca', '50 2 * * *', $$SELECT public.gerar_rdo_automatico(NULL, false)$$);

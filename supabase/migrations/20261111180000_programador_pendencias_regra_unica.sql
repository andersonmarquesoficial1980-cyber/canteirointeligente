-- Alinha a regra de Pendências do Programador com a Central de Operações:
-- quem lançou diário de equipamento (operador/motorista), foi encarregado de RDO ou fez RDO Técnico no dia
-- NÃO é mais pendência. Mesma assinatura/retorno: a tela do Programador não muda. Sem DML em dados.
BEGIN;

CREATE OR REPLACE FUNCTION public.programador_pendencias(p_company_id uuid, p_data date)
RETURNS TABLE(employee_id uuid, nome text, matricula text, funcao text, equipe text,
              ultima_ogs text, ultima_data date, ultima_equipe_rdo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.programador_observacoes_autorizado(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso ao WF Programador nesta empresa';
  END IF;
  RETURN QUERY
  WITH dia AS (
    -- Presença no dia = QUALQUER lançamento (mesma regra da Central de Operações):
    -- efetivo do RDO, encarregado do RDO, operador/motorista em diário de equipamento enviado, RDO Técnico.
    SELECT ef.employee_id AS id, public.wf_auto_rdo_norm(trim(n)) AS nn
    FROM rdo_efetivo ef JOIN rdo_diarios r ON r.id = ef.rdo_id
    LEFT JOIN LATERAL unnest(string_to_array(ef.nome,'|||')) n ON true
    WHERE r.company_id = p_company_id AND r.data = p_data AND r.status_validacao <> 'rascunho'
    UNION ALL
    SELECT r.encarregado_employee_id, public.wf_auto_rdo_norm(trim(r.encarregado))
    FROM rdo_diarios r
    WHERE r.company_id = p_company_id AND r.data = p_data AND r.status_validacao <> 'rascunho'
      AND (r.encarregado_employee_id IS NOT NULL OR nullif(trim(r.encarregado),'') IS NOT NULL)
    UNION ALL
    SELECT coalesce(d.operator_id, d.operator_solo_id),
           public.wf_auto_rdo_norm(trim(coalesce(nullif(trim(d.operator_name),''), d.operator_solo)))
    FROM equipment_diaries d
    WHERE d.company_id = p_company_id AND d.date = p_data AND d.status = 'enviado' AND d.is_auto IS NOT TRUE
    UNION ALL
    SELECT NULL::uuid, public.wf_auto_rdo_norm(trim(p.nome_completo))
    FROM rdo_engenheiro t JOIN profiles p ON p.user_id = t.engenheiro_id
    WHERE t.company_id = p_company_id AND t.data = p_data
  ), recente AS (
    SELECT ef.employee_id AS id, public.wf_auto_rdo_norm(trim(n)) AS nn, r.obra_nome, r.data, r.equipe
    FROM rdo_efetivo ef JOIN rdo_diarios r ON r.id = ef.rdo_id
    LEFT JOIN LATERAL unnest(string_to_array(ef.nome,'|||')) n ON true
    WHERE r.company_id = p_company_id AND r.data < p_data AND r.data >= p_data - 30
      AND r.status_validacao <> 'rascunho' AND r.tipo_rdo IS DISTINCT FROM 'AUTOMATICO'
  )
  SELECT e.id, e.name, e.matricula, coalesce(f.nome, e.role), e.equipe,
         l.obra_nome, l.data, l.equipe
  FROM employees e
  LEFT JOIN funcoes f ON f.id = e.funcao_id
  LEFT JOIN LATERAL (
    SELECT x.obra_nome, x.data, x.equipe FROM recente x
    WHERE x.id = e.id OR x.nn = public.wf_auto_rdo_norm(e.name)
    ORDER BY x.data DESC LIMIT 1) l ON true
  WHERE e.company_id = p_company_id AND e.origem = 'PROPRIO' AND e.status = 'ativo'
    AND (e.data_admissao IS NULL OR e.data_admissao !~ '^\d{4}-\d{2}-\d{2}' OR left(e.data_admissao,10) <= p_data::text)
    AND (e.data_demissao IS NULL OR e.data_demissao >= p_data)
    AND NOT public.wf_auto_rdo_area_excluida(e.equipe, e.centro_custo::text)
    AND NOT (public.wf_auto_rdo_norm(e.equipe) ~ '(GRU|COPASA)'
             OR public.wf_auto_rdo_norm(e.centro_custo::text) ~ '(GRU|COPASA)'
             OR e.centro_custo::text IN ('2529','2339'))
    AND NOT EXISTS (SELECT 1 FROM dia d WHERE d.id = e.id OR d.nn = public.wf_auto_rdo_norm(e.name))
    AND NOT EXISTS (SELECT 1 FROM alocacao_diaria a WHERE a.company_id = p_company_id
                    AND a.employee_id = e.id AND a.data = p_data)
  ORDER BY e.equipe NULLS LAST, e.name;
END $$;

REVOKE ALL ON FUNCTION public.programador_pendencias(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_pendencias(uuid,date) TO authenticated;
COMMIT;

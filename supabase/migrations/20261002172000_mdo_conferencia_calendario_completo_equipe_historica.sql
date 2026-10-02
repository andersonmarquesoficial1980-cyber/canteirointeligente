-- Uma célula por funcionário cadastrado e dia do período, independentemente de
-- status, equipe, RDO ou vínculo. Sem OGS válida exige decisão antes de aprovar.
-- Não modifica cadastros, RDOs, OGS nem versões já aprovadas.
CREATE OR REPLACE FUNCTION public.mdo_custos_historico(p_empresa uuid,p_inicio date)
RETURNS TABLE(id uuid, employee_id uuid, data date, created_at timestamptz,
  campo text, antes text, depois text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_inicio IS NULL OR NOT public.mdo_custos_pode(p_empresa,'edit') THEN
    RAISE EXCEPTION 'Histórico MDO não autorizado';
  END IF;
  RETURN QUERY
    SELECT h.id,h.employee_id,h.data,h.created_at,
      CASE WHEN h.descricao LIKE 'Mudança rápida de equipe: %' THEN 'equipe' ELSE 'status' END,
      pg_catalog.split_part(pg_catalog.regexp_replace(h.descricao,'^Mudança rápida de (equipe|status): ',''),' → ',1),
      pg_catalog.split_part(pg_catalog.regexp_replace(h.descricao,'^Mudança rápida de (equipe|status): ',''),' → ',2)
    FROM public.employee_historico h JOIN public.employees e ON e.id=h.employee_id AND e.company_id=p_empresa
    WHERE h.company_id=p_empresa AND h.data>=p_inicio AND h.data<=CURRENT_DATE
      AND h.descricao ~ '^Mudança rápida de (equipe|status): .+ → .+$';
END $$;
REVOKE ALL ON FUNCTION public.mdo_custos_historico(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mdo_custos_historico(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.mdo_custos_alterar(p_periodo uuid, p_revisao integer, p_celulas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; c jsonb; v_antes jsonb; v_employee uuid; v_dia date; v_ogs uuid; v_disp text; v_motivo text;
BEGIN
  SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
  IF v.id IS NULL OR v.status <> 'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'edit') THEN RAISE EXCEPTION 'Rascunho indisponível'; END IF;
  IF p_revisao IS DISTINCT FROM v.revisao THEN RAISE EXCEPTION 'A conferência foi alterada por outra sessão; atualize a página'; END IF;
  IF p_celulas IS NULL OR pg_catalog.jsonb_typeof(p_celulas) <> 'array' OR pg_catalog.jsonb_array_length(p_celulas) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 200 células por lote';
  END IF;
  FOR c IN SELECT value FROM pg_catalog.jsonb_array_elements(p_celulas) LOOP
    v_employee := (c->>'employee_id')::uuid; v_dia := (c->>'data')::date;
    v_disp := c->>'disposition'; v_ogs := nullif(c->>'ogs_id','')::uuid; v_motivo := pg_catalog.btrim(coalesce(c->>'reason',''));
    IF v_dia NOT BETWEEN v.data_inicio AND v.data_fim OR v_disp NOT IN ('ogs','exception','exclude')
       OR NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=v_employee AND e.company_id=v.company_id)
       OR (v_disp='ogs' AND (v_ogs IS NULL OR NOT EXISTS(SELECT 1 FROM public.ogs_reference o WHERE o.id=v_ogs AND o.company_id=v.company_id)))
       OR (v_disp<>'ogs' AND (v_ogs IS NOT NULL OR length(v_motivo)<3)) THEN
      RAISE EXCEPTION 'Decisão inválida para funcionário/dia/OGS da empresa';
    END IF;
    SELECT pg_catalog.to_jsonb(d) INTO v_antes FROM public.mdo_custos_decisoes d
      WHERE d.periodo_id=v.id AND d.employee_id=v_employee AND d.dia=v_dia;
    INSERT INTO public.mdo_custos_decisoes(periodo_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,alterado_por)
      VALUES(v.id,v.company_id,v_employee,v_dia,
        CASE v_disp WHEN 'exception' THEN 'excecao' WHEN 'exclude' THEN 'excluir' ELSE 'ogs' END,
        v_ogs,v_motivo,auth.uid())
      ON CONFLICT(periodo_id,employee_id,dia) DO UPDATE SET disposicao=excluded.disposicao,
        ogs_id=excluded.ogs_id,motivo=excluded.motivo,alterado_por=excluded.alterado_por,alterado_em=now();
    INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,employee_id,dia,acao,antes,depois,ator)
      VALUES(v.company_id,v.id,v_employee,v_dia,'alterar',v_antes,c,auth.uid());
  END LOOP;
  UPDATE public.mdo_custos_periodos SET revisao=revisao+1 WHERE id=v.id RETURNING revisao INTO p_revisao;
  RETURN p_revisao;
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_aprovar(p_periodo uuid, p_revisao integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; v_total integer;
BEGIN
  SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
  IF v.id IS NULL OR v.status <> 'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'approve') THEN RAISE EXCEPTION 'Aprovação não autorizada'; END IF;
  IF v.revisao IS DISTINCT FROM p_revisao THEN RAISE EXCEPTION 'A conferência mudou; revise antes de aprovar'; END IF;
  -- Captura e valida a fonte em uma única instrução; um RDO concorrente não pode mudar entre duas leituras.
  WITH fonte AS MATERIALIZED (
    SELECT r.data AS dia,e.id AS employee_id,r.id AS rdo_id,r.ogs_id,o.ogs_number
    FROM public.rdo_diarios r JOIN public.rdo_efetivo ef ON ef.rdo_id=r.id
    CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(coalesce(ef.nome,''), '\|\|\|') AS parte(nome)
    JOIN public.employees e ON e.company_id=v.company_id AND (
      (ef.employee_id=e.id AND coalesce(ef.nome,'') NOT LIKE '%|||%') OR
      (public.mdo_custos_nome(parte.nome)=public.mdo_custos_nome(e.name)
       AND (ef.employee_id IS NULL OR coalesce(ef.nome,'') LIKE '%|||%')
       AND NOT EXISTS(SELECT 1 FROM public.employees outro WHERE outro.company_id=v.company_id AND outro.id<>e.id
         AND public.mdo_custos_nome(outro.name)=public.mdo_custos_nome(parte.nome)))
    )
    LEFT JOIN public.ogs_reference o ON o.id=r.ogs_id AND o.company_id=v.company_id
    WHERE r.company_id=v.company_id AND r.data BETWEEN v.data_inicio AND v.data_fim
      AND coalesce(r.status_validacao,'')<>'rascunho'
  ), agrupado AS (
    SELECT employee_id,dia,pg_catalog.array_agg(DISTINCT ogs_id) FILTER(WHERE ogs_number IS NOT NULL) AS ogs_ids,
      pg_catalog.string_agg(DISTINCT ogs_number,' | ') AS ogs_rdo,
      pg_catalog.string_agg(DISTINCT rdo_id::text,' | ') AS rdo_ids FROM fonte GROUP BY employee_id,dia
  ), grade AS (
    SELECT e.id AS employee_id,d.dia::date AS dia,e.name,e.role,
      coalesce(nullif(hist.equipe,''),e.equipe) AS equipe,e.matricula,
      a.ogs_ids,a.ogs_rdo,a.rdo_ids,c.disposicao,c.ogs_id AS ogs_manual,c.motivo
    FROM public.employees e CROSS JOIN LATERAL pg_catalog.generate_series(v.data_inicio,v.data_fim,'1 day'::interval) AS d(dia)
    -- A primeira mudança POSTERIOR ao dia contém a equipe daquele dia no campo 'antes'.
    LEFT JOIN LATERAL (
      SELECT pg_catalog.split_part(pg_catalog.regexp_replace(h.descricao,'^Mudança rápida de equipe: ',''),' → ',1) AS equipe
      FROM public.employee_historico h WHERE h.company_id=v.company_id AND h.employee_id=e.id
        AND h.data>d.dia::date AND h.data<=CURRENT_DATE
        AND h.descricao ~ '^Mudança rápida de equipe: .+ → .+$'
      ORDER BY h.data,h.created_at,h.id LIMIT 1
    ) hist ON true
    LEFT JOIN agrupado a ON a.employee_id=e.id AND a.dia=d.dia::date
    LEFT JOIN public.mdo_custos_decisoes c ON c.periodo_id=v.id AND c.employee_id=e.id AND c.dia=d.dia::date
    WHERE e.company_id=v.company_id
  ), resolvida AS (
    SELECT g.*, CASE WHEN g.disposicao='ogs' THEN g.ogs_manual
      WHEN g.disposicao IS NULL AND coalesce(pg_catalog.array_length(g.ogs_ids,1),0)=1 THEN g.ogs_ids[1]
      ELSE NULL END AS ogs_final FROM grade g
  ), preparada AS MATERIALIZED (
    SELECT x.*, o.ogs_number AS ogs_custos,
      CASE WHEN x.disposicao='excluir' THEN 'excluir' WHEN x.disposicao='excecao' THEN 'excecao'
        WHEN x.ogs_final IS NOT NULL AND o.ogs_number IS NOT NULL AND pg_catalog.btrim(o.ogs_number) <> '' THEN 'ogs'
        ELSE 'pendente' END AS final
    FROM resolvida x LEFT JOIN public.ogs_reference o ON o.id=x.ogs_final AND o.company_id=v.company_id
  ), validacao AS (SELECT count(*) FILTER (WHERE final='pendente') AS pendentes FROM preparada)
  INSERT INTO public.mdo_custos_fechado(periodo_id,company_id,employee_id,dia,nome,funcao,equipe,matricula,ogs_rdo,ogs_custos,disposicao,motivo,rdo_ids,aprovado_em)
  SELECT v.id,v.company_id,p.employee_id,p.dia,p.name,p.role,p.equipe,p.matricula,p.ogs_rdo,p.ogs_custos,
    p.final,coalesce(p.motivo,''),p.rdo_ids,now()
  FROM preparada p CROSS JOIN validacao x WHERE x.pendentes=0;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  IF v_total=0 THEN RAISE EXCEPTION 'Há funcionário/dia pendente; resolva antes de aprovar'; END IF;
  SELECT count(*) INTO v_total FROM public.mdo_custos_fechado WHERE periodo_id=v.id AND disposicao <> 'excluir';
  IF v_total=0 THEN RAISE EXCEPTION 'Não há funcionários/dias incluídos para Custos'; END IF;
  UPDATE public.mdo_custos_periodos SET status='aprovado',aprovado_por=auth.uid(),aprovado_em=now(),total_linhas=v_total WHERE id=v.id;
  INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator)
    VALUES(v.company_id,v.id,'aprovar',pg_catalog.jsonb_build_object('linhas',v_total,'versao',v.versao),auth.uid());
  RETURN v_total;
END $$;

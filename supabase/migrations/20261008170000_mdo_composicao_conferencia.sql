-- MDO: composição explícita, fonte única da grade/fechamento e snapshot de status.
-- Aditiva: não altera cadastros, RDOs, decisões ou aprovações existentes.
BEGIN;
ALTER TABLE public.mdo_custos_periodos ADD COLUMN IF NOT EXISTS funcionarios_incluidos uuid[];
ALTER TABLE public.mdo_custos_periodos ADD COLUMN IF NOT EXISTS colunas text[] NOT NULL DEFAULT ARRAY['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos'];
ALTER TABLE public.mdo_custos_fechado ADD COLUMN IF NOT EXISTS status_dia text;

-- Apenas auxiliares internas: executadas por RPCs autorizadas, nunca pela API diretamente.
CREATE OR REPLACE FUNCTION public.mdo_custos_base(p_empresa uuid,p_inicio date,p_fim date)
RETURNS TABLE(employee_id uuid,dia date,nome text,matricula text,funcao text,equipe text,status_dia text,
  ogs_rdo text,ogs_custos text,rdo_ids text,historico_equipe boolean,historico_status boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH pessoas AS MATERIALIZED (
  SELECT e.*,public.mdo_custos_nome(e.name) AS nome_norm FROM public.employees e WHERE e.company_id=p_empresa
), nomes_unicos AS (
  SELECT nome_norm,min(id::text)::uuid AS id FROM pessoas WHERE nome_norm<>'' GROUP BY nome_norm HAVING count(*)=1
), fonte AS MATERIALIZED (
  SELECT r.data,coalesce(direto.id,por_nome.id) AS employee_id,r.id AS rdo_id,o.id AS ogs_id,o.ogs_number
  FROM public.rdo_diarios r JOIN public.rdo_efetivo ef ON ef.rdo_id=r.id
  CROSS JOIN LATERAL pg_catalog.regexp_split_to_table(coalesce(ef.nome,''),'\|\|\|') AS parte(nome)
  LEFT JOIN pessoas direto ON direto.id=ef.employee_id AND coalesce(ef.nome,'') NOT LIKE '%|||%'
  LEFT JOIN nomes_unicos por_nome ON por_nome.nome_norm=public.mdo_custos_nome(parte.nome)
    AND (ef.employee_id IS NULL OR coalesce(ef.nome,'') LIKE '%|||%')
  LEFT JOIN public.ogs_reference o ON o.id=r.ogs_id AND o.company_id=p_empresa AND pg_catalog.btrim(o.ogs_number)<>''
  WHERE r.company_id=p_empresa AND r.data BETWEEN p_inicio AND p_fim AND coalesce(r.status_validacao,'')<>'rascunho'
), agregado AS (
  SELECT employee_id,data,pg_catalog.string_agg(DISTINCT ogs_number,' | ' ORDER BY ogs_number) AS ogs_rdo,
    CASE WHEN count(DISTINCT ogs_id)=1 AND count(*) FILTER (WHERE ogs_id IS NULL)=0 THEN min(ogs_number) END AS ogs_custos,
    pg_catalog.string_agg(DISTINCT rdo_id::text,' | ' ORDER BY rdo_id::text) AS rdo_ids
  FROM fonte WHERE employee_id IS NOT NULL GROUP BY employee_id,data
), historico AS MATERIALIZED (
  SELECT h.* FROM public.employee_historico h WHERE h.company_id=p_empresa AND h.data>p_inicio AND h.data<=CURRENT_DATE
    AND h.descricao ~ '^Mudança rápida de (equipe|status): .+ → .+$'
)
SELECT e.id,d.dia::date,e.name,e.matricula,e.role,
  coalesce(nullif(eq.antes,''),nullif(e.equipe,''),'SEM EQUIPE'),
  CASE WHEN nullif(e.data_admissao,'') IS NOT NULL AND e.data_admissao::date>d.dia::date THEN 'não admitido'
       WHEN e.data_demissao IS NOT NULL AND e.data_demissao<d.dia::date THEN 'demitido'
       ELSE coalesce(nullif(st.antes,''),e.status,'não informado') END,
  a.ogs_rdo,a.ogs_custos,a.rdo_ids,eq.antes IS NOT NULL,st.antes IS NOT NULL
FROM pessoas e CROSS JOIN LATERAL pg_catalog.generate_series(p_inicio,p_fim,'1 day'::interval) d(dia)
LEFT JOIN agregado a ON a.employee_id=e.id AND a.data=d.dia::date
LEFT JOIN LATERAL (SELECT pg_catalog.split_part(pg_catalog.regexp_replace(h.descricao,'^Mudança rápida de equipe: ',''),' → ',1) AS antes
  FROM historico h WHERE h.employee_id=e.id AND h.data>d.dia::date AND h.descricao LIKE 'Mudança rápida de equipe: %'
  ORDER BY h.data,h.created_at,h.id LIMIT 1) eq ON true
LEFT JOIN LATERAL (SELECT pg_catalog.split_part(pg_catalog.regexp_replace(h.descricao,'^Mudança rápida de status: ',''),' → ',1) AS antes
  FROM historico h WHERE h.employee_id=e.id AND h.data>d.dia::date AND h.descricao LIKE 'Mudança rápida de status: %'
  ORDER BY h.data,h.created_at,h.id LIMIT 1) st ON true;
$$;
REVOKE ALL ON FUNCTION public.mdo_custos_base(uuid,date,date) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mdo_custos_grade_interna(p_empresa uuid,p_inicio date,p_fim date,p_periodo uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH config AS (SELECT funcionarios_incluidos FROM public.mdo_custos_periodos WHERE id=p_periodo AND company_id=p_empresa),
resolvida AS (
 SELECT b.employee_id,b.dia,b.nome,b.matricula,b.funcao,b.equipe,b.status_dia,b.ogs_rdo,b.rdo_ids,b.historico_equipe,b.historico_status,
   CASE WHEN c.disposicao='ogs' THEN o.ogs_number WHEN c.disposicao IS NOT NULL THEN NULL ELSE b.ogs_custos END AS ogs_custos,
   coalesce(c.motivo,'') AS motivo,coalesce(c.disposicao,'ogs') AS disposicao,
   coalesce(b.employee_id=ANY((SELECT funcionarios_incluidos FROM config)::uuid[]),true) AS incluido
 FROM public.mdo_custos_base(p_empresa,p_inicio,p_fim) b
 LEFT JOIN public.mdo_custos_decisoes c ON c.periodo_id=p_periodo AND c.company_id=p_empresa AND c.employee_id=b.employee_id AND c.dia=b.dia
 LEFT JOIN public.ogs_reference o ON o.id=c.ogs_id AND o.company_id=p_empresa AND pg_catalog.btrim(o.ogs_number)<>''
), linhas AS (
 SELECT r.*,CASE WHEN NOT incluido THEN 'FORA DO RELATÓRIO' WHEN disposicao='excluir' THEN 'FORA DE CUSTOS'
 WHEN disposicao='excecao' THEN 'JUSTIFICADO' WHEN nullif(pg_catalog.btrim(ogs_custos),'') IS NOT NULL THEN 'ALOCADO' ELSE 'PENDENTE' END AS situacao FROM resolvida r
)
SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY employee_id,dia),'[]'::jsonb) FROM linhas l;
$$;
REVOKE ALL ON FUNCTION public.mdo_custos_grade_interna(uuid,date,date,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mdo_custos_carregar(p_empresa uuid,p_inicio date,p_fim date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_edit boolean; v_id uuid; v_grade jsonb; v_periodos jsonb; v_ogs jsonb;
BEGIN
 IF NOT public.mdo_custos_pode(p_empresa,'export') THEN RAISE EXCEPTION 'Consulta MDO não autorizada'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_fim<p_inicio OR p_fim-p_inicio>92 THEN RAISE EXCEPTION 'Período inválido (máximo 93 dias)'; END IF;
 v_edit:=public.mdo_custos_pode(p_empresa,'edit');
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY versao DESC),'[]'::jsonb) INTO v_periodos
 FROM public.mdo_custos_periodos p WHERE p.company_id=p_empresa AND p.data_inicio=p_inicio AND p.data_fim=p_fim AND (v_edit OR p.status='aprovado');
 SELECT id INTO v_id FROM public.mdo_custos_periodos WHERE company_id=p_empresa AND data_inicio=p_inicio AND data_fim=p_fim ORDER BY versao DESC LIMIT 1;
 IF v_edit THEN
   v_grade:=public.mdo_custos_grade_interna(p_empresa,p_inicio,p_fim,v_id);
   SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'ogs_number',ogs_number) ORDER BY ogs_number,id),'[]'::jsonb) INTO v_ogs
     FROM public.ogs_reference WHERE company_id=p_empresa AND nullif(pg_catalog.btrim(ogs_number),'') IS NOT NULL;
 ELSE v_grade:='[]'::jsonb; v_ogs:='[]'::jsonb; END IF;
 RETURN pg_catalog.jsonb_build_object('periodos',v_periodos,'grade',v_grade,'ogs',v_ogs,'assinatura',pg_catalog.md5(v_grade::text));
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_configurar(p_periodo uuid,p_revisao integer,p_funcionarios uuid[],p_colunas text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; v_ids uuid[];
BEGIN
 SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
 IF v.id IS NULL OR v.status<>'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'edit') THEN RAISE EXCEPTION 'Rascunho indisponível'; END IF;
 IF p_revisao IS DISTINCT FROM v.revisao THEN RAISE EXCEPTION 'A conferência foi alterada; atualize antes de salvar'; END IF;
 IF p_funcionarios IS NULL OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_funcionarios) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=x AND e.company_id=v.company_id)) THEN RAISE EXCEPTION 'Funcionário inválido para a empresa'; END IF;
 IF p_colunas IS NULL OR coalesce(pg_catalog.array_length(p_colunas,1),0)=0 OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_colunas) c WHERE c IS NULL OR c NOT IN ('nome','matricula','equipe','funcao','status_dia','dia','ogs_custos','ogs_rdo','situacao','motivo','rdo_ids'))
 OR (SELECT count(DISTINCT c) FROM pg_catalog.unnest(p_colunas) c)<>pg_catalog.array_length(p_colunas,1) THEN RAISE EXCEPTION 'Colunas inválidas'; END IF;
 SELECT coalesce(pg_catalog.array_agg(DISTINCT x ORDER BY x),'{}'::uuid[]) INTO v_ids FROM pg_catalog.unnest(p_funcionarios) x;
 UPDATE public.mdo_custos_periodos SET funcionarios_incluidos=v_ids,colunas=p_colunas,revisao=revisao+1 WHERE id=v.id RETURNING revisao INTO p_revisao;
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,antes,depois,ator) VALUES(v.company_id,v.id,'composicao',
  pg_catalog.jsonb_build_object('funcionarios',v.funcionarios_incluidos,'colunas',v.colunas),pg_catalog.jsonb_build_object('funcionarios',v_ids,'colunas',p_colunas),auth.uid());
 RETURN p_revisao;
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_abrir(p_empresa uuid,p_inicio date,p_fim date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_anterior public.mdo_custos_periodos%ROWTYPE;
BEGIN
 IF NOT public.mdo_custos_pode(p_empresa,'edit') THEN RAISE EXCEPTION 'Sem permissão para conferir MDO'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_fim<p_inicio OR p_fim-p_inicio>92 THEN RAISE EXCEPTION 'Período inválido'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_empresa::text),pg_catalog.hashtext(p_inicio::text||':'||p_fim::text));
 SELECT id INTO v_id FROM public.mdo_custos_periodos WHERE company_id=p_empresa AND data_inicio=p_inicio AND data_fim=p_fim AND status='rascunho';
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 SELECT * INTO v_anterior FROM public.mdo_custos_periodos WHERE company_id=p_empresa AND data_inicio=p_inicio AND data_fim=p_fim ORDER BY versao DESC LIMIT 1;
 INSERT INTO public.mdo_custos_periodos(company_id,data_inicio,data_fim,versao,criado_por,funcionarios_incluidos,colunas)
 VALUES(p_empresa,p_inicio,p_fim,coalesce(v_anterior.versao,0)+1,auth.uid(),v_anterior.funcionarios_incluidos,
 coalesce(v_anterior.colunas,ARRAY['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos'])) RETURNING id INTO v_id;
 IF v_anterior.id IS NOT NULL THEN
 INSERT INTO public.mdo_custos_decisoes(periodo_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,alterado_por)
 SELECT v_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,auth.uid() FROM public.mdo_custos_decisoes WHERE periodo_id=v_anterior.id AND company_id=p_empresa;
 END IF;
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator) VALUES(p_empresa,v_id,'abrir',pg_catalog.jsonb_build_object('versao',coalesce(v_anterior.versao,0)+1),auth.uid());
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_alterar(p_periodo uuid,p_revisao integer,p_celulas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; c jsonb; v_employee uuid; v_dia date; v_disp text; v_ogs uuid; v_motivo text; v_antes jsonb;
BEGIN
 SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
 IF v.id IS NULL OR v.status<>'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'edit') THEN RAISE EXCEPTION 'Rascunho indisponível'; END IF;
 IF p_revisao IS DISTINCT FROM v.revisao THEN RAISE EXCEPTION 'A conferência foi alterada; atualize antes de salvar'; END IF;
 IF p_celulas IS NULL OR pg_catalog.jsonb_typeof(p_celulas)<>'array' THEN RAISE EXCEPTION 'Lote inválido'; END IF;
 IF pg_catalog.jsonb_array_length(p_celulas) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Selecione entre 1 e 200 células por lote'; END IF;
 FOR c IN SELECT value FROM pg_catalog.jsonb_array_elements(p_celulas) LOOP
 v_employee:=(c->>'employee_id')::uuid; v_dia:=(c->>'data')::date; v_disp:=c->>'disposition'; v_ogs:=nullif(c->>'ogs_id','')::uuid; v_motivo:=pg_catalog.btrim(coalesce(c->>'reason',''));
 IF v_employee IS NULL OR v_dia IS NULL OR v_disp IS NULL OR v_dia NOT BETWEEN v.data_inicio AND v.data_fim OR v_disp NOT IN ('ogs','exception','exclude')
 OR NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=v_employee AND e.company_id=v.company_id)
 OR (v_disp='ogs' AND (v_ogs IS NULL OR NOT EXISTS(SELECT 1 FROM public.ogs_reference o WHERE o.id=v_ogs AND o.company_id=v.company_id AND nullif(pg_catalog.btrim(o.ogs_number),'') IS NOT NULL)))
 OR (v_disp<>'ogs' AND (v_ogs IS NOT NULL OR length(v_motivo)<3)) THEN RAISE EXCEPTION 'Decisão inválida para funcionário/dia/OGS da empresa'; END IF;
 SELECT pg_catalog.to_jsonb(d) INTO v_antes FROM public.mdo_custos_decisoes d WHERE periodo_id=v.id AND employee_id=v_employee AND dia=v_dia;
 INSERT INTO public.mdo_custos_decisoes(periodo_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,alterado_por)
 VALUES(v.id,v.company_id,v_employee,v_dia,CASE v_disp WHEN 'exception' THEN 'excecao' WHEN 'exclude' THEN 'excluir' ELSE 'ogs' END,v_ogs,v_motivo,auth.uid())
 ON CONFLICT(periodo_id,employee_id,dia) DO UPDATE SET disposicao=excluded.disposicao,ogs_id=excluded.ogs_id,motivo=excluded.motivo,alterado_por=excluded.alterado_por,alterado_em=now();
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,employee_id,dia,acao,antes,depois,ator) VALUES(v.company_id,v.id,v_employee,v_dia,'alterar',v_antes,c,auth.uid());
 END LOOP;
 UPDATE public.mdo_custos_periodos SET revisao=revisao+1 WHERE id=v.id RETURNING revisao INTO p_revisao;
 RETURN p_revisao;
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_publicar(p_periodo uuid,p_revisao integer,p_assinatura text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; g jsonb; n integer;
BEGIN
 SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
 IF v.id IS NULL OR v.status<>'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'approve') THEN RAISE EXCEPTION 'Aprovação não autorizada'; END IF;
 IF v.revisao IS DISTINCT FROM p_revisao THEN RAISE EXCEPTION 'A conferência mudou; atualize antes de aprovar'; END IF;
 IF v.funcionarios_incluidos IS NULL THEN RAISE EXCEPTION 'Salve a composição do relatório antes de validar'; END IF;
 g:=public.mdo_custos_grade_interna(v.company_id,v.data_inicio,v.data_fim,v.id);
 IF p_assinatura IS DISTINCT FROM pg_catalog.md5(g::text) THEN RAISE EXCEPTION 'A fonte mudou desde sua conferência. Atualize e revise antes de aprovar'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(g) r WHERE (r->>'incluido')::boolean AND r->>'situacao'='PENDENTE') THEN RAISE EXCEPTION 'Há dias pendentes no conjunto incluído'; END IF;
 SELECT count(*) INTO n FROM pg_catalog.jsonb_array_elements(g) r WHERE (r->>'incluido')::boolean AND r->>'disposicao'<>'excluir';
 IF n=0 THEN RAISE EXCEPTION 'Não há linhas incluídas para Custos'; END IF;
 INSERT INTO public.mdo_custos_fechado(periodo_id,company_id,employee_id,dia,nome,funcao,equipe,matricula,status_dia,ogs_rdo,ogs_custos,disposicao,motivo,rdo_ids,aprovado_em)
 SELECT v.id,v.company_id,(r->>'employee_id')::uuid,(r->>'dia')::date,r->>'nome',r->>'funcao',r->>'equipe',r->>'matricula',r->>'status_dia',r->>'ogs_rdo',r->>'ogs_custos',r->>'disposicao',r->>'motivo',r->>'rdo_ids',now()
 FROM pg_catalog.jsonb_array_elements(g) r WHERE (r->>'incluido')::boolean;
 UPDATE public.mdo_custos_periodos SET status='aprovado',aprovado_por=auth.uid(),aprovado_em=now(),total_linhas=n WHERE id=v.id;
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator) VALUES(v.company_id,v.id,'aprovar',pg_catalog.jsonb_build_object('linhas',n,'versao',v.versao,'assinatura',p_assinatura),auth.uid());
 RETURN n;
END $$;
-- Impede clientes antigos de publicar sem composição e assinatura da conferência.
CREATE OR REPLACE FUNCTION public.mdo_custos_aprovar(p_periodo uuid,p_revisao integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Atualize a tela MDO e use Validar e liberar'; END $$;
REVOKE ALL ON FUNCTION public.mdo_custos_carregar(uuid,date,date),public.mdo_custos_configurar(uuid,integer,uuid[],text[]),public.mdo_custos_publicar(uuid,integer,text),public.mdo_custos_abrir(uuid,date,date),public.mdo_custos_alterar(uuid,integer,jsonb),public.mdo_custos_aprovar(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mdo_custos_carregar(uuid,date,date),public.mdo_custos_configurar(uuid,integer,uuid[],text[]),public.mdo_custos_publicar(uuid,integer,text),public.mdo_custos_abrir(uuid,date,date),public.mdo_custos_alterar(uuid,integer,jsonb),public.mdo_custos_aprovar(uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

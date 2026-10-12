-- Correção de equipe por funcionário/dia apenas na conferência MDO.
-- Não altera employees, RDO, OGS nem versões aprovadas.
BEGIN;
CREATE TABLE public.mdo_custos_equipes_dia (
  periodo_id uuid NOT NULL REFERENCES public.mdo_custos_periodos(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  dia date NOT NULL,
  equipe text NOT NULL CHECK (length(btrim(equipe)) BETWEEN 1 AND 150),
  motivo text NOT NULL CHECK (length(btrim(motivo)) >= 3),
  alterado_por uuid NOT NULL REFERENCES auth.users(id),
  alterado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (periodo_id, employee_id, dia)
);
CREATE INDEX mdo_custos_equipes_dia_empresa ON public.mdo_custos_equipes_dia(company_id,periodo_id);
ALTER TABLE public.mdo_custos_equipes_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY mdo_equipes_dia_leitura ON public.mdo_custos_equipes_dia FOR SELECT TO authenticated
USING (public.mdo_custos_pode(company_id,'edit'));
REVOKE ALL ON public.mdo_custos_equipes_dia FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mdo_custos_equipes_dia TO authenticated;
ALTER TABLE public.mdo_custos_fechado ADD COLUMN equipe_original text;
ALTER TABLE public.mdo_custos_fechado ADD COLUMN equipe_corrigida boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mdo_custos_grade_interna(p_empresa uuid,p_inicio date,p_fim date,p_periodo uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH config AS (SELECT funcionarios_incluidos FROM public.mdo_custos_periodos WHERE id=p_periodo AND company_id=p_empresa),
resolvida AS (
 SELECT b.employee_id,b.dia,b.nome,b.matricula,b.funcao,coalesce(ed.equipe,b.equipe) AS equipe,
   b.equipe AS equipe_original, ed.equipe IS NOT NULL AS equipe_corrigida,
   b.status_dia,b.ogs_rdo,b.rdo_ids,b.historico_equipe,b.historico_status,
   CASE WHEN c.disposicao='ogs' THEN o.ogs_number WHEN c.disposicao IS NOT NULL THEN NULL ELSE b.ogs_custos END AS ogs_custos,
   coalesce(c.motivo,'') AS motivo,coalesce(c.disposicao,'ogs') AS disposicao,
   coalesce(b.employee_id=ANY((SELECT funcionarios_incluidos FROM config)::uuid[]),true) AS incluido
 FROM public.mdo_custos_base(p_empresa,p_inicio,p_fim) b
 LEFT JOIN public.mdo_custos_decisoes c ON c.periodo_id=p_periodo AND c.company_id=p_empresa AND c.employee_id=b.employee_id AND c.dia=b.dia
 LEFT JOIN public.mdo_custos_equipes_dia ed ON ed.periodo_id=p_periodo AND ed.company_id=p_empresa AND ed.employee_id=b.employee_id AND ed.dia=b.dia
 LEFT JOIN public.ogs_reference o ON o.id=c.ogs_id AND o.company_id=p_empresa AND pg_catalog.btrim(o.ogs_number)<>''
), linhas AS (
 SELECT r.*,CASE WHEN NOT incluido THEN 'FORA DO RELATÓRIO' WHEN disposicao='excluir' THEN 'FORA DE CUSTOS'
 WHEN disposicao='excecao' THEN 'JUSTIFICADO' WHEN nullif(pg_catalog.btrim(ogs_custos),'') IS NOT NULL THEN 'ALOCADO' ELSE 'PENDENTE' END AS situacao FROM resolvida r
)
SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY employee_id,dia),'[]'::jsonb) FROM linhas l;
$$;
REVOKE ALL ON FUNCTION public.mdo_custos_grade_interna(uuid,date,date,uuid) FROM PUBLIC,anon,authenticated;

-- Copia correções ao abrir uma nova versão. A versão anterior permanece congelada.
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
   INSERT INTO public.mdo_custos_equipes_dia(periodo_id,company_id,employee_id,dia,equipe,motivo,alterado_por)
   SELECT v_id,company_id,employee_id,dia,equipe,motivo,auth.uid() FROM public.mdo_custos_equipes_dia WHERE periodo_id=v_anterior.id AND company_id=p_empresa;
 END IF;
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator) VALUES(p_empresa,v_id,'abrir',pg_catalog.jsonb_build_object('versao',coalesce(v_anterior.versao,0)+1),auth.uid());
 RETURN v_id;
END $$;

-- p_equipe NULL remove a correção daquele dia, restaurando a equipe de origem.
CREATE FUNCTION public.mdo_custos_alterar_equipe(p_periodo uuid,p_revisao integer,p_celulas jsonb,p_equipe text,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.mdo_custos_periodos%ROWTYPE; c jsonb; v_employee uuid; v_dia date; v_antes jsonb; v_equipe text:=nullif(pg_catalog.btrim(p_equipe),''); v_motivo text:=pg_catalog.btrim(coalesce(p_motivo,''));
BEGIN
 SELECT * INTO v FROM public.mdo_custos_periodos WHERE id=p_periodo FOR UPDATE;
 IF v.id IS NULL OR v.status<>'rascunho' OR NOT public.mdo_custos_pode(v.company_id,'edit') THEN RAISE EXCEPTION 'Rascunho indisponível'; END IF;
 IF p_revisao IS DISTINCT FROM v.revisao THEN RAISE EXCEPTION 'A conferência mudou; atualize antes de salvar'; END IF;
 IF p_celulas IS NULL OR pg_catalog.jsonb_typeof(p_celulas)<>'array' OR pg_catalog.jsonb_array_length(p_celulas) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Selecione entre 1 e 200 funcionário/dia'; END IF;
 IF p_equipe IS NOT NULL AND (v_equipe IS NULL OR length(v_equipe)>150) THEN RAISE EXCEPTION 'Equipe inválida'; END IF;
 IF v_equipe IS NOT NULL AND (length(v_motivo)<3 OR NOT EXISTS (
   SELECT 1 FROM public.employees e WHERE e.company_id=v.company_id AND pg_catalog.btrim(e.equipe)=v_equipe
   UNION ALL
   SELECT 1 FROM public.mdo_custos_base(v.company_id,v.data_inicio,v.data_fim) b WHERE b.equipe=v_equipe
 )) THEN RAISE EXCEPTION 'Escolha uma equipe da empresa e informe o motivo'; END IF;
 FOR c IN SELECT value FROM pg_catalog.jsonb_array_elements(p_celulas) LOOP
   v_employee:=nullif(c->>'employee_id','')::uuid; v_dia:=nullif(c->>'dia','')::date;
   IF v_employee IS NULL OR v_dia IS NULL OR v_dia NOT BETWEEN v.data_inicio AND v.data_fim
      OR NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=v_employee AND e.company_id=v.company_id) THEN RAISE EXCEPTION 'Funcionário/dia inválido para esta empresa'; END IF;
   SELECT pg_catalog.to_jsonb(ed) INTO v_antes FROM public.mdo_custos_equipes_dia ed WHERE ed.periodo_id=v.id AND ed.company_id=v.company_id AND ed.employee_id=v_employee AND ed.dia=v_dia;
   IF v_equipe IS NULL THEN
     DELETE FROM public.mdo_custos_equipes_dia WHERE periodo_id=v.id AND company_id=v.company_id AND employee_id=v_employee AND dia=v_dia;
   ELSE
     INSERT INTO public.mdo_custos_equipes_dia(periodo_id,company_id,employee_id,dia,equipe,motivo,alterado_por)
     VALUES(v.id,v.company_id,v_employee,v_dia,v_equipe,v_motivo,auth.uid())
     ON CONFLICT(periodo_id,employee_id,dia) DO UPDATE SET equipe=excluded.equipe,motivo=excluded.motivo,alterado_por=excluded.alterado_por,alterado_em=now();
   END IF;
   INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,employee_id,dia,acao,antes,depois,ator)
   VALUES(v.company_id,v.id,v_employee,v_dia,'equipe_dia',v_antes,pg_catalog.jsonb_build_object('equipe',v_equipe,'motivo',v_motivo),auth.uid());
 END LOOP;
 UPDATE public.mdo_custos_periodos SET revisao=revisao+1 WHERE id=v.id RETURNING revisao INTO p_revisao;
 RETURN p_revisao;
END $$;
REVOKE ALL ON FUNCTION public.mdo_custos_alterar_equipe(uuid,integer,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mdo_custos_alterar_equipe(uuid,integer,jsonb,text,text) TO authenticated;

-- A assinatura de mdo_custos_publicar continua cobrindo a grade agora corrigida.
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
 INSERT INTO public.mdo_custos_fechado(periodo_id,company_id,employee_id,dia,nome,funcao,equipe,equipe_original,equipe_corrigida,matricula,status_dia,ogs_rdo,ogs_custos,disposicao,motivo,rdo_ids,aprovado_em)
 SELECT v.id,v.company_id,(r->>'employee_id')::uuid,(r->>'dia')::date,r->>'nome',r->>'funcao',r->>'equipe',r->>'equipe_original',coalesce((r->>'equipe_corrigida')::boolean,false),r->>'matricula',r->>'status_dia',r->>'ogs_rdo',r->>'ogs_custos',r->>'disposicao',r->>'motivo',r->>'rdo_ids',now()
 FROM pg_catalog.jsonb_array_elements(g) r WHERE (r->>'incluido')::boolean;
 UPDATE public.mdo_custos_periodos SET status='aprovado',aprovado_por=auth.uid(),aprovado_em=now(),total_linhas=n WHERE id=v.id;
 INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator) VALUES(v.company_id,v.id,'aprovar',pg_catalog.jsonb_build_object('linhas',n,'versao',v.versao,'assinatura',p_assinatura),auth.uid());
 RETURN n;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;

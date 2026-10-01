-- Conferência de MDO: revisão por funcionário/dia, publicação imutável e exportação aprovada.
-- NÃO aplica DML em cadastros, RDOs ou permissões existentes. ACL é provisionada separadamente após autorização.
CREATE TABLE IF NOT EXISTS public.mdo_custos_acl (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  capability text NOT NULL CHECK (capability IN ('edit', 'export')),
  PRIMARY KEY (company_id, user_id, capability)
);
CREATE TABLE IF NOT EXISTS public.mdo_custos_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado')),
  revisao integer NOT NULL DEFAULT 0,
  total_linhas integer,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  CHECK (data_fim >= data_inicio AND data_fim - data_inicio <= 92),
  UNIQUE (company_id, data_inicio, data_fim, versao)
);
CREATE UNIQUE INDEX IF NOT EXISTS mdo_custos_um_rascunho
  ON public.mdo_custos_periodos(company_id, data_inicio, data_fim) WHERE status = 'rascunho';
CREATE INDEX IF NOT EXISTS mdo_custos_periodos_lista ON public.mdo_custos_periodos(company_id, data_inicio, data_fim, versao DESC);

CREATE TABLE IF NOT EXISTS public.mdo_custos_decisoes (
  periodo_id uuid NOT NULL REFERENCES public.mdo_custos_periodos(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  dia date NOT NULL,
  disposicao text NOT NULL CHECK (disposicao IN ('ogs', 'excecao', 'excluir')),
  ogs_id uuid REFERENCES public.ogs_reference(id),
  motivo text NOT NULL DEFAULT '',
  alterado_por uuid NOT NULL REFERENCES auth.users(id),
  alterado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (periodo_id, employee_id, dia),
  CHECK ((disposicao = 'ogs' AND ogs_id IS NOT NULL) OR (disposicao <> 'ogs' AND ogs_id IS NULL)),
  CHECK (disposicao = 'ogs' OR length(trim(motivo)) >= 3)
);
CREATE INDEX IF NOT EXISTS mdo_custos_decisoes_empresa ON public.mdo_custos_decisoes(company_id, periodo_id);

CREATE TABLE IF NOT EXISTS public.mdo_custos_fechado (
  periodo_id uuid NOT NULL REFERENCES public.mdo_custos_periodos(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  dia date NOT NULL,
  nome text NOT NULL,
  funcao text,
  equipe text,
  matricula text,
  ogs_rdo text,
  ogs_custos text,
  disposicao text NOT NULL CHECK (disposicao IN ('ogs', 'excecao', 'excluir')),
  motivo text NOT NULL DEFAULT '',
  rdo_ids text,
  aprovado_em timestamptz NOT NULL,
  PRIMARY KEY (periodo_id, employee_id, dia)
);
CREATE INDEX IF NOT EXISTS mdo_custos_fechado_export ON public.mdo_custos_fechado(company_id, periodo_id, employee_id, dia);

CREATE TABLE IF NOT EXISTS public.mdo_custos_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  periodo_id uuid REFERENCES public.mdo_custos_periodos(id),
  employee_id uuid REFERENCES public.employees(id),
  dia date,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  ator uuid NOT NULL REFERENCES auth.users(id),
  registrado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mdo_custos_auditoria_periodo ON public.mdo_custos_auditoria(company_id, periodo_id, registrado_em);

ALTER TABLE public.mdo_custos_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdo_custos_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdo_custos_decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdo_custos_fechado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdo_custos_auditoria ENABLE ROW LEVEL SECURITY;

-- A conta proprietária é conferida em auth.users (não em um campo editável do frontend).
-- A função só aceita usuários vinculados à mesma empresa via profiles.user_id.
CREATE OR REPLACE FUNCTION public.mdo_custos_pode(p_empresa uuid, p_acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_acao IN ('edit', 'approve', 'export')
    AND EXISTS (SELECT 1 FROM public.companies co WHERE co.id = p_empresa)
    AND (
      -- Conta proprietária global pode aprovar somente quando confirmada e com perfil ativo global.
      (EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
        AND lower(u.email)='andersonmarquesoficial1980@gmail.com')
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.company_id IS NULL AND p.status='ativo'))
      OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.company_id=p_empresa AND p.status='ativo')
        AND (
          EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
            AND lower(u.email)='anderson@fremix.workflux.app')
          OR (p_acao <> 'approve' AND EXISTS (
            SELECT 1 FROM public.mdo_custos_acl a WHERE a.company_id=p_empresa AND a.user_id=auth.uid()
              AND (a.capability=p_acao OR (a.capability='edit' AND p_acao='export'))
          ))
        ))
    );
$$;
REVOKE ALL ON FUNCTION public.mdo_custos_pode(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdo_custos_pode(uuid,text) TO authenticated;

-- Mesma normalização conservadora do relatório: nome exato sem acentos, sem fuzzy.
CREATE OR REPLACE FUNCTION public.mdo_custos_nome(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT pg_catalog.upper(pg_catalog.btrim(pg_catalog.translate(pg_catalog.lower(coalesce(p_nome,'')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')));
$$;
REVOKE ALL ON FUNCTION public.mdo_custos_nome(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdo_custos_nome(text) TO authenticated;

DROP POLICY IF EXISTS mdo_periodos_leitura ON public.mdo_custos_periodos;
CREATE POLICY mdo_periodos_leitura ON public.mdo_custos_periodos FOR SELECT TO authenticated
USING ((status = 'aprovado' AND public.mdo_custos_pode(company_id,'export')) OR public.mdo_custos_pode(company_id,'edit'));
DROP POLICY IF EXISTS mdo_decisoes_leitura ON public.mdo_custos_decisoes;
CREATE POLICY mdo_decisoes_leitura ON public.mdo_custos_decisoes FOR SELECT TO authenticated
USING (public.mdo_custos_pode(company_id,'edit'));
DROP POLICY IF EXISTS mdo_fechado_leitura ON public.mdo_custos_fechado;
CREATE POLICY mdo_fechado_leitura ON public.mdo_custos_fechado FOR SELECT TO authenticated
USING (public.mdo_custos_pode(company_id,'export')
  AND (disposicao <> 'excluir' OR public.mdo_custos_pode(company_id,'edit'))
  AND EXISTS (
  SELECT 1 FROM public.mdo_custos_periodos p WHERE p.id = mdo_custos_fechado.periodo_id
    AND p.company_id = mdo_custos_fechado.company_id AND p.status = 'aprovado'
));
DROP POLICY IF EXISTS mdo_auditoria_leitura ON public.mdo_custos_auditoria;
CREATE POLICY mdo_auditoria_leitura ON public.mdo_custos_auditoria FOR SELECT TO authenticated
USING (public.mdo_custos_pode(company_id,'edit'));
REVOKE ALL ON public.mdo_custos_acl, public.mdo_custos_periodos, public.mdo_custos_decisoes, public.mdo_custos_fechado, public.mdo_custos_auditoria FROM anon, authenticated;
GRANT SELECT ON public.mdo_custos_periodos, public.mdo_custos_decisoes, public.mdo_custos_fechado, public.mdo_custos_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.mdo_custos_abrir(p_empresa uuid, p_inicio date, p_fim date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_versao integer; v_anterior uuid;
BEGIN
  IF NOT public.mdo_custos_pode(p_empresa,'edit') THEN RAISE EXCEPTION 'Sem permissão para conferir MDO'; END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 92 THEN RAISE EXCEPTION 'Período inválido'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_empresa::text), pg_catalog.hashtext(p_inicio::text || ':' || p_fim::text));
  SELECT id INTO v_id FROM public.mdo_custos_periodos
    WHERE company_id=p_empresa AND data_inicio=p_inicio AND data_fim=p_fim AND status='rascunho';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT id, versao INTO v_anterior, v_versao FROM public.mdo_custos_periodos
    WHERE company_id=p_empresa AND data_inicio=p_inicio AND data_fim=p_fim ORDER BY versao DESC LIMIT 1;
  INSERT INTO public.mdo_custos_periodos(company_id,data_inicio,data_fim,versao,criado_por)
    VALUES (p_empresa,p_inicio,p_fim,coalesce(v_versao,0)+1,auth.uid()) RETURNING id INTO v_id;
  IF v_anterior IS NOT NULL THEN
    INSERT INTO public.mdo_custos_decisoes(periodo_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,alterado_por)
      SELECT v_id,company_id,employee_id,dia,disposicao,ogs_id,motivo,auth.uid()
      FROM public.mdo_custos_decisoes WHERE periodo_id=v_anterior;
  END IF;
  INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator)
    VALUES(p_empresa,v_id,'abrir',pg_catalog.jsonb_build_object('versao',coalesce(v_versao,0)+1),auth.uid());
  RETURN v_id;
END $$;

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
       OR NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=v_employee AND e.company_id=v.company_id
         AND (e.status='ativo' OR e.data_demissao >= v_dia)
         AND (e.data_admissao IS NULL OR e.data_admissao::date <= v_dia)
         AND (e.data_demissao IS NULL OR e.data_demissao >= v_dia))
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

-- Resolve RDO por ID (um único nome) ou nome exato único; não atribui o mesmo ID a nomes concatenados.
-- Não infere OGS de obra em texto livre e preserva múltiplas OGS como conflito a revisar.
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
    SELECT e.id AS employee_id,d.dia::date AS dia,e.name,e.role,e.equipe,e.matricula,
      a.ogs_ids,a.ogs_rdo,a.rdo_ids,c.disposicao,c.ogs_id AS ogs_manual,c.motivo
    FROM public.employees e CROSS JOIN LATERAL pg_catalog.generate_series(v.data_inicio,v.data_fim,'1 day'::interval) AS d(dia)
    LEFT JOIN agrupado a ON a.employee_id=e.id AND a.dia=d.dia::date
    LEFT JOIN public.mdo_custos_decisoes c ON c.periodo_id=v.id AND c.employee_id=e.id AND c.dia=d.dia::date
    WHERE e.company_id=v.company_id AND (e.status='ativo' OR e.data_demissao>=d.dia::date)
      AND (e.data_admissao IS NULL OR e.data_admissao::date<=d.dia::date)
      AND (e.data_demissao IS NULL OR e.data_demissao>=d.dia::date)
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
  IF v_total=0 THEN RAISE EXCEPTION 'Sem funcionários elegíveis ou há funcionário/dia pendentes; resolva antes de aprovar'; END IF;
  SELECT count(*) INTO v_total FROM public.mdo_custos_fechado WHERE periodo_id=v.id AND disposicao <> 'excluir';
  IF v_total=0 THEN RAISE EXCEPTION 'Não há funcionários/dias incluídos para Custos'; END IF;
  UPDATE public.mdo_custos_periodos SET status='aprovado',aprovado_por=auth.uid(),aprovado_em=now(),total_linhas=v_total WHERE id=v.id;
  INSERT INTO public.mdo_custos_auditoria(company_id,periodo_id,acao,depois,ator)
    VALUES(v.company_id,v.id,'aprovar',pg_catalog.jsonb_build_object('linhas',v_total,'versao',v.versao),auth.uid());
  RETURN v_total;
END $$;

REVOKE ALL ON FUNCTION public.mdo_custos_abrir(uuid,date,date), public.mdo_custos_alterar(uuid,integer,jsonb), public.mdo_custos_aprovar(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdo_custos_abrir(uuid,date,date), public.mdo_custos_alterar(uuid,integer,jsonb), public.mdo_custos_aprovar(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mdo_custos_listar_acessos(p_empresa uuid)
RETURNS TABLE(user_id uuid,nome text,email text,permitido boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.mdo_custos_pode(p_empresa,'approve') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  RETURN QUERY SELECT p.user_id,p.nome_completo,p.email,
    EXISTS(SELECT 1 FROM public.mdo_custos_acl a WHERE a.company_id=p_empresa AND a.user_id=p.user_id AND a.capability='export')
    FROM public.profiles p WHERE p.company_id=p_empresa AND p.status='ativo' ORDER BY p.nome_completo;
END $$;

CREATE OR REPLACE FUNCTION public.mdo_custos_definir_exportador(p_empresa uuid,p_usuario uuid,p_permitir boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.mdo_custos_pode(p_empresa,'approve') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.company_id=p_empresa AND p.user_id=p_usuario AND p.status='ativo') THEN
    RAISE EXCEPTION 'Usuário não pertence à empresa ou não está ativo';
  END IF;
  IF p_permitir THEN
    INSERT INTO public.mdo_custos_acl(company_id,user_id,capability) VALUES(p_empresa,p_usuario,'export') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.mdo_custos_acl WHERE company_id=p_empresa AND user_id=p_usuario AND capability='export';
  END IF;
  INSERT INTO public.mdo_custos_auditoria(company_id,acao,depois,ator)
    VALUES(p_empresa,'acesso_exportacao',pg_catalog.jsonb_build_object('user_id',p_usuario,'permitir',p_permitir),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.mdo_custos_listar_acessos(uuid), public.mdo_custos_definir_exportador(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mdo_custos_listar_acessos(uuid), public.mdo_custos_definir_exportador(uuid,uuid,boolean) TO authenticated;

-- Diagnóstico read-only pré-deploy (SQL Editor):
-- SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('employees','rdo_diarios','rdo_efetivo','ogs_reference','profiles') ORDER BY table_name,column_name;
-- Após aprovação explícita da migração, validar com usuário editor, usuário Custos e outra empresa;
-- somente então atribuir ACL de exportação individualmente, após autorização específica.

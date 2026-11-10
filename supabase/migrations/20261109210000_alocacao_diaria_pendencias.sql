-- Alocação diária manual (Programador de Obras) para quem não está em nenhum RDO no dia.
-- Fonte separada do RDO (não gera RDO falso). Pendência = funcionário PROPRIO ativo, de área que
-- exige localização, fora de RDO e sem alocação no dia. Fica aberta até ser resolvida.
BEGIN;

CREATE TABLE IF NOT EXISTS public.alocacao_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('obra','base','disponivel','falta','folga','atestado','ferias')),
  ogs_number text NULL,
  entrada text NULL CHECK (entrada IS NULL OR entrada ~ '^\d{2}:\d{2}'),
  saida text NULL CHECK (saida IS NULL OR saida ~ '^\d{2}:\d{2}'),
  observacao text NULL CHECK (observacao IS NULL OR char_length(observacao) <= 500),
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, data),
  CHECK (tipo <> 'obra' OR ogs_number IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_alocacao_diaria_company_data ON public.alocacao_diaria(company_id, data);
CREATE INDEX IF NOT EXISTS idx_alocacao_diaria_employee ON public.alocacao_diaria(employee_id, data);

ALTER TABLE public.alocacao_diaria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alocacao_diaria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.alocacao_diaria TO authenticated;
DROP POLICY IF EXISTS alocacao_diaria_select ON public.alocacao_diaria;
CREATE POLICY alocacao_diaria_select ON public.alocacao_diaria FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
                 AND p.company_id = alocacao_diaria.company_id AND p.status = 'ativo'));

CREATE OR REPLACE FUNCTION public.wf_auto_rdo_area_excluida(p_equipe text, p_cc text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT public.wf_auto_rdo_norm(coalesce(p_equipe,'') || ' | ' || coalesce(p_cc,'')) ~
   '(ADMINISTRATIV|CONTABIL|DEMITID|DEPARTAMENTO DE TI|(^| )TI( |$)|FACILIT|FINANCEIR|GESTAO DE PESSOAS|JURIDIC|MANUTENCAO|MASSA FRIA|SEGURANCA|SUPRIMENT|COMERCIAL|ESCRITORIO)'
$$;

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
    SELECT ef.employee_id AS id, public.wf_auto_rdo_norm(trim(n)) AS nn
    FROM rdo_efetivo ef JOIN rdo_diarios r ON r.id = ef.rdo_id
    LEFT JOIN LATERAL unnest(string_to_array(ef.nome,'|||')) n ON true
    WHERE r.company_id = p_company_id AND r.data = p_data AND r.status_validacao <> 'rascunho'
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

CREATE OR REPLACE FUNCTION public.programador_alocar_lote(
  p_company_id uuid, p_data date, p_employee_ids uuid[], p_tipo text,
  p_ogs_number text DEFAULT NULL, p_entrada text DEFAULT NULL, p_saida text DEFAULT NULL, p_obs text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_n int;
BEGIN
  IF v_user IS NULL OR NOT public.programador_observacoes_autorizado(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso ao WF Programador nesta empresa';
  END IF;
  IF p_data IS NULL OR p_employee_ids IS NULL OR coalesce(array_length(p_employee_ids,1),0) = 0
     OR array_length(p_employee_ids,1) > 500 THEN
    RAISE EXCEPTION 'Seleção inválida (1 a 500 funcionários)';
  END IF;
  IF p_tipo NOT IN ('obra','base','disponivel','falta','folga','atestado','ferias') THEN
    RAISE EXCEPTION 'Tipo de alocação inválido';
  END IF;
  IF p_tipo = 'obra' AND NOT EXISTS (SELECT 1 FROM ogs_reference o
        WHERE o.company_id = p_company_id AND o.ogs_number = p_ogs_number) THEN
    RAISE EXCEPTION 'OGS não cadastrada';
  END IF;
  INSERT INTO alocacao_diaria (company_id, employee_id, data, tipo, ogs_number, entrada, saida, observacao, criado_por)
  SELECT p_company_id, e.id, p_data, p_tipo,
         CASE WHEN p_tipo = 'obra' THEN p_ogs_number END,
         nullif(p_entrada,''), nullif(p_saida,''), nullif(btrim(p_obs),''), v_user
  FROM employees e WHERE e.company_id = p_company_id AND e.id = ANY (p_employee_ids)
  ON CONFLICT (company_id, employee_id, data) DO UPDATE
    SET tipo = EXCLUDED.tipo, ogs_number = EXCLUDED.ogs_number, entrada = EXCLUDED.entrada,
        saida = EXCLUDED.saida, observacao = EXCLUDED.observacao,
        criado_por = EXCLUDED.criado_por, atualizado_em = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.programador_remover_alocacao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM alocacao_diaria WHERE id = p_id;
  IF v_company IS NULL OR auth.uid() IS NULL OR NOT public.programador_observacoes_autorizado(v_company) THEN
    RAISE EXCEPTION 'Sem acesso ou alocação inexistente';
  END IF;
  DELETE FROM alocacao_diaria WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.programador_pendencias(uuid,date), public.programador_alocar_lote(uuid,date,uuid[],text,text,text,text,text),
  public.programador_remover_alocacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_pendencias(uuid,date), public.programador_alocar_lote(uuid,date,uuid[],text,text,text,text,text),
  public.programador_remover_alocacao(uuid) TO authenticated;
COMMIT;

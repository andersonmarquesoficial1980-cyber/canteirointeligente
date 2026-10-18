-- Um comunicado reúne destinos de várias equipes; as linhas continuam em ci_programacoes
-- para os consumidores existentes (Manutenção, diário e relatório legado).
BEGIN;
CREATE TABLE public.programacao_comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  data date NOT NULL,
  itens jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX programacao_comunicados_company_data_idx ON public.programacao_comunicados(company_id, data DESC, created_at DESC);
ALTER TABLE public.ci_programacoes ADD COLUMN comunicado_id uuid REFERENCES public.programacao_comunicados(id);
ALTER TABLE public.ci_programacoes ADD COLUMN company_id uuid REFERENCES public.companies(id);
CREATE INDEX ci_programacoes_company_comunicado_idx ON public.ci_programacoes(company_id, comunicado_id);
-- A política legada expõe programações a todo usuário autenticado.
-- Não reclassifique dados antigos sem empresa; isole os registros novos por empresa.
DROP POLICY IF EXISTS auth_programacoes ON public.ci_programacoes;
CREATE POLICY auth_programacoes ON public.ci_programacoes FOR ALL TO authenticated
USING (company_id IS NULL OR company_id = (SELECT public.auth_profile_company_id()))
WITH CHECK (company_id IS NULL OR company_id = (SELECT public.auth_profile_company_id()));
ALTER TABLE public.programacao_comunicados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programacao_comunicados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programacao_comunicados TO authenticated;
CREATE POLICY programacao_comunicados_read ON public.programacao_comunicados FOR SELECT TO authenticated
USING (public.programador_observacoes_autorizado(company_id));

CREATE FUNCTION public.programador_criar_comunicado(p_company_id uuid, p_data date, p_itens jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_id uuid;
  v_item jsonb;
  v_equipe text;
  v_situacao text;
  v_local text;
  v_frota text;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.programador_observacoes_autorizado(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso ao WF Programador nesta empresa';
  END IF;
  IF p_data IS NULL OR p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Informe data e de 1 a 100 equipes';
  END IF;
  -- Valide todo o lote antes da primeira escrita (qualquer falha também reverte a transação).
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Equipe inválida'; END IF;
    v_equipe := btrim(v_item->>'equipe');
    v_situacao := v_item->>'situacao';
    v_local := btrim(coalesce(v_item->>'local', ''));
    IF v_equipe IS NULL OR length(v_equipe) > 150 OR upper(v_equipe) = ANY(v_seen)
       OR v_situacao NOT IN ('TRABALHO', 'FOLGA') OR v_situacao IS NULL
       OR (v_situacao = 'TRABALHO' AND v_local = '')
       OR length(v_local) > 500 OR length(coalesce(v_item->>'observacao', '')) > 1000 THEN
      RAISE EXCEPTION 'Equipe duplicada ou destino/situação inválido';
    END IF;
    -- Catálogo da empresa: cadastro mestre próprio, nunca equipe global de outro cliente.
    IF NOT EXISTS (SELECT 1 FROM public.employees e
                   WHERE e.company_id = p_company_id AND e.origem = 'PROPRIO'
                     AND e.equipe = v_equipe AND lower(coalesce(e.status,'')) <> 'demitido') THEN
      RAISE EXCEPTION 'Equipe não pertence à empresa: %', v_equipe;
    END IF;
    IF nullif(btrim(v_item->>'ogs'), '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ogs_reference o WHERE o.company_id = p_company_id
        AND o.ogs_number = btrim(v_item->>'ogs')
    ) THEN RAISE EXCEPTION 'OGS não pertence à empresa'; END IF;
    IF jsonb_typeof(coalesce(v_item->'equipamentos', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'Equipamentos inválidos';
    END IF;
    FOR v_frota IN SELECT value FROM jsonb_array_elements_text(coalesce(v_item->'equipamentos', '[]'::jsonb)) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.equipamentos eq WHERE eq.company_id = p_company_id
                     AND eq.frota = v_frota AND lower(coalesce(eq.status,'')) <> 'devolvido') THEN
        RAISE EXCEPTION 'Frota não pertence à empresa: %', v_frota;
      END IF;
    END LOOP;
    v_seen := array_append(v_seen, upper(v_equipe));
  END LOOP;
  INSERT INTO public.programacao_comunicados(company_id, data, itens, created_by)
  VALUES (p_company_id, p_data, p_itens, auth.uid()) RETURNING id INTO v_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_equipe := btrim(v_item->>'equipe');
    v_situacao := v_item->>'situacao';
    INSERT INTO public.ci_programacoes
      (comunicado_id, company_id, data, equipe, responsavel, ogs, cliente, local,
       periodo, status_equipe, status_programacao, equipamentos_designados,
       carretas_designadas, obs, confirmado_manutencao, tipo_servico, created_by)
    VALUES
      (v_id, p_company_id, p_data, v_equipe, NULL,
       CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'ogs'), '') ELSE NULL END,
       CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'cliente'), '') ELSE NULL END,
       CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'local'), '') ELSE NULL END,
       CASE WHEN v_situacao = 'TRABALHO' THEN coalesce(nullif(btrim(v_item->>'periodo'), ''), 'DIURNO') ELSE 'FOLGA' END,
       CASE WHEN v_situacao = 'TRABALHO' THEN 'TRABALHOU' ELSE 'FOLGA' END,
       CASE WHEN v_situacao = 'TRABALHO' THEN 'AGUARDANDO_MANUTENCAO' ELSE 'CONFIRMADO' END,
       CASE WHEN v_situacao = 'TRABALHO' THEN
         ARRAY(SELECT jsonb_array_elements_text(coalesce(v_item->'equipamentos', '[]'::jsonb)))
       ELSE '{}'::text[] END,
       '{}', nullif(btrim(v_item->>'observacao'), ''), false, NULL, auth.uid());
  END LOOP;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.programador_criar_comunicado(uuid,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_criar_comunicado(uuid,date,jsonb) TO authenticated;
COMMIT;

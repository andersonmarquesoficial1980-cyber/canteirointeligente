-- Revisões de comunicados sem apagar programação nem histórico de execução.
-- Data e conjunto de equipes são fixos na edição; cada linha é atualizada pelo ID lógico
-- (comunicado_id + equipe). Alterações concorrentes falham por número de revisão.
BEGIN;
ALTER TABLE public.programacao_comunicados
  ADD COLUMN revisao integer NOT NULL DEFAULT 1;
ALTER TABLE public.ci_programacoes
  ADD COLUMN motivo_cancelamento text;
ALTER TABLE public.ci_programacoes
  ADD CONSTRAINT ci_programacoes_cancelamento_motivo_check
  CHECK (status_equipe IS DISTINCT FROM 'CANCELADO'
         OR nullif(btrim(motivo_cancelamento), '') IS NOT NULL);

CREATE TABLE public.programacao_comunicado_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  comunicado_id uuid NOT NULL REFERENCES public.programacao_comunicados(id),
  revisao_anterior integer NOT NULL,
  revisao_nova integer NOT NULL,
  itens_antes jsonb NOT NULL,
  itens_depois jsonb NOT NULL,
  alterado_por uuid NOT NULL,
  alterado_por_nome text,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicado_id, revisao_nova)
);
CREATE INDEX programacao_comunicado_revisoes_company_comunicado_idx
  ON public.programacao_comunicado_revisoes(company_id, comunicado_id, revisao_nova DESC);
ALTER TABLE public.programacao_comunicado_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programacao_comunicado_revisoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programacao_comunicado_revisoes TO authenticated;
CREATE POLICY programacao_comunicado_revisoes_read ON public.programacao_comunicado_revisoes
  FOR SELECT TO authenticated USING (public.programador_observacoes_autorizado(company_id));

-- Reaproveita a normalização existente também nas correções. Sem isso, o
-- navegador poderia gravar um nome diferente do funcionário escolhido.
DROP TRIGGER programador_normalizar_responsaveis_before_insert ON public.programacao_comunicados;
CREATE TRIGGER programador_normalizar_responsaveis_before_write
BEFORE INSERT OR UPDATE OF itens ON public.programacao_comunicados
FOR EACH ROW EXECUTE FUNCTION public.programador_normalizar_responsaveis();

CREATE FUNCTION public.programador_editar_comunicado(
  p_company_id uuid, p_comunicado_id uuid, p_revisao integer, p_itens jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_old public.programacao_comunicados%ROWTYPE;
  v_item jsonb;
  v_payload jsonb := '[]'::jsonb;
  v_final jsonb;
  v_equipe text;
  v_situacao text;
  v_motivo text;
  v_local text;
  v_ogs text;
  v_seen text[] := ARRAY[]::text[];
  v_count integer;
  v_actor text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.programador_observacoes_autorizado(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso para editar a programação nesta empresa';
  END IF;
  SELECT * INTO v_old FROM public.programacao_comunicados
    WHERE id = p_comunicado_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comunicado não encontrado nesta empresa'; END IF;
  IF v_old.revisao <> p_revisao THEN
    RAISE EXCEPTION 'Este comunicado foi alterado por outra pessoa. Atualize o histórico antes de editar.';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) <> jsonb_array_length(v_old.itens)
     OR length(p_itens::text) > 300000 THEN
    RAISE EXCEPTION 'Mantenha as mesmas equipes e corrija apenas seus dados';
  END IF;
  SELECT count(*) INTO v_count FROM public.ci_programacoes
    WHERE company_id = p_company_id AND comunicado_id = p_comunicado_id;
  IF v_count <> jsonb_array_length(v_old.itens) THEN
    RAISE EXCEPTION 'Linhas do comunicado estão inconsistentes. Nenhuma edição foi gravada.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Equipe inválida'; END IF;
    v_equipe := btrim(v_item->>'equipe');
    v_situacao := v_item->>'situacao';
    v_local := btrim(coalesce(v_item->>'local', ''));
    v_motivo := btrim(coalesce(v_item->>'motivo_cancelamento', ''));
    v_ogs := nullif(btrim(v_item->>'ogs'), '');
    IF v_equipe IS NULL OR v_equipe = '' OR length(v_equipe) > 150
       OR upper(v_equipe) = ANY(v_seen)
       OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_old.itens) AS original(item)
                      WHERE original.item->>'equipe' = v_equipe)
       OR v_situacao IS NULL OR v_situacao NOT IN ('TRABALHO','FOLGA','CANCELADO')
       OR (v_situacao = 'TRABALHO' AND v_local = '')
       OR (v_situacao = 'CANCELADO' AND v_motivo = '')
       OR length(v_local) > 500 OR length(v_motivo) > 500
       OR length(coalesce(v_item->>'observacao', '')) > 1000 THEN
      RAISE EXCEPTION 'Equipe, destino, situação ou motivo de cancelamento inválido';
    END IF;
    IF v_situacao = 'TRABALHO' AND v_ogs IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ogs_reference o
        WHERE o.company_id = p_company_id AND o.ogs_number = v_ogs
    ) THEN RAISE EXCEPTION 'OGS não pertence à empresa'; END IF;
    IF v_situacao = 'CANCELADO' THEN
      v_item := jsonb_set(v_item - 'encarregado_id' - 'engenheiro_id',
                          '{motivo_cancelamento}', to_jsonb(v_motivo));
    ELSE
      v_item := v_item - 'motivo_cancelamento';
    END IF;
    v_payload := v_payload || jsonb_build_array(v_item);
    v_seen := array_append(v_seen, upper(v_equipe));
  END LOOP;

  -- O trigger já existente consulta o cadastro mestre para validar IDs e normalizar nomes.
  UPDATE public.programacao_comunicados SET itens = v_payload, revisao = revisao + 1
    WHERE id = p_comunicado_id AND company_id = p_company_id
    RETURNING itens INTO v_final;
  IF v_final = v_old.itens THEN RAISE EXCEPTION 'Nenhuma alteração para salvar'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_final) LOOP
    v_situacao := v_item->>'situacao';
    UPDATE public.ci_programacoes SET
      status_equipe = CASE WHEN v_situacao = 'TRABALHO' THEN 'TRABALHOU' ELSE v_situacao END,
      status_programacao = CASE WHEN v_situacao = 'CANCELADO' THEN 'CANCELADO'
                                WHEN v_situacao = 'FOLGA' THEN 'CONFIRMADO'
                                WHEN status_programacao = 'CANCELADO' OR status_equipe = 'FOLGA'
                                  THEN 'AGUARDANDO_MANUTENCAO'
                                ELSE status_programacao END,
      motivo_cancelamento = CASE WHEN v_situacao = 'CANCELADO' THEN v_item->>'motivo_cancelamento' ELSE NULL END,
      ogs = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'ogs'), '') ELSE NULL END,
      cliente = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'cliente'), '') ELSE NULL END,
      local = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(btrim(v_item->>'local'), '') ELSE NULL END,
      periodo = CASE WHEN v_situacao = 'TRABALHO' THEN coalesce(nullif(btrim(v_item->>'periodo'), ''), 'DIURNO') ELSE v_situacao END,
      responsavel_employee_id = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(v_item->>'encarregado_id', '')::uuid ELSE NULL END,
      responsavel = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(v_item->>'encarregado_nome', '') ELSE NULL END,
      engenheiro_responsavel_employee_id = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(v_item->>'engenheiro_id', '')::uuid ELSE NULL END,
      engenheiro_responsavel = CASE WHEN v_situacao = 'TRABALHO' THEN nullif(v_item->>'engenheiro_nome', '') ELSE NULL END,
      obs = nullif(btrim(v_item->>'observacao'), ''),
      confirmado_manutencao = CASE WHEN v_situacao <> 'TRABALHO' OR status_equipe IN ('FOLGA','CANCELADO') THEN false ELSE confirmado_manutencao END,
      confirmado_por = CASE WHEN v_situacao <> 'TRABALHO' OR status_equipe IN ('FOLGA','CANCELADO') THEN NULL ELSE confirmado_por END,
      confirmado_em = CASE WHEN v_situacao <> 'TRABALHO' OR status_equipe IN ('FOLGA','CANCELADO') THEN NULL ELSE confirmado_em END
    WHERE company_id = p_company_id AND comunicado_id = p_comunicado_id
      AND equipe = v_item->>'equipe';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Falha ao atualizar a equipe. Nenhuma edição foi gravada.'; END IF;
  END LOOP;

  SELECT nome_completo INTO v_actor FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.programacao_comunicado_revisoes
    (company_id, comunicado_id, revisao_anterior, revisao_nova, itens_antes,
     itens_depois, alterado_por, alterado_por_nome)
  VALUES (p_company_id, p_comunicado_id, v_old.revisao, v_old.revisao + 1,
          v_old.itens, v_final, auth.uid(), v_actor);
  RETURN v_old.revisao + 1;
END;
$fn$;
REVOKE ALL ON FUNCTION public.programador_editar_comunicado(uuid,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.programador_editar_comunicado(uuid,uuid,integer,jsonb) TO authenticated;
COMMIT;

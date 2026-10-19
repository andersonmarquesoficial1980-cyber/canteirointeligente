-- Responsáveis da programação: validar IDs na empresa e registrar nomes históricos
-- sem duplicar cadastros ou alterar o RPC público já utilizado pelo Programador.
BEGIN;
CREATE FUNCTION public.programador_normalizar_responsaveis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_item jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_nome text;
BEGIN
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.itens) LOOP
    -- Nunca confiar em nomes enviados pelo navegador: sempre consultar cadastro mestre.
    v_item := v_item - 'encarregado_nome' - 'engenheiro_nome';
    IF v_item->>'situacao' = 'FOLGA' THEN
      v_item := v_item - 'encarregado_id' - 'engenheiro_id';
    ELSE
      IF nullif(v_item->>'encarregado_id', '') IS NOT NULL THEN
        SELECT e.name INTO v_nome FROM public.employees e
          WHERE e.id = (v_item->>'encarregado_id')::uuid
            AND e.company_id = NEW.company_id AND e.origem = 'PROPRIO'
            AND e.status = 'ativo' AND e.is_encarregado IS TRUE;
        IF v_nome IS NULL THEN RAISE EXCEPTION 'Encarregado não pertence à empresa ou não está ativo'; END IF;
        v_item := jsonb_set(v_item, '{encarregado_nome}', to_jsonb(v_nome));
      END IF;
      IF nullif(v_item->>'engenheiro_id', '') IS NOT NULL THEN
        SELECT e.name INTO v_nome FROM public.employees e
          WHERE e.id = (v_item->>'engenheiro_id')::uuid
            AND e.company_id = NEW.company_id AND e.origem = 'PROPRIO'
            AND e.status = 'ativo' AND e.is_engenheiro IS TRUE;
        IF v_nome IS NULL THEN RAISE EXCEPTION 'Engenheiro não pertence à empresa ou não está ativo'; END IF;
        v_item := jsonb_set(v_item, '{engenheiro_nome}', to_jsonb(v_nome));
      END IF;
    END IF;
    v_itens := v_itens || jsonb_build_array(v_item);
  END LOOP;
  NEW.itens := v_itens;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER programador_normalizar_responsaveis_before_insert
BEFORE INSERT ON public.programacao_comunicados
FOR EACH ROW EXECUTE FUNCTION public.programador_normalizar_responsaveis();

CREATE FUNCTION public.programador_vincular_responsaveis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_item jsonb;
BEGIN
  SELECT j.item INTO v_item
    FROM public.programacao_comunicados c,
         LATERAL jsonb_array_elements(c.itens) AS j(item)
    WHERE c.id = NEW.comunicado_id AND c.company_id = NEW.company_id
      AND j.item->>'equipe' = NEW.equipe;
  IF v_item IS NULL THEN RAISE EXCEPTION 'Equipe não encontrada no comunicado'; END IF;
  NEW.responsavel_employee_id := nullif(v_item->>'encarregado_id', '')::uuid;
  NEW.responsavel := nullif(v_item->>'encarregado_nome', '');
  NEW.engenheiro_responsavel_employee_id := nullif(v_item->>'engenheiro_id', '')::uuid;
  NEW.engenheiro_responsavel := nullif(v_item->>'engenheiro_nome', '');
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER programador_vincular_responsaveis_before_insert
BEFORE INSERT ON public.ci_programacoes
FOR EACH ROW WHEN (NEW.comunicado_id IS NOT NULL)
EXECUTE FUNCTION public.programador_vincular_responsaveis();
COMMIT;

-- Notas operacionais do Programador, separadas das observações de RH.
-- Uma nota atual por registro/empresa e trilha imutável de alterações.
BEGIN;
CREATE TABLE IF NOT EXISTS public.programador_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  subject_type text NOT NULL CHECK (subject_type IN ('pessoa', 'equipamento')),
  subject_id uuid NOT NULL,
  texto text NULL CHECK (texto IS NULL OR char_length(texto) BETWEEN 1 AND 1000),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, subject_type, subject_id)
);
CREATE TABLE IF NOT EXISTS public.programador_observacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observacao_id uuid NOT NULL REFERENCES public.programador_observacoes(id),
  company_id uuid NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  texto_anterior text NULL,
  texto_novo text NULL,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programador_observacoes_company ON public.programador_observacoes(company_id);
CREATE INDEX IF NOT EXISTS idx_programador_observacoes_historico_target ON public.programador_observacoes_historico(company_id, subject_type, subject_id, changed_at);
ALTER TABLE public.programador_observacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programador_observacoes_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programador_observacoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.programador_observacoes_historico FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programador_observacoes TO authenticated;
CREATE OR REPLACE FUNCTION public.programador_observacoes_autorizado(p_company_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
      AND p.company_id = p_company_id AND p.status = 'ativo')
    AND EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (SELECT auth.uid())
      AND up.company_id = p_company_id AND (up.modulo_programador IS TRUE OR up.is_admin IS TRUE))
$fn$;
REVOKE ALL ON FUNCTION public.programador_observacoes_autorizado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_observacoes_autorizado(uuid) TO authenticated;
DROP POLICY IF EXISTS programador_observacoes_select ON public.programador_observacoes;
CREATE POLICY programador_observacoes_select ON public.programador_observacoes
  FOR SELECT TO authenticated USING (public.programador_observacoes_autorizado(company_id));
CREATE OR REPLACE FUNCTION public.programador_auditar_observacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.programador_observacoes_historico
      (observacao_id, company_id, subject_type, subject_id, texto_anterior, texto_novo, changed_by)
    VALUES (NEW.id, NEW.company_id, NEW.subject_type, NEW.subject_id, NULL, NEW.texto, NEW.updated_by);
  ELSIF OLD.texto IS DISTINCT FROM NEW.texto THEN
    INSERT INTO public.programador_observacoes_historico
      (observacao_id, company_id, subject_type, subject_id, texto_anterior, texto_novo, changed_by)
    VALUES (NEW.id, NEW.company_id, NEW.subject_type, NEW.subject_id, OLD.texto, NEW.texto, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS programador_observacoes_audit ON public.programador_observacoes;
CREATE TRIGGER programador_observacoes_audit AFTER INSERT OR UPDATE ON public.programador_observacoes
  FOR EACH ROW EXECUTE FUNCTION public.programador_auditar_observacao();
CREATE OR REPLACE FUNCTION public.programador_salvar_observacao(
  p_company_id uuid, p_subject_type text, p_subject_id uuid, p_texto text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_texto text := nullif(btrim(p_texto), '');
  v_id uuid;
BEGIN
  IF v_user IS NULL OR p_company_id IS NULL OR p_subject_id IS NULL
     OR p_subject_type NOT IN ('pessoa', 'equipamento') OR p_subject_type IS NULL
     OR p_texto IS NULL OR char_length(v_texto) > 1000 THEN
    RAISE EXCEPTION 'Observação inválida (máximo 1000 caracteres)';
  END IF;
  IF NOT public.programador_observacoes_autorizado(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso ao WF Programador nesta empresa';
  END IF;
  IF p_subject_type = 'pessoa' AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = p_subject_id
      AND e.company_id = p_company_id AND e.origem = 'PROPRIO'
  ) THEN RAISE EXCEPTION 'Funcionário não encontrado nesta empresa'; END IF;
  IF p_subject_type = 'equipamento' AND NOT EXISTS (
    SELECT 1 FROM public.equipamentos e WHERE e.id = p_subject_id AND e.company_id = p_company_id
  ) THEN RAISE EXCEPTION 'Equipamento não encontrado nesta empresa'; END IF;
  INSERT INTO public.programador_observacoes(company_id, subject_type, subject_id, texto, updated_by)
  VALUES (p_company_id, p_subject_type, p_subject_id, v_texto, v_user)
  ON CONFLICT (company_id, subject_type, subject_id) DO UPDATE
  SET texto = EXCLUDED.texto, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'texto', v_texto);
END;
$fn$;
REVOKE ALL ON FUNCTION public.programador_salvar_observacao(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programador_salvar_observacao(uuid,text,uuid,text) TO authenticated;
COMMIT;

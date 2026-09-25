-- Vincula RDO ao usuário engenheiro (não só por nome exibido), com fallback seguro.

ALTER TABLE public.rdo_diarios
ADD COLUMN IF NOT EXISTS engenheiro_responsavel_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_rdo_diarios_engenheiro_responsavel_user_id
  ON public.rdo_diarios (engenheiro_responsavel_user_id);

CREATE OR REPLACE FUNCTION public.wf_normalize_name(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        upper(
          translate(
            coalesce(p_text, ''),
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )
        ),
        '[^A-Z0-9 ]', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wf_name_tokens(p_text text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(array_agg(tok), '{}'::text[])
  FROM (
    SELECT t AS tok
    FROM unnest(string_to_array(public.wf_normalize_name(p_text), ' ')) AS t
    WHERE length(t) >= 2
      AND t NOT IN ('DA', 'DE', 'DI', 'DO', 'DOS', 'DAS', 'E')
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.wf_resolve_engenheiro_user_id(p_company_id uuid, p_engenheiro_nome text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tokens text[];
  v_user_id uuid;
BEGIN
  IF p_company_id IS NULL OR btrim(coalesce(p_engenheiro_nome, '')) = '' THEN
    RETURN NULL;
  END IF;

  v_tokens := public.wf_name_tokens(p_engenheiro_nome);

  IF coalesce(array_length(v_tokens, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;

  WITH candidates AS (
    SELECT
      p.user_id,
      public.wf_name_tokens(p.nome_completo) AS profile_tokens
    FROM public.profiles p
    WHERE p.company_id = p_company_id
      AND p.user_id IS NOT NULL
  ),
  scored AS (
    SELECT
      c.user_id,
      cardinality(c.profile_tokens) AS profile_token_count,
      (
        SELECT count(*)
        FROM unnest(c.profile_tokens) t
        WHERE t = ANY(v_tokens)
      ) AS overlap_count
    FROM candidates c
    WHERE cardinality(c.profile_tokens) > 0
  )
  SELECT s.user_id
  INTO v_user_id
  FROM scored s
  WHERE s.overlap_count = s.profile_token_count
  ORDER BY s.profile_token_count DESC, s.user_id
  LIMIT 1;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_rdo_engenheiro_responsavel_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF btrim(coalesce(NEW.engenheiro_responsavel, '')) = '' THEN
    NEW.engenheiro_responsavel_user_id := NULL;
    RETURN NEW;
  END IF;

  NEW.engenheiro_responsavel_user_id := public.wf_resolve_engenheiro_user_id(
    NEW.company_id,
    NEW.engenheiro_responsavel
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rdo_engenheiro_responsavel_user_id ON public.rdo_diarios;

CREATE TRIGGER trg_set_rdo_engenheiro_responsavel_user_id
BEFORE INSERT OR UPDATE OF company_id, engenheiro_responsavel
ON public.rdo_diarios
FOR EACH ROW
EXECUTE FUNCTION public.set_rdo_engenheiro_responsavel_user_id();

-- Backfill não destrutivo dos registros existentes.
UPDATE public.rdo_diarios d
SET engenheiro_responsavel_user_id = public.wf_resolve_engenheiro_user_id(d.company_id, d.engenheiro_responsavel)
WHERE d.engenheiro_responsavel_user_id IS NULL
  AND d.company_id IS NOT NULL
  AND btrim(coalesce(d.engenheiro_responsavel, '')) <> '';

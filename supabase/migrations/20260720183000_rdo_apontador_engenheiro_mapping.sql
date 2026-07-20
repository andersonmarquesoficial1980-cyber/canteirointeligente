-- Mapeamento de apontador -> engenheiro responsável (por empresa)
-- Objetivo: preencher automaticamente engenheiro_responsavel no RDO sem afetar validação de encarregados.

CREATE TABLE IF NOT EXISTS public.rdo_apontador_engenheiro_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  apontador_nome text NOT NULL,
  engenheiro_nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdo_apontador_engenheiro_map_company_apontador_key UNIQUE (company_id, apontador_nome)
);

CREATE INDEX IF NOT EXISTS idx_rdo_map_company_ativo
  ON public.rdo_apontador_engenheiro_map(company_id, ativo);

CREATE OR REPLACE FUNCTION public.set_rdo_engenheiro_responsavel_from_map()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_eng text;
BEGIN
  -- Mantém valor informado manualmente
  IF NEW.engenheiro_responsavel IS NOT NULL AND btrim(NEW.engenheiro_responsavel) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT m.engenheiro_nome
    INTO v_eng
  FROM public.rdo_apontador_engenheiro_map m
  WHERE m.company_id = NEW.company_id
    AND m.ativo = true
    AND upper(btrim(m.apontador_nome)) = upper(btrim(coalesce(NEW.preenchido_por, '')))
  LIMIT 1;

  IF v_eng IS NOT NULL AND btrim(v_eng) <> '' THEN
    NEW.engenheiro_responsavel := v_eng;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rdo_engenheiro_responsavel_from_map ON public.rdo_diarios;
CREATE TRIGGER trg_set_rdo_engenheiro_responsavel_from_map
BEFORE INSERT OR UPDATE OF preenchido_por, company_id, engenheiro_responsavel
ON public.rdo_diarios
FOR EACH ROW
EXECUTE FUNCTION public.set_rdo_engenheiro_responsavel_from_map();
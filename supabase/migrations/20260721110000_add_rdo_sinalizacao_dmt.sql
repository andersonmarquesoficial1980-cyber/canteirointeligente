-- Campos adicionais do RDO Pavimentação (CAUQ)
-- Sinalização Horizontal + Informações de DMT

CREATE TABLE IF NOT EXISTS public.rdo_sinalizacao_horizontal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_diarios(id) ON DELETE CASCADE,
  company_id uuid,
  tipo text,
  sentido text,
  faixa text,
  estaca_inicial text,
  estaca_final text,
  quantidade numeric,
  comprimento_m numeric,
  largura_m numeric,
  quantidade_taxas numeric
);

CREATE TABLE IF NOT EXISTS public.rdo_informacoes_dmt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_diarios(id) ON DELETE CASCADE,
  company_id uuid,
  dmt_usina_km numeric,
  dmt_canteiro_km numeric
);

CREATE INDEX IF NOT EXISTS idx_rdo_sinalizacao_horizontal_rdo_id ON public.rdo_sinalizacao_horizontal (rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_sinalizacao_horizontal_company_id ON public.rdo_sinalizacao_horizontal (company_id);
CREATE INDEX IF NOT EXISTS idx_rdo_informacoes_dmt_rdo_id ON public.rdo_informacoes_dmt (rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_informacoes_dmt_company_id ON public.rdo_informacoes_dmt (company_id);

ALTER TABLE public.rdo_sinalizacao_horizontal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_informacoes_dmt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdo_sinalizacao_horizontal_select ON public.rdo_sinalizacao_horizontal;
DROP POLICY IF EXISTS rdo_sinalizacao_horizontal_insert ON public.rdo_sinalizacao_horizontal;
DROP POLICY IF EXISTS rdo_sinalizacao_horizontal_update ON public.rdo_sinalizacao_horizontal;
DROP POLICY IF EXISTS rdo_sinalizacao_horizontal_delete ON public.rdo_sinalizacao_horizontal;

CREATE POLICY rdo_sinalizacao_horizontal_select ON public.rdo_sinalizacao_horizontal
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_sinalizacao_horizontal.rdo_id
  )
);

CREATE POLICY rdo_sinalizacao_horizontal_insert ON public.rdo_sinalizacao_horizontal
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_sinalizacao_horizontal.rdo_id
  )
);

CREATE POLICY rdo_sinalizacao_horizontal_update ON public.rdo_sinalizacao_horizontal
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_sinalizacao_horizontal.rdo_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_sinalizacao_horizontal.rdo_id
  )
);

CREATE POLICY rdo_sinalizacao_horizontal_delete ON public.rdo_sinalizacao_horizontal
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_sinalizacao_horizontal.rdo_id
  )
);

DROP POLICY IF EXISTS rdo_informacoes_dmt_select ON public.rdo_informacoes_dmt;
DROP POLICY IF EXISTS rdo_informacoes_dmt_insert ON public.rdo_informacoes_dmt;
DROP POLICY IF EXISTS rdo_informacoes_dmt_update ON public.rdo_informacoes_dmt;
DROP POLICY IF EXISTS rdo_informacoes_dmt_delete ON public.rdo_informacoes_dmt;

CREATE POLICY rdo_informacoes_dmt_select ON public.rdo_informacoes_dmt
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_informacoes_dmt.rdo_id
  )
);

CREATE POLICY rdo_informacoes_dmt_insert ON public.rdo_informacoes_dmt
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_informacoes_dmt.rdo_id
  )
);

CREATE POLICY rdo_informacoes_dmt_update ON public.rdo_informacoes_dmt
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_informacoes_dmt.rdo_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_informacoes_dmt.rdo_id
  )
);

CREATE POLICY rdo_informacoes_dmt_delete ON public.rdo_informacoes_dmt
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_informacoes_dmt.rdo_id
  )
);

CREATE OR REPLACE FUNCTION public.sync_rdo_sinalizacao_horizontal_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.rdo_id IS NOT NULL THEN
    SELECT rd.company_id INTO NEW.company_id
    FROM public.rdo_diarios rd
    WHERE rd.id = NEW.rdo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_rdo_informacoes_dmt_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.rdo_id IS NOT NULL THEN
    SELECT rd.company_id INTO NEW.company_id
    FROM public.rdo_diarios rd
    WHERE rd.id = NEW.rdo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rdo_sinalizacao_horizontal_company_id ON public.rdo_sinalizacao_horizontal;
CREATE TRIGGER trg_sync_rdo_sinalizacao_horizontal_company_id
BEFORE INSERT OR UPDATE ON public.rdo_sinalizacao_horizontal
FOR EACH ROW
EXECUTE FUNCTION public.sync_rdo_sinalizacao_horizontal_company_id();

DROP TRIGGER IF EXISTS trg_sync_rdo_informacoes_dmt_company_id ON public.rdo_informacoes_dmt;
CREATE TRIGGER trg_sync_rdo_informacoes_dmt_company_id
BEFORE INSERT OR UPDATE ON public.rdo_informacoes_dmt
FOR EACH ROW
EXECUTE FUNCTION public.sync_rdo_informacoes_dmt_company_id();

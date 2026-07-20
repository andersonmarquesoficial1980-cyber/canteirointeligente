-- Confiabilidade RDO Produção: evitar sumiço por company_id nulo

-- 1) Backfill dos registros antigos
UPDATE public.rdo_producao rp
SET company_id = rd.company_id
FROM public.rdo_diarios rd
WHERE rd.id = rp.rdo_id
  AND rp.company_id IS NULL
  AND rd.company_id IS NOT NULL;

-- 2) Trigger para sincronizar company_id com RDO pai
CREATE OR REPLACE FUNCTION public.sync_rdo_producao_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rdo_id IS NOT NULL THEN
    SELECT rd.company_id
      INTO NEW.company_id
    FROM public.rdo_diarios rd
    WHERE rd.id = NEW.rdo_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rdo_producao_company_id ON public.rdo_producao;

CREATE TRIGGER trg_sync_rdo_producao_company_id
BEFORE INSERT OR UPDATE OF rdo_id
ON public.rdo_producao
FOR EACH ROW
EXECUTE FUNCTION public.sync_rdo_producao_company_id();
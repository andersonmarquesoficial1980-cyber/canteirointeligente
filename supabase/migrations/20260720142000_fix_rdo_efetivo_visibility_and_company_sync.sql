-- Corrige visibilidade do efetivo no Visualizar RDO e garante company_id consistente

-- 1) Backfill dos registros antigos sem company_id
UPDATE public.rdo_efetivo re
SET company_id = rd.company_id
FROM public.rdo_diarios rd
WHERE rd.id = re.rdo_id
  AND re.company_id IS NULL
  AND rd.company_id IS NOT NULL;

-- 2) Trigger para sempre sincronizar company_id com o RDO pai
CREATE OR REPLACE FUNCTION public.sync_rdo_efetivo_company_id()
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

DROP TRIGGER IF EXISTS trg_sync_rdo_efetivo_company_id ON public.rdo_efetivo;

CREATE TRIGGER trg_sync_rdo_efetivo_company_id
BEFORE INSERT OR UPDATE OF rdo_id
ON public.rdo_efetivo
FOR EACH ROW
EXECUTE FUNCTION public.sync_rdo_efetivo_company_id();

-- 3) Política de SELECT baseada no acesso ao RDO pai
--    (evita sumiço da lista quando company_id vier nulo por algum motivo)
DROP POLICY IF EXISTS rdo_efetivo_select_via_rdo_diarios ON public.rdo_efetivo;

CREATE POLICY rdo_efetivo_select_via_rdo_diarios
ON public.rdo_efetivo
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo_diarios rd
    WHERE rd.id = rdo_efetivo.rdo_id
  )
);

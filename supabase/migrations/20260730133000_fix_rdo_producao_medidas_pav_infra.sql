-- Corrige e previne lançamentos inválidos em rdo_producao para Pavimentação/Infra
-- Regras:
-- 1) comprimento_m nunca negativo (usa ABS)
-- 2) espessura_cm em centímetros: valores (0,1) viram *100 (ex.: 0.17 -> 17)
-- 3) recálculo consistente de area_m2 / volume_m3 / tonelagem

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_rdo_producao_medidas_pav_infra()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tipo_rdo text;
BEGIN
  IF NEW.rdo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT upper(coalesce(rd.tipo_rdo, ''))
    INTO v_tipo_rdo
  FROM public.rdo_diarios rd
  WHERE rd.id = NEW.rdo_id
  LIMIT 1;

  -- Escopo pedido: Pavimentação + Infra
  IF v_tipo_rdo IN ('CAUQ', 'PAVIMENTACAO', 'PAVIMENTAÇÃO', 'INFRA', 'INFRAESTRUTURA') THEN
    -- Comprimento não pode ser negativo
    IF NEW.comprimento_m IS NOT NULL AND NEW.comprimento_m < 0 THEN
      NEW.comprimento_m := abs(NEW.comprimento_m);
    END IF;

    -- Espessura deve ser em cm (sem 0.x)
    IF NEW.espessura_cm IS NOT NULL AND NEW.espessura_cm > 0 AND NEW.espessura_cm < 1 THEN
      NEW.espessura_cm := NEW.espessura_cm * 100;
    END IF;

    -- Recalcula área e volume para manter coerência com os campos normalizados
    IF NEW.comprimento_m IS NOT NULL AND NEW.largura_m IS NOT NULL THEN
      NEW.area_m2 := round((NEW.comprimento_m * NEW.largura_m)::numeric, 3);
    END IF;

    IF NEW.area_m2 IS NOT NULL AND NEW.espessura_cm IS NOT NULL THEN
      NEW.volume_m3 := round((NEW.area_m2 * (NEW.espessura_cm / 100.0))::numeric, 3);
    END IF;

    IF NEW.volume_m3 IS NOT NULL AND NEW.densidade IS NOT NULL THEN
      NEW.tonelagem := round((NEW.volume_m3 * NEW.densidade)::numeric, 3);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_rdo_producao_medidas_pav_infra ON public.rdo_producao;

CREATE TRIGGER trg_normalize_rdo_producao_medidas_pav_infra
BEFORE INSERT OR UPDATE ON public.rdo_producao
FOR EACH ROW
EXECUTE FUNCTION public.normalize_rdo_producao_medidas_pav_infra();

-- Backfill idempotente para registros já existentes no escopo
WITH alvo AS (
  SELECT
    rp.id,
    rp.largura_m,
    rp.densidade,
    CASE
      WHEN rp.comprimento_m < 0 THEN abs(rp.comprimento_m)
      ELSE rp.comprimento_m
    END AS novo_comp,
    CASE
      WHEN rp.espessura_cm > 0 AND rp.espessura_cm < 1 THEN rp.espessura_cm * 100
      ELSE rp.espessura_cm
    END AS nova_esp
  FROM public.rdo_producao rp
  JOIN public.rdo_diarios rd ON rd.id = rp.rdo_id
  WHERE upper(coalesce(rd.tipo_rdo, '')) IN ('CAUQ', 'PAVIMENTACAO', 'PAVIMENTAÇÃO', 'INFRA', 'INFRAESTRUTURA')
    AND (
      rp.comprimento_m < 0
      OR (rp.espessura_cm > 0 AND rp.espessura_cm < 1)
    )
), calc AS (
  SELECT
    id,
    novo_comp,
    nova_esp,
    CASE
      WHEN novo_comp IS NOT NULL AND largura_m IS NOT NULL
      THEN round((novo_comp * largura_m)::numeric, 3)
      ELSE NULL
    END AS nova_area,
    CASE
      WHEN novo_comp IS NOT NULL AND largura_m IS NOT NULL AND nova_esp IS NOT NULL
      THEN round((novo_comp * largura_m * (nova_esp / 100.0))::numeric, 3)
      ELSE NULL
    END AS novo_volume,
    CASE
      WHEN densidade IS NOT NULL AND novo_comp IS NOT NULL AND largura_m IS NOT NULL AND nova_esp IS NOT NULL
      THEN round((novo_comp * largura_m * (nova_esp / 100.0) * densidade)::numeric, 3)
      ELSE NULL
    END AS nova_tonelagem
  FROM alvo
)
UPDATE public.rdo_producao rp
SET
  comprimento_m = calc.novo_comp,
  espessura_cm = calc.nova_esp,
  area_m2 = calc.nova_area,
  volume_m3 = calc.novo_volume,
  tonelagem = COALESCE(calc.nova_tonelagem, rp.tonelagem)
FROM calc
WHERE rp.id = calc.id;

COMMIT;

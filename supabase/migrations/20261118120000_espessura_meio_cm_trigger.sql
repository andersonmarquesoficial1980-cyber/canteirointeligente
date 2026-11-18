-- Permite espessura de 0,5 cm (meio cm). Antes, qualquer valor < 1 era multiplicado por 100 (0,5 -> 50 cm).
-- Agora só valores < 0,5 são tratados como metro (ex.: 0,17 -> 17).
BEGIN;
CREATE OR REPLACE FUNCTION public.normalize_rdo_producao_medidas_pav_infra()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_tipo_rdo text;
BEGIN
  IF NEW.rdo_id IS NULL THEN RETURN NEW; END IF;
  SELECT upper(coalesce(rd.tipo_rdo,'')) INTO v_tipo_rdo FROM public.rdo_diarios rd WHERE rd.id = NEW.rdo_id LIMIT 1;
  IF v_tipo_rdo IN ('CAUQ','PAVIMENTACAO','PAVIMENTAÇÃO','INFRA','INFRAESTRUTURA') THEN
    IF NEW.comprimento_m IS NOT NULL AND NEW.comprimento_m < 0 THEN NEW.comprimento_m := abs(NEW.comprimento_m); END IF;
    IF NEW.espessura_cm IS NOT NULL AND NEW.espessura_cm > 0 AND NEW.espessura_cm < 0.5 THEN
      NEW.espessura_cm := NEW.espessura_cm * 100;
    END IF;
    IF NEW.comprimento_m IS NOT NULL AND NEW.largura_m IS NOT NULL THEN
      NEW.area_m2 := round((NEW.comprimento_m * NEW.largura_m)::numeric, 3); END IF;
    IF NEW.area_m2 IS NOT NULL AND NEW.espessura_cm IS NOT NULL THEN
      NEW.volume_m3 := round((NEW.area_m2 * (NEW.espessura_cm / 100.0))::numeric, 3); END IF;
    IF NEW.volume_m3 IS NOT NULL AND NEW.densidade IS NOT NULL THEN
      NEW.tonelagem := round((NEW.volume_m3 * NEW.densidade)::numeric, 3); END IF;
  END IF;
  RETURN NEW;
END; $$;
COMMIT;

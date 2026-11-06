-- Apontamento de produção por equipamento (fase 3).
--  * Vibroacabadora: toneladas descarregadas, lançadas por equipamento/obra/dia/turno (nova tabela).
--  * Fresadora: metragem reaproveitada do Diário de Equipamento (equipment_production_areas); nada é duplicado.
--  * equip_producao_periodo(): une as duas fontes e marca dias trabalhados sem lançamento.
-- Aditiva: não altera tabelas existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.equip_producao_vibro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  ogs_number text NOT NULL,
  data date NOT NULL,
  turno text NOT NULL CHECK (turno IN ('diurno', 'noturno')),
  toneladas numeric(10, 2) NOT NULL CHECK (toneladas >= 0 AND toneladas <= 5000),
  observacao text CHECK (length(observacao) <= 500),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equip_producao_vibro_uk UNIQUE (company_id, equipamento_id, ogs_number, data, turno)
);
CREATE INDEX IF NOT EXISTS equip_producao_vibro_busca_idx ON public.equip_producao_vibro (company_id, data, ogs_number);

CREATE OR REPLACE FUNCTION public.equip_producao_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Empresa do registro não pode ser alterada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipamentos e
                 WHERE e.id = NEW.equipamento_id AND e.company_id = NEW.company_id
                   AND upper(coalesce(e.categoria_rdo, '')) = 'VIBROACABADORA') THEN
    RAISE EXCEPTION 'Apenas vibroacabadoras da empresa podem receber apontamento de toneladas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ogs_reference o
                 WHERE o.company_id = NEW.company_id AND o.ogs_number = NEW.ogs_number) THEN
    RAISE EXCEPTION 'OGS não pertence à empresa: %', NEW.ogs_number;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS equip_producao_vibro_validar ON public.equip_producao_vibro;
CREATE TRIGGER equip_producao_vibro_validar BEFORE INSERT OR UPDATE ON public.equip_producao_vibro
  FOR EACH ROW EXECUTE FUNCTION public.equip_producao_validar();

ALTER TABLE public.equip_producao_vibro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equip_producao_vibro FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equip_producao_vibro TO authenticated;

DROP POLICY IF EXISTS equip_prod_vibro_select ON public.equip_producao_vibro;
CREATE POLICY equip_prod_vibro_select ON public.equip_producao_vibro FOR SELECT TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_prod_vibro_insert ON public.equip_producao_vibro;
CREATE POLICY equip_prod_vibro_insert ON public.equip_producao_vibro FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()) AND created_by = auth.uid());
DROP POLICY IF EXISTS equip_prod_vibro_update ON public.equip_producao_vibro;
CREATE POLICY equip_prod_vibro_update ON public.equip_producao_vibro FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)))
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_prod_vibro_delete ON public.equip_producao_vibro;
CREATE POLICY equip_prod_vibro_delete ON public.equip_producao_vibro FOR DELETE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)));

-- ---------------------------------------------------------------------------
-- Produção do período (vibroacabadora em t, fresadora em m)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_producao_periodo(
  p_company_id uuid, p_inicio date, p_fim date,
  p_ogs text DEFAULT NULL, p_equipamento_id uuid DEFAULT NULL)
RETURNS TABLE (
  equipamento_id uuid, frota text, ogs_number text, data date, turno text,
  tipo text, valor numeric, unidade text, fonte text, lancado boolean, apontamento_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF p_company_id IS NULL OR p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio
     OR p_fim - p_inicio > 366 THEN
    RAISE EXCEPTION 'Período inválido (máximo 367 dias)';
  END IF;
  IF p_company_id IS DISTINCT FROM (SELECT public.auth_profile_company_id())
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superadmin') THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;

  RETURN QUERY
  WITH dias AS (  -- diários manuais enviados em que o equipamento operou ou ficou em manutenção
    SELECT eq.id AS eq_id, eq.frota AS fr, d.id AS diary_id, d.ogs_number AS ogs, d.date AS dia,
           CASE WHEN d.period = 'noturno' THEN 'noturno' ELSE 'diurno' END AS tn,
           upper(eq.categoria_rdo) AS cat
    FROM public.equipment_diaries d
    JOIN public.equipamentos eq
      ON eq.company_id = p_company_id
     AND (eq.id = d.equipamento_id OR (d.equipamento_id IS NULL AND eq.frota = d.equipment_fleet))
    WHERE d.company_id = p_company_id AND d.date BETWEEN p_inicio AND p_fim
      AND d.status = 'enviado' AND coalesce(d.is_auto, false) = false
      AND d.work_status IN ('Trabalhando', 'Manutenção')
      AND nullif(btrim(d.ogs_number), '') IS NOT NULL
      AND upper(coalesce(eq.categoria_rdo, '')) IN ('VIBROACABADORA', 'FRESAGEM')
      AND (p_ogs IS NULL OR d.ogs_number = p_ogs)
      AND (p_equipamento_id IS NULL OR eq.id = p_equipamento_id)
  ),
  fresa AS (
    SELECT dd.eq_id, max(dd.fr) AS fr, dd.ogs, dd.dia, dd.tn,
           sum(a.length_m) AS metros, count(a.id) AS n_areas
    FROM dias dd
    LEFT JOIN public.equipment_production_areas a ON a.diary_id = dd.diary_id
    WHERE dd.cat = 'FRESAGEM'
    GROUP BY dd.eq_id, dd.ogs, dd.dia, dd.tn
  ),
  vibro_dias AS (
    SELECT DISTINCT dd.eq_id, dd.fr, dd.ogs, dd.dia, dd.tn FROM dias dd WHERE dd.cat = 'VIBROACABADORA'
  ),
  vibro_apont AS (
    SELECT pv.id, pv.equipamento_id AS eq_id, eq.frota AS fr, pv.ogs_number AS ogs, pv.data AS dia, pv.turno AS tn, pv.toneladas
    FROM public.equip_producao_vibro pv
    JOIN public.equipamentos eq ON eq.id = pv.equipamento_id
    WHERE pv.company_id = p_company_id AND pv.data BETWEEN p_inicio AND p_fim
      AND (p_ogs IS NULL OR pv.ogs_number = p_ogs)
      AND (p_equipamento_id IS NULL OR pv.equipamento_id = p_equipamento_id)
  )
  SELECT f.eq_id, f.fr, f.ogs, f.dia, f.tn, 'fresadora'::text,
         CASE WHEN f.n_areas > 0 THEN round(f.metros, 2) END, 'm'::text, 'diario'::text,
         (f.n_areas > 0), NULL::uuid
  FROM fresa f
  UNION ALL
  SELECT coalesce(a.eq_id, v.eq_id), coalesce(a.fr, v.fr), coalesce(a.ogs, v.ogs), coalesce(a.dia, v.dia), coalesce(a.tn, v.tn),
         'vibroacabadora'::text, a.toneladas, 't'::text, 'apontamento'::text, (a.id IS NOT NULL), a.id
  FROM vibro_apont a
  FULL JOIN vibro_dias v ON v.eq_id = a.eq_id AND v.ogs = a.ogs AND v.dia = a.dia AND v.tn = a.tn
  ORDER BY 4 DESC, 2, 3;
END;
$fn$;

REVOKE ALL ON FUNCTION public.equip_producao_periodo(uuid, date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_producao_periodo(uuid, date, date, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equip_producao_validar() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Disponibilidade operacional, MTBF e MTTR de equipamentos (fase 1: banco).
-- Aditiva: não altera nenhuma tabela existente nem dados históricos.
--  * equip_horario_programado: janela programada por OGS+turno (padrão), com exceção por equipamento e/ou dia.
--  * equip_falhas / equip_falha_reparos: início/fim da parada e trechos efetivos de reparo.
--  * equip_indicadores_manutencao(): cálculo único usado pelo dashboard.
-- Tempo programado = diários enviados (manuais) com work_status Trabalhando/Manutenção, OGS preenchida,
-- multiplicados pela janela resolvida. Parada fora da janela não conta; paradas simultâneas são unidas.
BEGIN;

-- ---------------------------------------------------------------------------
-- Permissão de gestão (horário programado e edição de falhas alheias)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_pode_gerir(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND p_company_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.user_id = auth.uid() AND p.role = 'superadmin')
    OR EXISTS (SELECT 1
               FROM public.profiles p
               JOIN public.user_permissions up ON up.user_id = p.user_id
               WHERE p.user_id = auth.uid() AND p.company_id = p_company_id
                 AND (coalesce(up.modulo_manutencao, false)
                      OR coalesce(up.modulo_engenharia, false)
                      OR coalesce(up.modulo_gestao_frotas, false)))
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equip_horario_programado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  ogs_number text NOT NULL,
  turno text NOT NULL CHECK (turno IN ('diurno', 'noturno')),
  equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE CASCADE, -- NULL = padrão da obra
  data date,                                                                -- NULL = padrão; preenchido = exceção do dia
  hora_inicio time,
  hora_fim time,
  sem_operacao boolean NOT NULL DEFAULT false,
  motivo text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equip_horario_janela_chk CHECK (
    (sem_operacao AND hora_inicio IS NULL AND hora_fim IS NULL)
    OR (NOT sem_operacao AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_inicio <> hora_fim)),
  CONSTRAINT equip_horario_sem_operacao_dia_chk CHECK (NOT sem_operacao OR data IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS equip_horario_programado_uk
  ON public.equip_horario_programado (company_id, ogs_number, turno,
    coalesce(equipamento_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(data, DATE '1900-01-01'));

CREATE TABLE IF NOT EXISTS public.equip_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  ogs_number text NOT NULL,
  parada_inicio timestamptz NOT NULL,
  parada_fim timestamptz,                       -- NULL = ainda parado
  causa text NOT NULL CHECK (length(btrim(causa)) BETWEEN 1 AND 200),
  descricao text CHECK (length(descricao) <= 2000),
  os_id uuid REFERENCES public.manutencao_os(id) ON DELETE SET NULL,
  ocorrencia_id uuid REFERENCES public.equipamentos_ocorrencias(id) ON DELETE SET NULL,
  diary_id uuid REFERENCES public.equipment_diaries(id) ON DELETE SET NULL,
  origem text NOT NULL CHECK (origem IN ('mecanico', 'encarregado', 'operador', 'sugestao_diario')),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'pendente_confirmacao', 'cancelada')),
  motivo_cancelamento text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equip_falhas_periodo_chk CHECK (parada_fim IS NULL OR parada_fim > parada_inicio)
);
CREATE INDEX IF NOT EXISTS equip_falhas_company_equip_idx
  ON public.equip_falhas (company_id, equipamento_id, parada_inicio);
CREATE INDEX IF NOT EXISTS equip_falhas_company_ogs_idx
  ON public.equip_falhas (company_id, ogs_number, parada_inicio);

CREATE TABLE IF NOT EXISTS public.equip_falha_reparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  falha_id uuid NOT NULL REFERENCES public.equip_falhas(id) ON DELETE CASCADE,
  reparo_inicio timestamptz NOT NULL,
  reparo_fim timestamptz NOT NULL,
  descricao text CHECK (length(descricao) <= 2000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equip_reparos_periodo_chk CHECK (reparo_fim > reparo_inicio)
);
CREATE INDEX IF NOT EXISTS equip_falha_reparos_falha_idx ON public.equip_falha_reparos (company_id, falha_id);

-- ---------------------------------------------------------------------------
-- Integridade (mesma empresa; reparo dentro da parada)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_validar_vinculos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_f record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Empresa do registro não pode ser alterada';
  END IF;
  IF TG_TABLE_NAME IN ('equip_falhas', 'equip_horario_programado') THEN
    IF NEW.equipamento_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.equipamentos e WHERE e.id = NEW.equipamento_id AND e.company_id = NEW.company_id) THEN
      RAISE EXCEPTION 'Equipamento não pertence à empresa';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ogs_reference o
                   WHERE o.company_id = NEW.company_id AND o.ogs_number = NEW.ogs_number) THEN
      RAISE EXCEPTION 'OGS não pertence à empresa: %', NEW.ogs_number;
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'equip_falha_reparos' THEN
    SELECT f.company_id, f.parada_inicio, f.parada_fim INTO v_f
    FROM public.equip_falhas f WHERE f.id = NEW.falha_id;
    IF NOT FOUND OR v_f.company_id <> NEW.company_id THEN
      RAISE EXCEPTION 'Falha não pertence à empresa';
    END IF;
    IF NEW.reparo_inicio < v_f.parada_inicio
       OR (v_f.parada_fim IS NOT NULL AND NEW.reparo_fim > v_f.parada_fim) THEN
      RAISE EXCEPTION 'Reparo deve estar dentro do período da parada';
    END IF;
  END IF;
  IF TG_TABLE_NAME <> 'equip_falha_reparos' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS equip_falhas_validar ON public.equip_falhas;
CREATE TRIGGER equip_falhas_validar BEFORE INSERT OR UPDATE ON public.equip_falhas
  FOR EACH ROW EXECUTE FUNCTION public.equip_validar_vinculos();
DROP TRIGGER IF EXISTS equip_horario_validar ON public.equip_horario_programado;
CREATE TRIGGER equip_horario_validar BEFORE INSERT OR UPDATE ON public.equip_horario_programado
  FOR EACH ROW EXECUTE FUNCTION public.equip_validar_vinculos();
DROP TRIGGER IF EXISTS equip_reparos_validar ON public.equip_falha_reparos;
CREATE TRIGGER equip_reparos_validar BEFORE INSERT OR UPDATE ON public.equip_falha_reparos
  FOR EACH ROW EXECUTE FUNCTION public.equip_validar_vinculos();

-- ---------------------------------------------------------------------------
-- RLS: leitura por empresa; todos da empresa lançam falhas/reparos;
-- editar/excluir só o autor ou gestão; horário programado só gestão.
-- ---------------------------------------------------------------------------
ALTER TABLE public.equip_horario_programado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equip_falhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equip_falha_reparos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equip_horario_programado, public.equip_falhas, public.equip_falha_reparos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equip_horario_programado, public.equip_falhas,
  public.equip_falha_reparos TO authenticated;

DROP POLICY IF EXISTS equip_horario_select ON public.equip_horario_programado;
CREATE POLICY equip_horario_select ON public.equip_horario_programado FOR SELECT TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_horario_write ON public.equip_horario_programado;
CREATE POLICY equip_horario_write ON public.equip_horario_programado FOR ALL TO authenticated
  USING (public.equip_pode_gerir(company_id))
  WITH CHECK (public.equip_pode_gerir(company_id) AND company_id = (SELECT public.auth_profile_company_id()));

DROP POLICY IF EXISTS equip_falhas_select ON public.equip_falhas;
CREATE POLICY equip_falhas_select ON public.equip_falhas FOR SELECT TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_falhas_insert ON public.equip_falhas;
CREATE POLICY equip_falhas_insert ON public.equip_falhas FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()) AND created_by = auth.uid());
DROP POLICY IF EXISTS equip_falhas_update ON public.equip_falhas;
CREATE POLICY equip_falhas_update ON public.equip_falhas FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)))
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_falhas_delete ON public.equip_falhas;
CREATE POLICY equip_falhas_delete ON public.equip_falhas FOR DELETE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)));

DROP POLICY IF EXISTS equip_reparos_select ON public.equip_falha_reparos;
CREATE POLICY equip_reparos_select ON public.equip_falha_reparos FOR SELECT TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_reparos_insert ON public.equip_falha_reparos;
CREATE POLICY equip_reparos_insert ON public.equip_falha_reparos FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()) AND created_by = auth.uid());
DROP POLICY IF EXISTS equip_reparos_update ON public.equip_falha_reparos;
CREATE POLICY equip_reparos_update ON public.equip_falha_reparos FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)))
  WITH CHECK (company_id = (SELECT public.auth_profile_company_id()));
DROP POLICY IF EXISTS equip_reparos_delete ON public.equip_falha_reparos;
CREATE POLICY equip_reparos_delete ON public.equip_falha_reparos FOR DELETE TO authenticated
  USING (company_id = (SELECT public.auth_profile_company_id())
         AND (created_by = auth.uid() OR public.equip_pode_gerir(company_id)));

-- ---------------------------------------------------------------------------
-- Cálculo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_indicadores_manutencao(
  p_company_id uuid, p_inicio date, p_fim date,
  p_ogs text DEFAULT NULL, p_equipamento_id uuid DEFAULT NULL)
RETURNS TABLE (
  equipamento_id uuid, frota text, ogs_number text,
  dias_programados integer, tempo_programado_h numeric, tempo_parado_h numeric,
  disponibilidade_pct numeric, qtd_falhas integer, tempo_operacao_h numeric, mtbf_h numeric,
  qtd_reparadas integer, tempo_reparo_h numeric, mttr_h numeric,
  falhas_em_aberto integer, falhas_sem_reparo integer,
  dias_sem_horario integer, dias_sem_operacao integer, dias_excluidos_rdo integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
#variable_conflict use_column
DECLARE
  v_tz constant text := 'America/Sao_Paulo';
  v_zero constant tstzmultirange := '{}'::pg_catalog.tstzmultirange;
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
  WITH dias AS (
    SELECT DISTINCT eq.id AS equipamento_id, eq.frota, d.ogs_number AS ogs, d.date AS dia,
           CASE WHEN d.period = 'noturno' THEN 'noturno' ELSE 'diurno' END AS turno
    FROM public.equipment_diaries d
    JOIN public.equipamentos eq
      ON eq.company_id = p_company_id
     AND (eq.id = d.equipamento_id OR (d.equipamento_id IS NULL AND eq.frota = d.equipment_fleet))
    WHERE d.company_id = p_company_id
      AND d.date BETWEEN p_inicio AND p_fim
      AND d.status = 'enviado' AND coalesce(d.is_auto, false) = false
      AND d.work_status IN ('Trabalhando', 'Manutenção')
      AND nullif(btrim(d.ogs_number), '') IS NOT NULL
      AND (p_ogs IS NULL OR d.ogs_number = p_ogs)
      AND (p_equipamento_id IS NULL OR eq.id = p_equipamento_id)
  ),
  -- Dia inteiro sem produção por motivo alheio ao equipamento (RDO Técnico): sai do programado.
  excl AS (
    SELECT DISTINCT coalesce(r.ogs_number, o.ogs_number) AS ogs, r.data AS dia
    FROM public.rdo_engenheiro r
    LEFT JOIN public.ogs_reference o ON o.id::text = r.ogs_id::text AND o.company_id = p_company_id
    WHERE r.company_id = p_company_id AND r.status = 'enviado' AND r.houve_producao = false
      AND r.data BETWEEN p_inicio AND p_fim
      AND r.motivo_sem_producao IN ('Chuva', 'Sem Atividade', 'Folga / Feriado', 'Usina Não Atendeu',
                                    'Problema de Transporte', 'Falha de Combustível', 'Falta de Autorização')
  ),
  cand AS (
    SELECT dd.*, h.hora_inicio, h.hora_fim, coalesce(h.sem_operacao, false) AS sem_op,
           (h.id IS NOT NULL) AS tem_horario,
           EXISTS (SELECT 1 FROM excl x WHERE x.ogs = dd.ogs AND x.dia = dd.dia) AS dia_rdo
    FROM dias dd
    LEFT JOIN LATERAL (
      SELECT hp.* FROM public.equip_horario_programado hp
      WHERE hp.company_id = p_company_id AND hp.ogs_number = dd.ogs AND hp.turno = dd.turno
        AND (hp.equipamento_id IS NULL OR hp.equipamento_id = dd.equipamento_id)
        AND (hp.data IS NULL OR hp.data = dd.dia)
      -- exceção do dia vence padrão; equipamento específico vence padrão da obra.
      ORDER BY (hp.data IS NOT NULL) DESC, (hp.equipamento_id IS NOT NULL) DESC
      LIMIT 1
    ) h ON true
  ),
  jan AS (
    SELECT c.*,
      CASE WHEN c.tem_horario AND NOT c.sem_op AND NOT c.dia_rdo THEN
        pg_catalog.tstzrange(
          ((c.dia + c.hora_inicio) AT TIME ZONE v_tz),
          (((c.dia + c.hora_fim)
             + CASE WHEN c.hora_fim > c.hora_inicio THEN interval '0' ELSE interval '1 day' END) AT TIME ZONE v_tz))
      END AS janela
    FROM cand c
  ),
  chave AS (
    SELECT j.equipamento_id, max(j.frota) AS frota, j.ogs,
      coalesce(pg_catalog.range_agg(j.janela) FILTER (WHERE j.janela IS NOT NULL), v_zero) AS prog,
      count(*) FILTER (WHERE j.janela IS NOT NULL)::integer AS n_prog,
      count(*) FILTER (WHERE NOT j.tem_horario AND NOT j.dia_rdo)::integer AS n_sem_horario,
      count(*) FILTER (WHERE j.sem_op)::integer AS n_sem_op,
      count(*) FILTER (WHERE j.dia_rdo)::integer AS n_rdo
    FROM jan j GROUP BY j.equipamento_id, j.ogs
  ),
  fal AS (
    SELECT f.id, f.equipamento_id, f.ogs_number AS ogs,
           pg_catalog.tstzrange(f.parada_inicio, coalesce(f.parada_fim, now())) AS r,
           (f.parada_fim IS NULL) AS aberta
    FROM public.equip_falhas f
    JOIN chave k ON k.equipamento_id = f.equipamento_id AND k.ogs = f.ogs_number
    WHERE f.company_id = p_company_id AND f.status = 'confirmada'
      AND f.parada_inicio < ((p_fim + 2)::timestamp AT TIME ZONE v_tz)
      AND coalesce(f.parada_fim, now()) > ((p_inicio - 1)::timestamp AT TIME ZONE v_tz)
      AND coalesce(f.parada_fim, now()) > f.parada_inicio
  ),
  fal_k AS (  -- só entram falhas que de fato cortam a janela programada
    SELECT fa.*, (SELECT count(*) FROM public.equip_falha_reparos rp WHERE rp.falha_id = fa.id) AS n_rep,
           (SELECT coalesce(sum(extract(epoch FROM upper(x) - lower(x))), 0)
              FROM unnest((SELECT pg_catalog.range_agg(pg_catalog.tstzrange(rp.reparo_inicio, rp.reparo_fim))
                           FROM public.equip_falha_reparos rp WHERE rp.falha_id = fa.id)) AS x) AS reparo_s,
           (SELECT NOT pg_catalog.isempty(pg_catalog.tstzmultirange(fa.r) * k.prog)
              FROM chave k WHERE k.equipamento_id = fa.equipamento_id AND k.ogs = fa.ogs) AS conta
    FROM fal fa
  ),
  agg AS (
    SELECT k.equipamento_id, k.ogs,
      (SELECT coalesce(sum(extract(epoch FROM upper(x) - lower(x))), 0) FROM unnest(k.prog) AS x) AS prog_s,
      (SELECT coalesce(sum(extract(epoch FROM upper(x) - lower(x))), 0)
         FROM unnest(k.prog * coalesce((SELECT pg_catalog.range_agg(fk.r) FROM fal_k fk
              WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs AND fk.conta), v_zero)) AS x) AS parado_s,
      (SELECT count(*) FROM fal_k fk WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs AND fk.conta)::integer AS n_falhas,
      (SELECT count(*) FROM fal_k fk WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs AND fk.conta
          AND NOT fk.aberta AND fk.n_rep > 0)::integer AS n_rep,
      (SELECT coalesce(sum(fk.reparo_s), 0) FROM fal_k fk WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs
          AND fk.conta AND NOT fk.aberta AND fk.n_rep > 0) AS rep_s,
      (SELECT count(*) FROM fal_k fk WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs AND fk.conta AND fk.aberta)::integer AS n_aberta,
      (SELECT count(*) FROM fal_k fk WHERE fk.equipamento_id = k.equipamento_id AND fk.ogs = k.ogs AND fk.conta
          AND NOT fk.aberta AND fk.n_rep = 0)::integer AS n_sem_rep
    FROM chave k
  )
  SELECT k.equipamento_id, k.frota, k.ogs,
    k.n_prog,
    round(a.prog_s / 3600.0, 2),
    round(a.parado_s / 3600.0, 2),
    CASE WHEN a.prog_s > 0 THEN round((a.prog_s - a.parado_s) / a.prog_s * 100.0, 2) END,
    a.n_falhas,
    round((a.prog_s - a.parado_s) / 3600.0, 2),
    CASE WHEN a.n_falhas > 0 THEN round((a.prog_s - a.parado_s) / 3600.0 / a.n_falhas, 2) END,
    a.n_rep,
    round(a.rep_s / 3600.0, 2),
    CASE WHEN a.n_rep > 0 THEN round(a.rep_s / 3600.0 / a.n_rep, 2) END,
    a.n_aberta, a.n_sem_rep,
    k.n_sem_horario, k.n_sem_op, k.n_rdo
  FROM chave k JOIN agg a ON a.equipamento_id = k.equipamento_id AND a.ogs = k.ogs
  ORDER BY k.frota, k.ogs;
END;
$fn$;

REVOKE ALL ON FUNCTION public.equip_indicadores_manutencao(uuid, date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_indicadores_manutencao(uuid, date, date, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equip_pode_gerir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_pode_gerir(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equip_validar_vinculos() FROM PUBLIC, anon, authenticated;

COMMIT;

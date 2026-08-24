-- Draft visibility hardening (author-only)
-- Goal:
-- 1) Rascunho de equipment_diaries só pode ser lido pelo autor (user_id = auth.uid())
-- 2) Rascunho de rdo_diarios (status_validacao='rascunho') só pode ser lido pelo autor
--
-- Observação:
-- Usamos policy RESTRICTIVE para garantir interseção com policies permissivas já existentes.

BEGIN;

-- equipment_diaries ------------------------------------------------------------
DROP POLICY IF EXISTS equipment_diaries_draft_author_only_select ON public.equipment_diaries;

CREATE POLICY equipment_diaries_draft_author_only_select
ON public.equipment_diaries
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  COALESCE(LOWER(status), '') <> 'rascunho'
  OR user_id = auth.uid()
);

-- rdo_diarios -----------------------------------------------------------------
DROP POLICY IF EXISTS rdo_diarios_draft_author_only_select ON public.rdo_diarios;

CREATE POLICY rdo_diarios_draft_author_only_select
ON public.rdo_diarios
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  COALESCE(LOWER(status_validacao), '') <> 'rascunho'
  OR user_id = auth.uid()
);

COMMIT;

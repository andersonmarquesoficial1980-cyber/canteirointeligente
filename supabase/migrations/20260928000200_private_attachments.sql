-- Lote 1: deny anonymous access without redefining tenant/module roles.
-- Deploy StorageMedia-capable frontend BEFORE committing this migration.
-- Existing company/module authorization is deliberately not widened here.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP POLICY IF EXISTS storage_anon_denied_lote1 ON storage.objects;
CREATE POLICY storage_anon_denied_lote1 ON storage.objects
AS RESTRICTIVE FOR ALL TO anon
USING (bucket_id NOT IN ('notas_fiscais','ci-documentos','sst-fotos','checklist-fotos','face-photos','exports','manutencao-docs'))
WITH CHECK (bucket_id NOT IN ('notas_fiscais','ci-documentos','sst-fotos','checklist-fotos','face-photos','exports','manutencao-docs'));
DROP POLICY IF EXISTS storage_session_required_lote1 ON storage.objects;
CREATE POLICY storage_session_required_lote1 ON storage.objects
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  bucket_id NOT IN ('notas_fiscais','ci-documentos','sst-fotos','checklist-fotos','face-photos','exports','manutencao-docs')
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.status = 'ativo')
  )
)
WITH CHECK (
  bucket_id NOT IN ('notas_fiscais','ci-documentos','sst-fotos','checklist-fotos','face-photos','exports','manutencao-docs')
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.status = 'ativo')
  )
);
UPDATE storage.buckets SET public = false
WHERE id IN ('notas_fiscais','ci-documentos','sst-fotos','checklist-fotos','face-photos','exports','manutencao-docs')
  AND public IS DISTINCT FROM false;
COMMIT;

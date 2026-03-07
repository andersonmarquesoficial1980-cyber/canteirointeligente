-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'notas_fiscais';

-- 2. Drop old anonymous policies
DROP POLICY IF EXISTS "Anyone can upload notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read notas fiscais" ON storage.objects;

-- 3. Create authenticated-only policies
CREATE POLICY "Auth users can upload invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notas_fiscais');

CREATE POLICY "Auth users can read invoices"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notas_fiscais');

CREATE POLICY "Auth users can delete invoices"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notas_fiscais');
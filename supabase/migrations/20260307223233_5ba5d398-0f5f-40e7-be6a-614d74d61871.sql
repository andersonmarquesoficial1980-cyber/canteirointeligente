
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas_fiscais', 'notas_fiscais', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload notas fiscais"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notas_fiscais');

CREATE POLICY "Anyone can read notas fiscais"
ON storage.objects FOR SELECT
USING (bucket_id = 'notas_fiscais');

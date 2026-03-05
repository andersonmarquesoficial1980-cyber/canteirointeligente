CREATE POLICY "Allow public insert on maquinas_frota"
ON public.maquinas_frota
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
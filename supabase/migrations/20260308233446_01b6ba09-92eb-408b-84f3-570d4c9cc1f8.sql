
-- Allow admins to manage OGS
CREATE POLICY "Admin insert ogs" ON public.ogs_reference FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update ogs" ON public.ogs_reference FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete ogs" ON public.ogs_reference FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update/delete maquinas_frota
CREATE POLICY "Admin update maquinas" ON public.maquinas_frota FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete maquinas" ON public.maquinas_frota FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

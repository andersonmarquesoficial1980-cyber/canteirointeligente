
-- 1. Enable RLS on all public tables that don't have it or need policy fixes

-- Tables without RLS
ALTER TABLE public.rdo_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_efetivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_mancha_areia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_temperatura_espalhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_banho_ligacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ogs_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fueling_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing overly permissive policies on maquinas_frota
DROP POLICY IF EXISTS "Allow public insert on maquinas_frota" ON public.maquinas_frota;
DROP POLICY IF EXISTS "Allow public read on maquinas_frota" ON public.maquinas_frota;

-- 3. Create authenticated-only policies for all tables

-- rdo_diarios
CREATE POLICY "Authenticated users can select rdo_diarios" ON public.rdo_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_diarios" ON public.rdo_diarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rdo_diarios" ON public.rdo_diarios FOR UPDATE TO authenticated USING (true);

-- rdo_producao
CREATE POLICY "Authenticated users can select rdo_producao" ON public.rdo_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_producao" ON public.rdo_producao FOR INSERT TO authenticated WITH CHECK (true);

-- rdo_efetivo
CREATE POLICY "Authenticated users can select rdo_efetivo" ON public.rdo_efetivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_efetivo" ON public.rdo_efetivo FOR INSERT TO authenticated WITH CHECK (true);

-- rdo_mancha_areia
CREATE POLICY "Authenticated users can select rdo_mancha_areia" ON public.rdo_mancha_areia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_mancha_areia" ON public.rdo_mancha_areia FOR INSERT TO authenticated WITH CHECK (true);

-- rdo_temperatura_espalhamento
CREATE POLICY "Authenticated users can select rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR INSERT TO authenticated WITH CHECK (true);

-- rdo_banho_ligacao
CREATE POLICY "Authenticated users can select rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR INSERT TO authenticated WITH CHECK (true);

-- ogs_reference (read-only for authenticated)
CREATE POLICY "Authenticated users can select ogs_reference" ON public.ogs_reference FOR SELECT TO authenticated USING (true);

-- fueling_entries
CREATE POLICY "Authenticated users can select fueling_entries" ON public.fueling_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fueling_entries" ON public.fueling_entries FOR INSERT TO authenticated WITH CHECK (true);

-- maquinas_frota (replace public policies with authenticated)
CREATE POLICY "Authenticated users can select maquinas_frota" ON public.maquinas_frota FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert maquinas_frota" ON public.maquinas_frota FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Fix all views to use security_invoker
ALTER VIEW public.view_apoio_form_style SET (security_invoker = on);
ALTER VIEW public.view_bobcat_form_style SET (security_invoker = on);
ALTER VIEW public.view_caminhao_form_style SET (security_invoker = on);
ALTER VIEW public.view_carreta_form_style SET (security_invoker = on);
ALTER VIEW public.view_comboio_form_style SET (security_invoker = on);
ALTER VIEW public.view_fresadora_form_style SET (security_invoker = on);
ALTER VIEW public.view_geral_form_style SET (security_invoker = on);
ALTER VIEW public.view_producao_fresadora SET (security_invoker = on);
ALTER VIEW public.view_relatorio_geral_fresadora SET (security_invoker = on);
ALTER VIEW public.view_rendimento_bits SET (security_invoker = on);
ALTER VIEW public.view_retroescavadeira_form_style SET (security_invoker = on);
ALTER VIEW public.view_rolo_form_style SET (security_invoker = on);
ALTER VIEW public.view_transporte_form_style SET (security_invoker = on);
ALTER VIEW public.view_usina_kma_form_style SET (security_invoker = on);
ALTER VIEW public.view_veiculo_transporte_form_style SET (security_invoker = on);
ALTER VIEW public.view_vibroacabadora_form_style SET (security_invoker = on);

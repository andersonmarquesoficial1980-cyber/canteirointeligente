CREATE TABLE IF NOT EXISTS public.suprimentos_frete_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    veiculo_leve_km NUMERIC NOT NULL DEFAULT 1.50,
    veiculo_pesado_km NUMERIC NOT NULL DEFAULT 3.50,
    hora_motorista NUMERIC NOT NULL DEFAULT 25.00,
    hora_ajudante NUMERIC NOT NULL DEFAULT 15.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id)
);

ALTER TABLE public.suprimentos_frete_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" 
ON public.suprimentos_frete_config FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for company admins" 
ON public.suprimentos_frete_config FOR UPDATE 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'gerente')
    )
);

CREATE POLICY "Enable insert for company admins" 
ON public.suprimentos_frete_config FOR INSERT 
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'gerente')
    )
);

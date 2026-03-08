
-- User roles table (security best practice: separate from profiles)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'apontador',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: admins can manage, users can read own
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tipos de Serviço
CREATE TABLE public.tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vinculo_rdo text NOT NULL DEFAULT 'TODOS',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select tipos_servico" ON public.tipos_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert tipos_servico" ON public.tipos_servico FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth update tipos_servico" ON public.tipos_servico FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete tipos_servico" ON public.tipos_servico FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Materiais
CREATE TABLE public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vinculo_rdo text NOT NULL DEFAULT 'TODOS',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select materiais" ON public.materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert materiais" ON public.materiais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth update materiais" ON public.materiais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete materiais" ON public.materiais FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Empreiteiros
CREATE TABLE public.empreiteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vinculo_rdo text NOT NULL DEFAULT 'TODOS',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.empreiteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select empreiteiros" ON public.empreiteiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert empreiteiros" ON public.empreiteiros FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth update empreiteiros" ON public.empreiteiros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete empreiteiros" ON public.empreiteiros FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vinculo_rdo text NOT NULL DEFAULT 'TODOS',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Usinas
CREATE TABLE public.usinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vinculo_rdo text NOT NULL DEFAULT 'TODOS',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.usinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth select usinas" ON public.usinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert usinas" ON public.usinas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth update usinas" ON public.usinas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth delete usinas" ON public.usinas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add vinculo_rdo to maquinas_frota
ALTER TABLE public.maquinas_frota ADD COLUMN IF NOT EXISTS vinculo_rdo text NOT NULL DEFAULT 'TODOS';

-- Seed initial admin role for anderson@fremix.com.br
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'anderson@fremix.com.br'
ON CONFLICT DO NOTHING;

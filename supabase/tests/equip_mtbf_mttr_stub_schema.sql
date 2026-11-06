-- SOMENTE TESTE: reproduz o mínimo do schema de produção usado pela migration 20261105120000.
-- Nunca aplicar em produção.
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;

CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.companies (id uuid PRIMARY KEY, nome text);
CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, company_id uuid, role text);
CREATE TABLE public.user_permissions (user_id uuid PRIMARY KEY, modulo_manutencao boolean DEFAULT false,
  modulo_engenharia boolean DEFAULT false, modulo_gestao_frotas boolean DEFAULT false);
CREATE TABLE public.user_roles (user_id uuid, role text);
CREATE TABLE public.user_admin_roles (user_id uuid, employee_id uuid, is_active boolean);
CREATE TABLE public.ogs_reference (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, ogs_number text);
CREATE TABLE public.equipamentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  frota text NOT NULL, tipo text, categoria_rdo text);
CREATE TABLE public.manutencao_os (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid);
CREATE TABLE public.equipamentos_ocorrencias (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid);
CREATE TABLE public.equipment_diaries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid,
  date date, period text, status text, is_auto boolean, work_status text, ogs_number text,
  equipamento_id uuid, equipment_fleet text);
CREATE TABLE public.rdo_engenheiro (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  data date, status text, houve_producao boolean, motivo_sem_producao text, ogs_id text, ogs_number text);

-- Definições de produção (has_role simplificada ao ramo relevante).
CREATE FUNCTION public.auth_profile_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public' AS $$ SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1 $$;
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public' AS $$ SELECT exists (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = _role) $$;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Fase 3 (apontamento de produção)
CREATE TABLE IF NOT EXISTS public.equipment_production_areas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid, diary_id uuid, length_m numeric, width_m numeric, thickness_cm numeric);
GRANT SELECT ON public.equipment_production_areas TO authenticated;

-- TEMPLATE de APPLY para onboarding do 2º cliente
-- ⚠️ Preencher placeholders antes de executar.
-- ⚠️ Executar apenas após autorização explícita.

BEGIN;

-- 1) Criar empresa
INSERT INTO public.companies (id, name)
VALUES ('{{NEW_COMPANY_ID_UUID}}', '{{NEW_COMPANY_NAME}}');

-- 2) Vincular profile do admin do novo cliente
-- Pré-requisito: usuário já criado em auth.users
UPDATE public.profiles
SET
  company_id = '{{NEW_COMPANY_ID_UUID}}',
  role = 'admin',
  perfil = 'Administrador',
  status = 'ativo',
  can_create_users = true,
  can_export = true,
  updated_at = now()
WHERE user_id = '{{NEW_ADMIN_USER_ID_UUID}}';

-- 3) Garantir linha em user_permissions
INSERT INTO public.user_permissions (
  user_id, company_id, is_admin,
  modulo_obras, modulo_equipamentos, modulo_rh,
  modulo_carreteiros, modulo_programador, modulo_demandas,
  modulo_manutencao, modulo_abastecimento, modulo_documentos,
  modulo_relatorios, modulo_dashboard,
  modulo_gestao_frotas, modulo_gestao_pessoas,
  modulo_suprimentos, modulo_medicoes,
  modulo_sst, modulo_engenharia, modulo_encarregado,
  created_at, updated_at
)
VALUES (
  '{{NEW_ADMIN_USER_ID_UUID}}', '{{NEW_COMPANY_ID_UUID}}', true,
  true, true, true,
  true, true, true,
  true, true, true,
  true, true,
  true, true,
  true, true,
  true, true, true,
  now(), now()
)
ON CONFLICT (user_id)
DO UPDATE SET
  company_id = EXCLUDED.company_id,
  is_admin = true,
  updated_at = now();

COMMIT;

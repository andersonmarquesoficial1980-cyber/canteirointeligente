-- Preview read-only para onboarding do 2º cliente (SEM DML)

-- 1) Saúde geral RLS/public
SELECT COUNT(*) AS rls_off
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false;

-- 2) Grants anon em perfis (deve retornar 0)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name='profiles'
  AND grantee='anon'
ORDER BY privilege_type;

-- 3) Nulos de company_id críticos
SELECT
  (SELECT COUNT(*) FROM public.profiles WHERE company_id IS NULL) AS profiles_null_company,
  (SELECT COUNT(*) FROM public.user_permissions WHERE company_id IS NULL) AS user_permissions_null_company;

-- 4) Simulação de isolamento (admin não vê superadmin)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','06e738e0-9e1d-4792-8bcb-0c5cacd8edbf', true);
SELECT COUNT(*)::bigint AS admin_can_see_superadmin
FROM public.profiles
WHERE role='superadmin';
ROLLBACK;

-- 5) Simulação de superadmin (deve ver >=1)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','4cecc5c2-c32c-423d-a3f0-11ebcf4ec384', true);
SELECT COUNT(*)::bigint AS superadmin_can_see_superadmin
FROM public.profiles
WHERE role='superadmin';
ROLLBACK;

-- 6) Tenant hardcode (código)
-- executar no terminal local:
-- search_files(pattern="a1b2c3d4-e5f6-7890-abcd-ef1234567890", target="content", path="src")

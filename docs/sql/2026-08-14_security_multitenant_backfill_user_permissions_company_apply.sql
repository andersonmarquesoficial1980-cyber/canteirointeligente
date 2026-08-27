BEGIN;

-- 1) Revogar acesso anon direto em profiles (RLS já protege, mas revoga superfície)
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 2) Backfill seguro: company_id em user_permissions a partir do profile do usuário
--    (não mexe em linhas cujo profile também está sem company_id)
UPDATE public.user_permissions up
SET company_id = p.company_id,
    updated_at = now()
FROM public.profiles p
WHERE up.user_id = p.user_id
  AND up.company_id IS NULL
  AND p.company_id IS NOT NULL;

COMMIT;

-- O apontador não pode consultar o perfil de outro usuário sob RLS.
-- O trigger precisa resolver o engenheiro dentro da empresa sem ampliar a leitura de profiles.
-- A função do trigger não é uma RPC; não aceita argumentos do cliente e altera apenas NEW.
ALTER FUNCTION public.set_rdo_engenheiro_responsavel_user_id() SECURITY DEFINER;
ALTER FUNCTION public.set_rdo_engenheiro_responsavel_user_id() SET search_path = pg_catalog, pg_temp;

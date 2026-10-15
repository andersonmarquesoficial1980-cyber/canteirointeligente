-- Superadmin global não possui company_id; precisa selecionar explicitamente a empresa no frontend.
begin;
create or replace function public.meals_can_access(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.companies c where c.id = p_company_id)
    and exists (
      select 1 from public.profiles p where p.user_id = auth.uid() and (
        p.role = 'superadmin' or (
          p.company_id = p_company_id
          and exists (select 1 from public.company_modules m where m.company_id = p_company_id and m.modulo = 'refeicoes' and m.ativo = true)
          and exists (select 1 from public.user_permissions u where u.user_id = auth.uid() and u.modulo_refeicoes = true)
        )
      )
    );
$$;
create or replace function public.meals_can_manage(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.meals_can_access(p_company_id) and exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and (
      p.role = 'superadmin' or (
        p.company_id = p_company_id and exists (
          select 1 from public.user_permissions u where u.user_id = auth.uid() and u.refeicoes_gestor = true
        )
      )
    )
  );
$$;
commit;

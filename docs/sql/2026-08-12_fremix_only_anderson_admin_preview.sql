-- PREVIEW (read-only)
-- Objetivo: deixar apenas anderson@fremix.workflux.app como admin legado na Fremix.

-- A) Quem está com admin em profiles hoje
select p.user_id, p.nome_completo, p.email, p.role, p.perfil
from public.profiles p
where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and (p.role = 'admin' or p.perfil = 'Administrador')
order by p.email;

-- B) Quem está com role='admin' no user_roles (legado)
select p.user_id, p.nome_completo, p.email, ur.role
from public.user_roles ur
join public.profiles p on p.user_id = ur.user_id
where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and lower(ur.role) = 'admin'
order by p.email;

-- C) Impacto previsto: quantos serão alterados
select
  (select count(*)
   from public.profiles p
   where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
     and lower(p.email) <> lower('anderson@fremix.workflux.app')
     and (p.role = 'admin' or p.perfil = 'Administrador')) as profiles_para_downgrade,
  (select count(*)
   from public.user_roles ur
   join public.profiles p on p.user_id = ur.user_id
   where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
     and lower(p.email) <> lower('anderson@fremix.workflux.app')
     and lower(ur.role) = 'admin') as user_roles_admin_para_remover;
-- Preview: travar acesso total legado no Painel e manter granular por Admin Roles

-- 1) Quem ainda tem user_permissions.is_admin = true na Fremix
select p.nome_completo, p.email, up.is_admin
from public.user_permissions up
join public.profiles p on p.user_id = up.user_id
where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and up.is_admin = true
order by p.email;

-- 2) Usuários com Admin Roles ativos (controle granular)
select p.nome_completo, p.email, string_agg(ar.name, ', ' order by ar.name) as roles_admin_ativos
from public.profiles p
join public.user_admin_roles uar on uar.employee_id = p.user_id and uar.company_id = p.company_id and uar.is_active = true
join public.admin_roles ar on ar.id = uar.role_id
where p.company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
group by p.nome_completo, p.email
order by p.email;

-- 3) Definição atual da função has_role
select pg_get_functiondef('public.has_role(uuid,text)'::regprocedure);

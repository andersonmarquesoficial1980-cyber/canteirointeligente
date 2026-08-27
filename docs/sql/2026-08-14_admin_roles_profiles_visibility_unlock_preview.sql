-- PREVIEW (read-only)
-- Objetivo: diagnosticar por que usuários com Admin Roles enxergam apenas o próprio profile
-- e mapear legado user_admin_roles com user_id nulo.

-- 1) Ver políticas atuais de SELECT em profiles
select policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname='public' and tablename='profiles' and cmd='SELECT'
order by policyname;

-- 2) Quem tem role admin ativo via user_admin_roles mas NÃO é admin por perfil/role
select p.user_id,
       p.nome_completo,
       p.email,
       p.perfil,
       p.role,
       p.company_id,
       count(*) filter (where uar.is_active) as admin_roles_ativos
from profiles p
join user_admin_roles uar on (uar.user_id = p.user_id or uar.employee_id = p.user_id)
where uar.is_active = true
group by p.user_id, p.nome_completo, p.email, p.perfil, p.role, p.company_id
having lower(coalesce(p.role,'')) <> 'admin'
   and lower(coalesce(p.role,'')) <> 'superadmin'
   and lower(coalesce(p.perfil,'')) <> 'administrador'
order by admin_roles_ativos desc, p.nome_completo;

-- 3) Linhas legadas em user_admin_roles sem user_id (podem quebrar consistência de ACL)
select ar.name as role_name,
       count(*) as total_rows,
       count(*) filter (where uar.is_active) as active_rows
from user_admin_roles uar
left join admin_roles ar on ar.id = uar.role_id
where uar.user_id is null
group by ar.name
order by active_rows desc, role_name;

-- 4) Preview de mapeamento seguro employee_id -> profiles.user_id
select uar.id,
       uar.employee_id,
       p.user_id as mapped_user_id,
       p.email,
       ar.name as role_name,
       uar.is_active,
       exists (
         select 1
         from user_admin_roles x
         where x.id <> uar.id
           and x.role_id = uar.role_id
           and x.user_id = p.user_id
       ) as has_conflict
from user_admin_roles uar
join profiles p on p.user_id = uar.employee_id
left join admin_roles ar on ar.id = uar.role_id
where uar.user_id is null
order by uar.assigned_at desc;

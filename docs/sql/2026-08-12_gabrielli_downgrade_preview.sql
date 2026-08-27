-- Preview (read-only): trocar Gabrielli de admin/Administrador para user/Usuário
with target as (
  select p.user_id, p.nome_completo, p.email, p.role, p.perfil, p.company_id
  from public.profiles p
  where lower(p.email)=lower('gabrielli.sousa@fremix.workflux.app')
  limit 1
)
select * from target;

-- Outros administradores no tenant Fremix para decisão posterior
select p.user_id, p.nome_completo, p.email, p.role, p.perfil, p.company_id
from public.profiles p
where p.company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and (
    p.role='admin'
    or p.perfil='Administrador'
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.user_id
        and lower(ur.role)='admin'
    )
  )
order by p.email;
begin;

-- 1) Profiles: remover marcação admin de todos da Fremix, exceto Anderson
update public.profiles p
set role = 'user',
    perfil = 'Usuário'
where p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and lower(p.email) <> lower('anderson@fremix.workflux.app')
  and (p.role = 'admin' or p.perfil = 'Administrador');

-- 2) user_roles legado: remover role='admin' de todos da Fremix, exceto Anderson
delete from public.user_roles ur
using public.profiles p
where p.user_id = ur.user_id
  and p.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and lower(p.email) <> lower('anderson@fremix.workflux.app')
  and lower(ur.role) = 'admin';

commit;
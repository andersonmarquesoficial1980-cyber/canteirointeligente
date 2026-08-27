begin;

update public.profiles
set role = 'user',
    perfil = 'Usuário'
where lower(email)=lower('gabrielli.sousa@fremix.workflux.app')
  and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890';

commit;
do $$
declare
  v_system_id uuid;
  v_custom_id uuid := gen_random_uuid();
begin
  select id into v_system_id
  from public.admin_roles
  where name = 'Super_Admin'
  limit 1;

  begin
    delete from public.admin_roles where id = v_system_id;
    raise exception 'ERRO: delete de role de sistema não foi bloqueado';
  exception
    when others then
      raise notice 'OK bloqueado: %', sqlerrm;
  end;

  insert into public.admin_roles (id, name, description, is_system_role, active, company_id)
  values (v_custom_id, 'TMP_DELETE_TEST_20260812', 'tmp', false, true, null)
  on conflict do nothing;

  delete from public.admin_roles where id = v_custom_id;

  if exists (select 1 from public.admin_roles where id = v_custom_id) then
    raise exception 'ERRO: role comum não foi deletado';
  else
    raise notice 'OK delete role comum liberado';
  end if;
end
$$;
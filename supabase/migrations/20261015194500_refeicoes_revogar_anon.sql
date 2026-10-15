-- As permissões padrão do projeto concedem EXECUTE diretamente ao papel anon.
-- Revogá-las explicitamente; só sessões autenticadas podem chamar as RPCs.
begin;
revoke execute on function public.meals_can_access(uuid), public.meals_can_manage(uuid),
  public.meals_list_employees(uuid,integer), public.meals_save_draft(uuid,date,text,uuid[],timestamptz),
  public.meals_close(uuid), public.meals_deliver(uuid,integer,text) from anon;
commit;

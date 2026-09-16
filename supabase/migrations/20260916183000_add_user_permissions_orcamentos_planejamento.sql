begin;

alter table public.user_permissions
  add column if not exists modulo_orcamentos boolean not null default false,
  add column if not exists modulo_planejamento boolean not null default false;

update public.user_permissions
set modulo_orcamentos = coalesce(modulo_orcamentos, false),
    modulo_planejamento = coalesce(modulo_planejamento, false)
where modulo_orcamentos is null
   or modulo_planejamento is null;

commit;

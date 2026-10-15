-- Controle diário de refeições. Migração aditiva; não altera funcionários existentes.
begin;

alter table public.user_permissions add column if not exists modulo_refeicoes boolean not null default false;
alter table public.user_permissions add column if not exists refeicoes_gestor boolean not null default false;

create table if not exists public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  meal_date date not null,
  shift text not null check (shift in ('diurno', 'noturno')),
  supplier text not null default 'Luana – Sabor Delícia',
  status text not null default 'rascunho' check (status in ('rascunho','fechado','entregue')),
  delivered_quantity integer check (delivered_quantity is null or delivered_quantity >= 0),
  delivery_note text,
  closed_at timestamptz,
  closed_by uuid,
  delivered_at timestamptz,
  delivered_by uuid,
  updated_at timestamptz not null default now(),
  unique (company_id, meal_date, shift),
  unique (id, company_id)
);

create table if not exists public.meal_order_people (
  order_id uuid not null,
  company_id uuid not null,
  employee_id uuid not null references public.employees(id),
  employee_name text not null,
  team_name text not null,
  active boolean not null default true,
  primary key (order_id, employee_id),
  foreign key (order_id, company_id) references public.meal_orders(id, company_id)
);
create index if not exists meal_orders_company_date_idx on public.meal_orders(company_id, meal_date desc);

create or replace function public.meals_can_access(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.company_id = p_company_id
      and (p.role = 'superadmin' or (
        exists (select 1 from public.company_modules m where m.company_id = p_company_id and m.modulo = 'refeicoes' and m.ativo = true)
        and exists (select 1 from public.user_permissions u where u.user_id = auth.uid() and u.modulo_refeicoes = true)
      ))
  );
$$;
revoke all on function public.meals_can_access(uuid) from public;
grant execute on function public.meals_can_access(uuid) to authenticated;

-- A lista nominal não depende da permissão ampla de RH.
create or replace function public.meals_list_employees(p_company_id uuid, p_offset integer default 0)
returns table(id uuid, name text, equipe text, matricula text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.meals_can_access(p_company_id) then raise exception 'Sem permissão'; end if;
  if p_offset < 0 or p_offset is null then raise exception 'Página inválida'; end if;
  return query select e.id, e.name::text, e.equipe::text, e.matricula::text
    from public.employees e where e.company_id = p_company_id and e.status ilike 'ativ%'
      and coalesce(e.origem, '') <> 'TERCEIRO'
    order by e.id limit 500 offset p_offset;
end;
$$;
revoke all on function public.meals_list_employees(uuid,integer) from public;
grant execute on function public.meals_list_employees(uuid,integer) to authenticated;

create or replace function public.meals_can_manage(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.meals_can_access(p_company_id) and exists (
    select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = p_company_id
      and (p.role = 'superadmin' or exists (
        select 1 from public.user_permissions u where u.user_id = auth.uid() and u.refeicoes_gestor = true
      ))
  );
$$;
revoke all on function public.meals_can_manage(uuid) from public;
grant execute on function public.meals_can_manage(uuid) to authenticated;

alter table public.meal_orders enable row level security;
alter table public.meal_order_people enable row level security;
create policy meal_orders_read on public.meal_orders for select to authenticated using (public.meals_can_access(company_id));
create policy meal_order_people_read on public.meal_order_people for select to authenticated using (public.meals_can_access(company_id));
revoke all on public.meal_orders, public.meal_order_people from anon, authenticated;
grant select on public.meal_orders, public.meal_order_people to authenticated;

-- Uma só operação transacional para atualizar a lista nominal. Nenhum pedido fechado pode ser editado.
create or replace function public.meals_save_draft(p_company_id uuid, p_date date, p_shift text, p_employee_ids uuid[], p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_count integer; v_created uuid; v_updated_at timestamptz;
begin
  if not public.meals_can_access(p_company_id) then raise exception 'Sem permissão para refeições'; end if;
  if p_date is null or p_shift not in ('diurno','noturno') or p_employee_ids is null then raise exception 'Pedido inválido'; end if;
  if cardinality(p_employee_ids) <> (select count(distinct x) from unnest(p_employee_ids) x) then raise exception 'Funcionário duplicado'; end if;
  select count(*) into v_count from public.employees e where e.id = any(p_employee_ids) and e.company_id = p_company_id
    and e.status ilike 'ativ%' and coalesce(e.origem, '') <> 'TERCEIRO';
  if v_count <> cardinality(p_employee_ids) then raise exception 'Funcionário inválido ou de outra empresa'; end if;
  insert into public.meal_orders(company_id, meal_date, shift) values (p_company_id, p_date, p_shift)
    on conflict (company_id, meal_date, shift) do nothing returning id into v_created;
  select id, updated_at into v_order, v_updated_at from public.meal_orders where company_id = p_company_id and meal_date = p_date and shift = p_shift for update;
  if (select status from public.meal_orders where id = v_order) <> 'rascunho' then raise exception 'Pedido já fechado'; end if;
  if (v_created is null and (p_expected_updated_at is null or p_expected_updated_at <> v_updated_at)) then
    raise exception 'Pedido alterado por outra pessoa. Atualize a página antes de salvar';
  end if;
  update public.meal_order_people set active = false where order_id = v_order and active = true;
  insert into public.meal_order_people(order_id, company_id, employee_id, employee_name, team_name, active)
    select v_order, p_company_id, e.id, e.name, coalesce(nullif(trim(e.equipe),''), 'Sem equipe'), true
    from public.employees e where e.id = any(p_employee_ids)
    on conflict (order_id, employee_id) do update set active = true, employee_name = excluded.employee_name, team_name = excluded.team_name;
  update public.meal_orders set updated_at = now() where id = v_order;
  return v_order;
end;
$$;

create or replace function public.meals_close(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.meal_orders%rowtype;
begin
  select * into v_order from public.meal_orders where id = p_order_id for update;
  if not found or not public.meals_can_manage(v_order.company_id) then raise exception 'Sem permissão'; end if;
  if v_order.status <> 'rascunho' then raise exception 'Pedido já fechado'; end if;
  if not exists (select 1 from public.meal_order_people where order_id = p_order_id and active) then raise exception 'Selecione funcionários antes de fechar'; end if;
  update public.meal_orders set status = 'fechado', closed_at = now(), closed_by = auth.uid(), updated_at = now() where id = p_order_id;
end;
$$;

create or replace function public.meals_deliver(p_order_id uuid, p_quantity integer, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.meal_orders%rowtype; v_requested integer;
begin
  select * into v_order from public.meal_orders where id = p_order_id for update;
  if not found or not public.meals_can_manage(v_order.company_id) then raise exception 'Sem permissão'; end if;
  if v_order.status <> 'fechado' or p_quantity is null or p_quantity < 0 then raise exception 'Entrega inválida'; end if;
  select count(*) into v_requested from public.meal_order_people where order_id = p_order_id and active;
  if p_quantity <> v_requested and nullif(trim(p_note), '') is null then raise exception 'Justifique a diferença na entrega'; end if;
  update public.meal_orders set status = 'entregue', delivered_quantity = p_quantity,
    delivery_note = nullif(trim(p_note), ''), delivered_at = now(), delivered_by = auth.uid(), updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.meals_save_draft(uuid,date,text,uuid[],timestamptz), public.meals_close(uuid), public.meals_deliver(uuid,integer,text) from public;
grant execute on function public.meals_save_draft(uuid,date,text,uuid[],timestamptz), public.meals_close(uuid), public.meals_deliver(uuid,integer,text) to authenticated;
commit;

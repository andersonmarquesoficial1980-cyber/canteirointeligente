-- WF Programador — OGS atual por equipe (Quadro Pessoas) + relatório "Quadro de Hoje".
-- Campo informativo digitado pelo Programador (só o número). NÃO vincula pessoas à OGS, não altera
-- employees nem RDO: é só o rótulo mostrado no topo da coluna e na exportação do RH.
-- Aditiva e idempotente: cria tabela nova, não toca em nenhuma tabela existente.

begin;

create table if not exists public.equipe_ogs_quadro (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  equipe_chave text not null check (length(trim(equipe_chave)) > 0),
  equipe_nome text not null,
  ogs text null check (ogs is null or length(ogs) <= 40),
  updated_by_user_id uuid null,
  updated_by_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipe_ogs_quadro_company_equipe_uk unique (company_id, equipe_chave)
);

create or replace function public.touch_equipe_ogs_quadro_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_equipe_ogs_quadro_updated_at on public.equipe_ogs_quadro;
create trigger trg_touch_equipe_ogs_quadro_updated_at
before update on public.equipe_ogs_quadro
for each row execute function public.touch_equipe_ogs_quadro_updated_at();

alter table public.equipe_ogs_quadro enable row level security;

-- Ler: qualquer usuário da empresa (o rótulo aparece no quadro e no relatório para todos).
drop policy if exists "equipe_ogs_quadro_select" on public.equipe_ogs_quadro;
create policy "equipe_ogs_quadro_select"
on public.equipe_ogs_quadro
for select
using (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (p.role = 'superadmin' or p.company_id = equipe_ogs_quadro.company_id)
  )
);

-- Gravar (inserir/alterar): só quem tem WF Programador, admin da empresa ou perfis de gestão.
drop policy if exists "equipe_ogs_quadro_insert" on public.equipe_ogs_quadro;
create policy "equipe_ogs_quadro_insert"
on public.equipe_ogs_quadro
for insert
with check (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = equipe_ogs_quadro.company_id
           and (
             p.role = 'admin'
             or p.perfil in ('Administrador', 'Gerente')
             or exists (
               select 1 from public.user_permissions up
                where up.user_id = auth.uid()
                  and (up.is_admin is true or up.modulo_programador is true)
             )
           )
         )
       )
  )
);

drop policy if exists "equipe_ogs_quadro_update" on public.equipe_ogs_quadro;
create policy "equipe_ogs_quadro_update"
on public.equipe_ogs_quadro
for update
using (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = equipe_ogs_quadro.company_id
           and (
             p.role = 'admin'
             or p.perfil in ('Administrador', 'Gerente')
             or exists (
               select 1 from public.user_permissions up
                where up.user_id = auth.uid()
                  and (up.is_admin is true or up.modulo_programador is true)
             )
           )
         )
       )
  )
)
with check (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (p.role = 'superadmin' or p.company_id = equipe_ogs_quadro.company_id)
  )
);

-- Sem DELETE: para limpar, grava ogs = null.

commit;

-- WF Gestão de Frotas — Pendências por equipamento (Quadro de Equipes)
-- Registra o que vai acontecer com o equipamento (devolver, manutenção, alocar...). NÃO altera
-- equipamentos.status nem equipamentos.setor: é só uma fila de decisão visível no card.
-- Aditiva e idempotente: cria tabela nova, não toca em nenhuma tabela existente.

begin;

create table if not exists public.equip_pendencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  equipment_id uuid not null references public.equipamentos(id) on delete cascade,
  tipo text not null check (tipo in ('devolver', 'manutencao', 'alocar', 'transferir', 'baixar', 'substituir', 'outros')),
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'aprovada', 'reprovada', 'cancelada')),
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  justificativa text not null check (length(trim(justificativa)) >= 3),
  data_efetiva date null,
  payload jsonb not null default '{}'::jsonb,
  solicitado_por_user_id uuid null,
  solicitado_por_nome text null,
  parecer text null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equip_pendencias_company_status
  on public.equip_pendencias (company_id, status, created_at desc);
create index if not exists idx_equip_pendencias_equipment
  on public.equip_pendencias (equipment_id, created_at desc);

create or replace function public.touch_equip_pendencias_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_equip_pendencias_updated_at on public.equip_pendencias;
create trigger trg_touch_equip_pendencias_updated_at
before update on public.equip_pendencias
for each row execute function public.touch_equip_pendencias_updated_at();

alter table public.equip_pendencias enable row level security;

-- Ler: qualquer usuário da empresa (o selo aparece no quadro para todos).
drop policy if exists "equip_pendencias_select" on public.equip_pendencias;
create policy "equip_pendencias_select"
on public.equip_pendencias
for select
using (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (p.role = 'superadmin' or p.company_id = equip_pendencias.company_id)
  )
);

-- Registrar: usuário da empresa; o solicitado_por precisa ser o próprio usuário (ou nulo).
drop policy if exists "equip_pendencias_insert" on public.equip_pendencias;
create policy "equip_pendencias_insert"
on public.equip_pendencias
for insert
with check (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (p.role = 'superadmin' or p.company_id = equip_pendencias.company_id)
  )
  and (solicitado_por_user_id is null or solicitado_por_user_id = auth.uid())
);

-- Resolver/cancelar/editar: admin da empresa, perfis de gestão ou quem tem WF Programador.
drop policy if exists "equip_pendencias_update" on public.equip_pendencias;
create policy "equip_pendencias_update"
on public.equip_pendencias
for update
using (
  exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and (
         p.role = 'superadmin'
         or (
           p.company_id = equip_pendencias.company_id
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
       and (p.role = 'superadmin' or p.company_id = equip_pendencias.company_id)
  )
);

-- Sem DELETE: pendência resolvida/cancelada fica como histórico.

commit;

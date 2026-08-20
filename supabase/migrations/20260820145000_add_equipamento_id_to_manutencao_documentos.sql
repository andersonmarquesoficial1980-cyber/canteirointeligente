-- Vincular documentos de manutenção ao cadastro raiz de equipamentos
-- Objetivo: evitar vínculo por texto livre (frota/placa) e permitir chave estável por equipamento_id

begin;

alter table public.manutencao_documentos
  add column if not exists equipamento_id uuid;

-- Backfill não-destrutivo: tenta casar docs legados por frota/placa dentro da mesma empresa
update public.manutencao_documentos md
set
  equipamento_id = e.id,
  equipment_fleet = coalesce(nullif(trim(md.equipment_fleet), ''), e.frota),
  equipment_type = coalesce(nullif(trim(md.equipment_type), ''), e.tipo)
from public.equipamentos e
where md.equipamento_id is null
  and md.company_id is not distinct from e.company_id
  and coalesce(nullif(trim(md.equipment_fleet), ''), '') <> ''
  and (
    lower(trim(md.equipment_fleet)) = lower(trim(coalesce(e.frota, '')))
    or lower(trim(md.equipment_fleet)) = lower(trim(coalesce(e.placa, '')))
  );

create index if not exists idx_manutencao_documentos_equipamento_id
  on public.manutencao_documentos (equipamento_id);

create index if not exists idx_manutencao_documentos_company_equipamento_id
  on public.manutencao_documentos (company_id, equipamento_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manutencao_documentos_equipamento_id_fkey'
  ) then
    alter table public.manutencao_documentos
      add constraint manutencao_documentos_equipamento_id_fkey
      foreign key (equipamento_id)
      references public.equipamentos(id)
      on delete set null;
  end if;
end $$;

commit;

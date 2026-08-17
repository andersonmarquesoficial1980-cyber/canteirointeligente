-- Cadastro raiz de equipamentos: campos complementares
-- Frota/Centro de Custo, Marca e Série

begin;

alter table public.equipamentos
  add column if not exists centro_custo text,
  add column if not exists marca text,
  add column if not exists serie text;

-- Backfill não destrutivo para manter compatibilidade imediata
update public.equipamentos
set centro_custo = coalesce(nullif(trim(centro_custo), ''), frota)
where coalesce(nullif(trim(centro_custo), ''), '') = ''
  and coalesce(nullif(trim(frota), ''), '') <> '';

update public.equipamentos
set marca = coalesce(nullif(trim(marca), ''), tipo_veiculo)
where coalesce(nullif(trim(marca), ''), '') = ''
  and coalesce(nullif(trim(tipo_veiculo), ''), '') <> '';

update public.equipamentos
set serie = coalesce(nullif(trim(serie), ''), chassi)
where coalesce(nullif(trim(serie), ''), '') = ''
  and coalesce(nullif(trim(chassi), ''), '') <> '';

commit;

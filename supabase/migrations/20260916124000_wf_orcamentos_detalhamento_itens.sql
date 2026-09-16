begin;

alter table public.wf_orcamento_itens
  add column if not exists referencia text not null default '',
  add column if not exists natureza text not null default 'previsto' check (natureza in ('previsto','nao_previsto')),
  add column if not exists motivo_nao_previsto text null,
  add column if not exists unidade text not null default 'un',
  add column if not exists fator_aplicacao numeric(14,4) not null default 1,
  add column if not exists detalhamento jsonb not null default '{}'::jsonb;

-- Recalcula total considerando quantidade x fator_aplicacao x unitario
alter table public.wf_orcamento_itens
  drop column if exists total;

alter table public.wf_orcamento_itens
  add column total numeric(14,2)
  generated always as (round((quantidade * fator_aplicacao * unitario)::numeric, 2)) stored;

commit;

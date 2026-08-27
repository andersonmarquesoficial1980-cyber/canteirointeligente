-- Homologação da regra de 48h (RDO + Diário de Equipamento)
-- Ambiente: projeto linked (ucgcqexunnsrffzrfhqu)
-- OBS: testes com INSERT são feitos dentro de transação com ROLLBACK.

-- 1) Conferir se as funções e triggers existem
select proname
from pg_proc
where proname in (
  'fn_can_bypass_diary_deadline',
  'fn_assert_diary_deadline_48h',
  'trg_enforce_rdo_deadline_48h',
  'trg_enforce_equipment_diary_deadline_48h'
)
order by proname;

select tgname, tgrelid::regclass as tabela, tgenabled
from pg_trigger
where tgname in (
  'trg_enforce_rdo_deadline_48h',
  'trg_enforce_equipment_diary_deadline_48h'
)
and not tgisinternal
order by tgname;

-- 2) Data/hora São Paulo (referência de janela de 48h)
select now() at time zone 'America/Sao_Paulo' as agora_sp,
       (now() at time zone 'America/Sao_Paulo')::date as hoje_sp,
       ((now() at time zone 'America/Sao_Paulo')::date - 2) as limite_48h;

-- 3) Snapshot de volume dentro/fora da janela (read-only)
with hoje as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
)
select 'rdo_diarios' as tabela,
       count(*) as total,
       count(*) filter (where data::date between (select d - 2 from hoje) and (select d from hoje)) as dentro_48h,
       count(*) filter (where data::date < (select d - 2 from hoje)) as fora_48h
from public.rdo_diarios
union all
select 'equipment_diaries' as tabela,
       count(*) as total,
       count(*) filter (where date::date between (select d - 2 from hoje) and (select d from hoje)) as dentro_48h,
       count(*) filter (where date::date < (select d - 2 from hoje)) as fora_48h
from public.equipment_diaries;

-- 4) Teste de regra sem mexer em dados reais (transação + rollback)
-- Troque USER_UUID_NAO_ADMIN por um user_id válido não-admin e COMPANY_UUID pela empresa dele.
begin;

-- 4.1 Deve BLOQUEAR (fora de 48h, sem liberação)
-- Esperado: erro P0001 com mensagem "Prazo de 48h expirado..."
select public.fn_assert_diary_deadline_48h(
  'USER_UUID_NAO_ADMIN'::uuid,
  'COMPANY_UUID'::uuid,
  ((now() at time zone 'America/Sao_Paulo')::date - 3),
  'rdo'
);

-- 4.2 Deve PERMITIR (dentro de 48h)
select public.fn_assert_diary_deadline_48h(
  'USER_UUID_NAO_ADMIN'::uuid,
  'COMPANY_UUID'::uuid,
  ((now() at time zone 'America/Sao_Paulo')::date - 1),
  'rdo'
);

-- 4.3 Deve PERMITIR quando houver liberação explícita
insert into public.diary_unlock_requests (user_id, data_liberada, tipo, company_id)
values (
  'USER_UUID_NAO_ADMIN'::uuid,
  ((now() at time zone 'America/Sao_Paulo')::date - 4),
  'rdo',
  'COMPANY_UUID'::uuid
)
on conflict do nothing;

select public.fn_assert_diary_deadline_48h(
  'USER_UUID_NAO_ADMIN'::uuid,
  'COMPANY_UUID'::uuid,
  ((now() at time zone 'America/Sao_Paulo')::date - 4),
  'rdo'
);

rollback;

-- 5) Teste no app (manual)
-- a) Apontador tenta lançar RDO e diário com data = hoje-3 => deve bloquear
-- b) Admin libera em Configurações > Desbloqueio de Lançamentos
-- c) Apontador repete o mesmo lançamento => deve permitir
-- d) Admin revoga liberação => volta a bloquear
-- Proposta de normalização CE01 (Julho/2026) — PREVIEW + UPDATE (manual)
-- Company: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Frota: CE01 | Tipo: Caminhões

-- 1) PREVIEW before/after (não altera dados)
with alvo(data, novo_ini, novo_fim) as (
  values
    (date '2026-07-21', 193816, 193816),
    (date '2026-07-22', 193816, 193821),
    (date '2026-07-23', 193821, 193826),
    (date '2026-07-24', 193826, 193831),
    (date '2026-07-25', 193831, 193836),
    (date '2026-07-26', 193836, 193841),
    (date '2026-07-27', 193841, 193846)
)
select
  ed.id,
  ed.date,
  ed.odometer_initial as atual_ini,
  ed.odometer_final   as atual_fim,
  a.novo_ini,
  a.novo_fim,
  (a.novo_ini - ed.odometer_initial) as delta_ini,
  (a.novo_fim - ed.odometer_final)   as delta_fim,
  ed.work_status,
  ed.period,
  ed.observations
from equipment_diaries ed
join alvo a on a.data = ed.date
where ed.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and ed.equipment_fleet = 'CE01'
  and ed.equipment_type = 'Caminhões'
  and ed.status = 'enviado'
order by ed.date;

-- 2) EXECUÇÃO (descomentar somente após aprovação explícita)
-- begin;
-- with alvo(data, novo_ini, novo_fim, motivo) as (
--   values
--     (date '2026-07-21', 193816, 193816, 'Normalização do dia 21 para remover regressão de odômetro.'),
--     (date '2026-07-22', 193816, 193821, 'Re-diluição 5 km/dia no bloco 22-27.'),
--     (date '2026-07-23', 193821, 193826, 'Re-diluição 5 km/dia no bloco 22-27.'),
--     (date '2026-07-24', 193826, 193831, 'Re-diluição 5 km/dia no bloco 22-27.'),
--     (date '2026-07-25', 193831, 193836, 'Re-diluição 5 km/dia no bloco 22-27.'),
--     (date '2026-07-26', 193836, 193841, 'Re-diluição 5 km/dia no bloco 22-27.'),
--     (date '2026-07-27', 193841, 193846, 'Re-diluição 5 km/dia no bloco 22-27.')
-- )
-- update equipment_diaries ed
-- set
--   odometer_initial = a.novo_ini,
--   odometer_final = a.novo_fim,
--   observations = case
--     when coalesce(ed.observations,'') = ''
--       then '[AJUSTE 2026-08-05] Normalização odômetro CE01. ' || a.motivo
--     else ed.observations || E'\n[AJUSTE 2026-08-05] Normalização odômetro CE01. ' || a.motivo
--   end
-- from alvo a
-- where ed.date = a.data
--   and ed.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   and ed.equipment_fleet = 'CE01'
--   and ed.equipment_type = 'Caminhões'
--   and ed.status = 'enviado';
--
-- commit;

-- 3) Pós-validação (não altera dados)
-- with s as (
--   select
--     date,
--     odometer_initial,
--     odometer_final,
--     lag(odometer_final) over(order by date) as prev_final
--   from equipment_diaries
--   where company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--     and equipment_fleet='CE01'
--     and equipment_type='Caminhões'
--     and status='enviado'
--     and date between date '2026-07-01' and date '2026-07-31'
-- )
-- select
--   date,
--   odometer_initial,
--   odometer_final,
--   prev_final,
--   odometer_initial - prev_final as gap_inicial,
--   odometer_final - odometer_initial as km_dia
-- from s
-- order by date;

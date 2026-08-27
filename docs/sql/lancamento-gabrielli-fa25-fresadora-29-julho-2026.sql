begin;
with src(src_row,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,work_status,period,meter_initial,meter_final,observations) as (
  values
  (3, date '2026-07-03', 'TIAGO SALUSTRIANO', 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Trabalhando', 'diurno', 958, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (4, date '2026-07-04', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (5, date '2026-07-05', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (6, date '2026-07-06', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (7, date '2026-07-07', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (8, date '2026-07-08', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (9, date '2026-07-09', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (10, date '2026-07-10', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (11, date '2026-07-11', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (12, date '2026-07-12', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (13, date '2026-07-13', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (14, date '2026-07-14', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (15, date '2026-07-15', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (16, date '2026-07-16', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (17, date '2026-07-17', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (18, date '2026-07-18', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (19, date '2026-07-19', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (20, date '2026-07-20', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (21, date '2026-07-21', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (22, date '2026-07-22', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (23, date '2026-07-23', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (24, date '2026-07-24', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (25, date '2026-07-25', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (26, date '2026-07-26', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (27, date '2026-07-27', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (28, date '2026-07-28', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (29, date '2026-07-29', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (30, date '2026-07-30', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.'),
  (31, date '2026-07-31', NULL, 'Fresadora', 'FA25', '2529', 'AEROPORTO', 'GRU', 'Disposição', 'diurno', 979, 979, '[IMPORT 2026-08-06] Lançamento Fresadora FA25 Gabrielli (planilha) - sem exclusão/substituição.')
), ins as (
  insert into equipment_diaries (
    company_id,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,
    work_status,period,meter_initial,meter_final,status,created_by,user_id,equipamento_id,observations
  )
  select
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    s.date,
    nullif(s.operator_name,''),
    s.equipment_type,
    s.equipment_fleet,
    s.ogs_number,
    nullif(s.client_name,''),
    nullif(s.location_address,''),
    s.work_status,
    s.period,
    s.meter_initial,
    s.meter_final,
    'enviado',
    '01e48480-d95b-47b8-a7b1-e77af33d39e7'::uuid,
    '01e48480-d95b-47b8-a7b1-e77af33d39e7'::uuid,
    e.id,
    s.observations
  from src s
  join equipamentos e
    on e.company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
   and e.frota=s.equipment_fleet
  returning id, equipment_fleet, date
)
select count(*) as diarios_inseridos from ins;
commit;

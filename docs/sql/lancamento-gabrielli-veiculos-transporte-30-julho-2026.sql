begin;
with src(src_row,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,work_status,period,odometer_initial,odometer_final,observations) as (
  values
  (8, date '2026-07-01', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 628903, 628903, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (20, date '2026-07-04', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 629176, 629176, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (21, date '2026-07-05', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 629176, 629285, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (26, date '2026-07-05', NULL, 'Veículo', 'MCO0009', '2543', 'ELLENCO CONSTRUCÕES', 'SÃO ROQUE/SP', 'Disposição', 'diurno', 593822, 593856, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (27, date '2026-07-06', NULL, 'Veículo', 'MCO0009', '2543', 'ELLENCO CONSTRUCÕES', 'SÃO ROQUE/SP', 'Disposição', 'diurno', 593856, 593856, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (34, date '2026-07-08', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', 'AV. PAVÃO', 'Disposição', 'diurno', 593889, 593889, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (46, date '2026-07-11', NULL, 'Veículo', 'MCO0009', '2525', 'PMSP', NULL, 'Disposição', 'noturno', 593966, 593966, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (47, date '2026-07-12', NULL, 'Veículo', 'MCO0009', '2525', 'PMSP', NULL, 'Disposição', 'noturno', 593966, 593966, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (50, date '2026-07-11', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 630150, 630150, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (51, date '2026-07-12', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 630150, 630150, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (60, date '2026-07-15', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'noturno', 594043, 594043, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (64, date '2026-07-15', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 630588, 630588, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (69, date '2026-07-17', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 630838, 630838, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (89, date '2026-07-17', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594083, 594100, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (90, date '2026-07-18', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594100, 594160, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (91, date '2026-07-19', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594160, 594180, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (92, date '2026-07-20', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594180, 594200, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (93, date '2026-07-21', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594200, 594300, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (94, date '2026-07-22', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594300, 594500, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (95, date '2026-07-23', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594500, 594656, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (105, date '2026-07-25', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 632163, 632163, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (106, date '2026-07-26', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 632163, 632163, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (107, date '2026-07-27', NULL, 'Veículo', 'BUS0003', '2539', 'MOTIVA', 'SOROCABA', 'Disposição', 'diurno', 632163, 632163, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (123, date '2026-07-25', NULL, 'Veículo', 'MCO0009', '2544', 'PMSP', NULL, 'Disposição', 'diurno', 594897, 594900, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (124, date '2026-07-26', NULL, 'Veículo', 'MCO0009', '2545', 'PMSP', NULL, 'Disposição', 'diurno', 594900, 594980, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (125, date '2026-07-27', NULL, 'Veículo', 'MCO0009', '2545', 'PMSP', NULL, 'Disposição', 'diurno', 594999, 595000, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (126, date '2026-07-28', NULL, 'Veículo', 'MCO0009', '2545', 'PMSP', NULL, 'Disposição', 'diurno', 595000, 595000, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (127, date '2026-07-29', NULL, 'Veículo', 'MCO0009', '2509', 'PMSP', NULL, 'Disposição', 'diurno', 595000, 595000, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (128, date '2026-07-30', NULL, 'Veículo', 'MCO0009', '2509', 'PMSP', NULL, 'Disposição', 'diurno', 595000, 595000, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.'),
  (129, date '2026-07-31', NULL, 'Veículo', 'MCO0009', '2509', 'PMSP', NULL, 'Disposição', 'diurno', 595000, 595000, '[IMPORT 2026-08-06] Lançamento Veículos Transporte Gabrielli (planilha) - sem exclusão/substituição.')
), ins as (
  insert into equipment_diaries (
    company_id,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,
    work_status,period,odometer_initial,odometer_final,status,created_by,user_id,equipamento_id,observations
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
    s.odometer_initial,
    s.odometer_final,
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

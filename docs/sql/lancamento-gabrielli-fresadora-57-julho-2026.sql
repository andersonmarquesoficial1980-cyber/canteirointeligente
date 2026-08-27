begin;
with src(src_row,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,meter_initial,meter_final,work_status,period,observations) as (
  values
  (2, date '2026-07-01', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (3, date '2026-07-02', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (4, date '2026-07-03', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (5, date '2026-07-04', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (6, date '2026-07-05', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (7, date '2026-07-06', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (8, date '2026-07-07', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (9, date '2026-07-08', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (10, date '2026-07-09', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (11, date '2026-07-10', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (12, date '2026-07-11', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (13, date '2026-07-12', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (14, date '2026-07-13', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (15, date '2026-07-14', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (16, date '2026-07-15', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (17, date '2026-07-16', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (18, date '2026-07-17', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (19, date '2026-07-18', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (20, date '2026-07-19', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (21, date '2026-07-20', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11215, 11215, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (26, date '2026-07-25', 'FABIO FERNANDES LIMA', 'Fresadora', 'FA12', '2544', 'FREMIX', NULL, 11226, 11226, 'Disposição', 'noturno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (27, date '2026-07-26', 'FABIO FERNANDES LIMA', 'Fresadora', 'FA12', '2544', 'FREMIX', NULL, 11226, 11226, 'Disposição', 'noturno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (28, date '2026-07-27', 'FABIO FERNANDES LIMA', 'Fresadora', 'FA12', '2544', 'FREMIX', NULL, 11226, 11226, 'Disposição', 'noturno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (29, date '2026-07-28', 'FABIO FERNANDES LIMA', 'Fresadora', 'FA12', '2544', 'FREMIX', NULL, 11226, 11226, 'Disposição', 'noturno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (31, date '2026-07-01', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11213, 11213, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (32, date '2026-07-02', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11213, 11213, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (33, date '2026-07-03', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11213, 11213, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (34, date '2026-07-04', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11213, 11213, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (35, date '2026-07-05', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11213, 11213, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (106, date '2026-07-01', NULL, 'Fresadora', 'FA26', '2539', 'MOTIVA', 'SOROCABA', 2204, 2204, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (135, date '2026-07-30', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11230, 11230, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (136, date '2026-07-31', NULL, 'Fresadora', 'FA12', '000', 'FREMIX', NULL, 11230, 11230, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (137, date '2026-07-07', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (138, date '2026-07-08', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (139, date '2026-07-09', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (140, date '2026-07-10', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (141, date '2026-07-11', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (142, date '2026-07-12', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (143, date '2026-07-13', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (144, date '2026-07-14', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (145, date '2026-07-15', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (146, date '2026-07-16', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (147, date '2026-07-17', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (148, date '2026-07-18', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (149, date '2026-07-19', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (150, date '2026-07-20', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (151, date '2026-07-21', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (152, date '2026-07-22', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (153, date '2026-07-23', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (154, date '2026-07-24', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (155, date '2026-07-25', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (156, date '2026-07-26', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (157, date '2026-07-27', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (158, date '2026-07-28', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (159, date '2026-07-29', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (160, date '2026-07-30', NULL, 'Fresadora', 'FA14', '000', 'BASE / PÁTIO CENTRAL', 'FREMIX', 11214, 11214, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.'),
  (161, date '2026-07-31', NULL, 'Fresadora', 'FA14', '000', NULL, NULL, NULL, NULL, 'Disposição', 'diurno', '[IMPORT 2026-08-06] Lançamento Fresadora Gabrielli (planilha) - sem exclusão/substituição.')
), ins as (
  insert into equipment_diaries (
    company_id,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,
    meter_initial,meter_final,work_status,period,status,created_by,user_id,equipamento_id,observations
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
    s.meter_initial,
    s.meter_final,
    s.work_status,
    s.period,
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

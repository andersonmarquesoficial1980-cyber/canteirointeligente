begin;
with src(src_row,date,operator_name,equipment_type,equipment_fleet,ogs_number,client_name,location_address,work_status,period,odometer_initial,odometer_final,observations) as (
  values
  (3, date '2026-07-02', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (4, date '2026-07-03', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (5, date '2026-07-04', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (6, date '2026-07-05', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (7, date '2026-07-06', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (8, date '2026-07-07', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (9, date '2026-07-08', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (10, date '2026-07-09', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (11, date '2026-07-10', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (12, date '2026-07-11', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (13, date '2026-07-12', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (14, date '2026-07-13', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (15, date '2026-07-14', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (16, date '2026-07-15', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (17, date '2026-07-16', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (18, date '2026-07-17', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (19, date '2026-07-18', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (20, date '2026-07-19', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (21, date '2026-07-20', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (22, date '2026-07-21', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (23, date '2026-07-22', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (24, date '2026-07-23', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (25, date '2026-07-24', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (26, date '2026-07-25', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.'),
  (27, date '2026-07-26', NULL, 'Veículo', 'BUS0001', '000', 'FREMIX', 'BASE - OSASCO', 'Manutenção', 'diurno', 857652, 857652, '[IMPORT 2026-08-06] Lançamento BUS0001 Gabrielli (planilha) - sem exclusão/substituição.')
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
  returning id,equipment_fleet,date
)
select count(*) as diarios_inseridos from ins;
commit;

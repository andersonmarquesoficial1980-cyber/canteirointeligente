
with vals(d,odo_i,odo_f,obs) as (
  values
  (date '2026-07-03',193610,193629,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 19 km entre 02/07 e 04/07.'),
  (date '2026-07-05',193646,193656,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 54 km entre 04/07 e 10/07.'),
  (date '2026-07-06',193656,193667,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 54 km entre 04/07 e 10/07.'),
  (date '2026-07-07',193667,193678,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 54 km entre 04/07 e 10/07.'),
  (date '2026-07-08',193678,193689,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 54 km entre 04/07 e 10/07.'),
  (date '2026-07-09',193689,193700,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 54 km entre 04/07 e 10/07.'),
  (date '2026-07-11',193716,193731,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 45 km entre 10/07 e 14/07.'),
  (date '2026-07-12',193731,193746,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 45 km entre 10/07 e 14/07.'),
  (date '2026-07-13',193746,193761,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 45 km entre 10/07 e 14/07.'),
  (date '2026-07-15',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-16',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-17',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-18',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-19',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-20',193816,193816,'[BACKFILL 2026-08-05] CE01 Julho automático. Gap 14/07→21/07 com diferença negativa (-381); aplicado 0 km/dia.'),
  (date '2026-07-22',193435,193503,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-23',193503,193571,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-24',193571,193639,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-25',193639,193708,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-26',193708,193777,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-27',193777,193846,'[BACKFILL 2026-08-05] CE01 Julho automático. Diluição de 411 km entre 21/07 e 28/07.'),
  (date '2026-07-29',193865,193865,'[BACKFILL 2026-08-05] CE01 Julho automático. Sem âncora posterior no mês; mantido 0 km/dia.'),
  (date '2026-07-30',193865,193865,'[BACKFILL 2026-08-05] CE01 Julho automático. Sem âncora posterior no mês; mantido 0 km/dia.'),
  (date '2026-07-31',193865,193865,'[BACKFILL 2026-08-05] CE01 Julho automático. Sem âncora posterior no mês; mantido 0 km/dia.')
), ins as (
  insert into equipment_diaries (
    date,equipment_fleet,equipment_type,operator_name,period,work_status,
    ogs_number,client_name,location_address,odometer_initial,odometer_final,
    status,user_id,created_by,company_id,observations
  )
  select
    v.d,
    'CE01',
    'Caminhões',
    'MAGNUS HENRIQUE DE F ZEGGIO',
    'diurno',
    'Trabalhando',
    '2529',
    'GRU - AIRPORT',
    'AEROPORTO DE GUARULHOS',
    v.odo_i,
    v.odo_f,
    'enviado',
    '3d0608c6-b6b7-473b-862a-ec8d0a23920f',
    '3d0608c6-b6b7-473b-862a-ec8d0a23920f',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    v.obs
  from vals v
  where not exists (
    select 1 from equipment_diaries e
    where e.company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      and e.equipment_fleet='CE01'
      and e.equipment_type='Caminhões'
      and e.date=v.d
  )
  returning id,date
), ins_time as (
  insert into equipment_time_entries (diary_id,start_time,end_time,activity,description)
  select id,'07:00:00','17:00:00','Trabalhando','[BACKFILL 2026-08-05] Apontamento automático 07:00-17:00.'
  from ins
  returning diary_id
)
select (select count(*) from ins) as diarios_inseridos,
       (select count(*) from ins_time) as apontamentos_inseridos;

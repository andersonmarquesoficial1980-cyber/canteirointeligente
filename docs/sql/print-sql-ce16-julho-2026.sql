-- Print SQL diário para validação visual
-- CE16 | Julho/2026 | Caminhões | status=enviado

select
  ed.date,
  ed.odometer_initial as odo_inicial,
  ed.odometer_final   as odo_final,
  ed.work_status      as status,
  coalesce(
    string_agg(
      to_char(te.start_time,'HH24:MI') || '-' || to_char(te.end_time,'HH24:MI') || ' ' || coalesce(te.activity,'-'),
      ' | '
      order by te.start_time
    ),
    'SEM APONTAMENTO'
  ) as apontamento
from equipment_diaries ed
left join equipment_time_entries te on te.diary_id = ed.id
where ed.company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and ed.equipment_fleet = 'CE16'
  and ed.equipment_type = 'Caminhões'
  and ed.status = 'enviado'
  and ed.date between date '2026-07-01' and date '2026-07-31'
group by ed.id, ed.date, ed.odometer_initial, ed.odometer_final, ed.work_status
order by ed.date;

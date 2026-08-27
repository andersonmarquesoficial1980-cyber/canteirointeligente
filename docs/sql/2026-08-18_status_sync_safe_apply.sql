-- APPLY (somente após autorização explícita)
with upd(employee_id,target_status) as (
values
  ('3839cfbe-4a70-411e-adef-ead5a302f94d', 'ativo'),
  ('0ff3215c-2a75-4d30-b88b-40ec25a668a4', 'demitido'),
  ('7ad47aad-717a-4fca-9119-3b58facf577a', 'ativo'),
  ('855589d5-5757-473b-9cd0-90226796c8aa', 'afastado'),
  ('13408e90-56f6-45e1-977a-4414ba4e25d9', 'ativo'),
  ('3ecf8a9f-ecb9-4f88-b639-98de3af10cac', 'ativo'),
  ('cf2f1452-8f65-4868-9514-e15aa2ef10fb', 'demitido'),
  ('6c42b6ed-89f1-4671-9842-b8969e8cb297', 'demitido'),
  ('26dec74b-9196-49e9-ab36-e83ad1b33b8f', 'ativo'),
  ('c4b9369f-e151-427d-a004-65003c9657e6', 'ativo'),
  ('0463eac9-a1f2-43d1-ac0f-9861ebfda04d', 'demitido'),
  ('21291485-b163-4ee0-887d-ed2574eece1c', 'demitido'),
  ('baa14dff-7312-4aca-93c0-961592316e6c', 'demitido')
)
update employees e
set status = u.target_status
from upd u
where e.id=u.employee_id::uuid
  and coalesce(e.status,'') <> u.target_status
returning e.id,e.name,e.matricula,e.cpf,e.status;

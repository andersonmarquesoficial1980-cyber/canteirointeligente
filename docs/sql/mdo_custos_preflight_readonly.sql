-- Pré-implantação SOMENTE LEITURA. Execute no SQL Editor antes de autorizar a migração.
-- Nenhum comando abaixo altera dados/permissões.
WITH expected(table_name,column_name) AS (
  VALUES ('rdo_efetivo','employee_id'),('rdo_efetivo','nome'),('rdo_efetivo','rdo_id'),
    ('rdo_diarios','data'),('rdo_diarios','ogs_id'),('rdo_diarios','status_validacao'),
    ('employees','data_admissao'),('employees','data_demissao'),('employees','company_id'),
    ('employees','name'),('employees','role'),('employees','equipe'),('employees','matricula'),('employees','status'),
    ('profiles','user_id'),('profiles','company_id'),('profiles','status'),('profiles','nome_completo'),('profiles','email'),
    ('ogs_reference','company_id'),('ogs_reference','ogs_number')
)
SELECT e.table_name,e.column_name,c.data_type,
  CASE WHEN c.column_name IS NULL THEN 'BLOQUEIO: COLUNA AUSENTE' ELSE 'OK' END AS verificacao
FROM expected e LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=e.table_name AND c.column_name=e.column_name
ORDER BY e.table_name,e.column_name;

SELECT c.id,c.name FROM public.companies c WHERE c.name ILIKE '%fremix%';

WITH empresa AS (SELECT id FROM public.companies WHERE name ILIKE '%fremix%'),
rdos AS (SELECT r.id,r.data,r.ogs_id FROM public.rdo_diarios r JOIN empresa x ON x.id=r.company_id
  WHERE r.data BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'
    AND coalesce(r.status_validacao,'') <> 'rascunho'),
efetivo AS (SELECT e.* FROM public.rdo_efetivo e JOIN rdos r ON r.id=e.rdo_id)
SELECT (SELECT count(*) FROM rdos) AS rdos,
  (SELECT count(*) FROM rdos r WHERE r.ogs_id IS NULL) AS rdos_sem_ogs,
  (SELECT count(*) FROM efetivo) AS linhas_efetivo,
  (SELECT count(*) FROM efetivo WHERE employee_id IS NOT NULL) AS vinculos_id,
  (SELECT count(*) FROM efetivo WHERE coalesce(nome,'') LIKE '%|||%') AS nomes_concatenados,
  (SELECT count(*) FROM public.employees e JOIN empresa x ON x.id=e.company_id
    WHERE e.status='ativo' OR e.data_demissao BETWEEN DATE '2026-09-01' AND DATE '2026-09-30') AS pessoas_candidatas;

-- Se houver BLOQUEIO na primeira consulta ou divergência inesperada na terceira,
-- não aplicar a migração. Confirmar tipos/FKs, RLS e usuários de Custos antes do deploy.

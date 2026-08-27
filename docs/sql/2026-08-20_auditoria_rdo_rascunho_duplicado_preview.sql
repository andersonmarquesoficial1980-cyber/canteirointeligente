-- Auditoria de regressão: RDO aparecendo simultaneamente como rascunho e publicado
-- Objetivo: detectar chaves (company_id + user_id + data + obra_nome + turno)
-- com pelo menos 1 linha em rascunho e 1 linha publicada.

WITH base AS (
  SELECT
    id,
    company_id,
    user_id,
    data,
    obra_nome,
    COALESCE(turno, '') AS turno,
    status_validacao,
    created_at
  FROM rdo_diarios
),
chaves AS (
  SELECT
    company_id,
    user_id,
    data,
    obra_nome,
    turno,
    COUNT(*) FILTER (WHERE status_validacao = 'rascunho') AS qtd_rascunho,
    COUNT(*) FILTER (WHERE status_validacao IS DISTINCT FROM 'rascunho') AS qtd_publicado
  FROM base
  GROUP BY 1,2,3,4,5
),
conflitos AS (
  SELECT *
  FROM chaves
  WHERE qtd_rascunho > 0
    AND qtd_publicado > 0
)
SELECT
  COUNT(*) AS chaves_com_conflito,
  COALESCE(SUM(qtd_rascunho), 0) AS total_linhas_rascunho,
  COALESCE(SUM(qtd_publicado), 0) AS total_linhas_publicadas
FROM conflitos;

-- Detalhamento das chaves com conflito (mais recentes primeiro)
WITH base AS (
  SELECT
    id,
    company_id,
    user_id,
    data,
    obra_nome,
    COALESCE(turno, '') AS turno,
    status_validacao,
    created_at
  FROM rdo_diarios
),
chaves AS (
  SELECT
    company_id,
    user_id,
    data,
    obra_nome,
    turno,
    COUNT(*) FILTER (WHERE status_validacao = 'rascunho') AS qtd_rascunho,
    COUNT(*) FILTER (WHERE status_validacao IS DISTINCT FROM 'rascunho') AS qtd_publicado,
    MAX(created_at) AS ultimo_evento
  FROM base
  GROUP BY 1,2,3,4,5
),
conflitos AS (
  SELECT *
  FROM chaves
  WHERE qtd_rascunho > 0
    AND qtd_publicado > 0
)
SELECT
  c.company_id,
  c.user_id,
  p.nome_completo,
  p.email,
  c.data,
  c.obra_nome,
  c.turno,
  c.qtd_rascunho,
  c.qtd_publicado,
  c.ultimo_evento
FROM conflitos c
LEFT JOIN profiles p
  ON p.user_id = c.user_id
ORDER BY c.ultimo_evento DESC
LIMIT 200;

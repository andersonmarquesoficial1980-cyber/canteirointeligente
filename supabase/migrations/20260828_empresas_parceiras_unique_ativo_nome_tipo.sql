-- Evita duplicidade de empresa terceirizada ativa por empresa + tipo + nome normalizado
-- Mantém flexibilidade para histórico inativo (duplicados antigos podem permanecer inativos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_parceiras_ativo_nome_norm_tipo
ON public.empresas_parceiras (company_id, tipo, lower(btrim(nome)))
WHERE ativo = true;

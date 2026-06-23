-- Fase 1: Programação Noturna
-- Adiciona colunas à ci_programacoes SEM quebrar registros existentes
-- Todas com DEFAULT seguro para não afetar linhas já existentes

ALTER TABLE public.ci_programacoes
  ADD COLUMN IF NOT EXISTS status_programacao TEXT NOT NULL DEFAULT 'CONFIRMADO',
  ADD COLUMN IF NOT EXISTS equipamentos_designados TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engenheiro_responsavel TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS obs_manutencao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_manutencao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_por TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS carretas_designadas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT DEFAULT NULL;

-- Registros existentes (histórico) ficam como CONFIRMADO por padrão
-- Novos rascunhos criados pela Engenharia virão como RASCUNHO

COMMENT ON COLUMN public.ci_programacoes.status_programacao IS 'RASCUNHO | AGUARDANDO_MANUTENCAO | CONFIRMADO | CANCELADO';
COMMENT ON COLUMN public.ci_programacoes.equipamentos_designados IS 'Array de frotas designadas para a obra';
COMMENT ON COLUMN public.ci_programacoes.carretas_designadas IS 'Array de frotas de carretas para transporte';
COMMENT ON COLUMN public.ci_programacoes.tipo_servico IS 'PAVIMENTAÇÃO | RETRABALHO | FRESAGEM | INFRA | OUTRO';

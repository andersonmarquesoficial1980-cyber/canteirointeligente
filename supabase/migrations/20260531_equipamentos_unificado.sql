-- ============================================================
-- TABELA MESTRE UNIFICADA: equipamentos
-- Substitui maquinas_frota + frotas_gestao
-- ============================================================

CREATE TABLE IF NOT EXISTS public.equipamentos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL,

  -- Identificação
  frota                 text NOT NULL,           -- Código de frota (CC01, FA20, etc.) — chave de negócio
  nome                  text NOT NULL,           -- Nome/modelo resumido
  modelo_completo       text,                    -- Modelo completo (Mercedes Actros 2651s, etc.)
  tipo                  text,                    -- FRESADORA, CAMINHÃO CARROCERIA, etc.
  categoria_rdo         text,                    -- Categoria usada no RDO (PAVIMENTAÇÃO, CAMINHÃO, etc.)
  tipo_veiculo          text,                    -- caminhao, maquina, van, carreta, outro
  ano                   text,
  placa                 text,
  patrimonio            text,
  chassi                text,
  cor                   text,

  -- Condição e propriedade
  condicao              text NOT NULL DEFAULT 'PROPRIO',  -- PROPRIO | TERCEIRO
  empresa_proprietaria  text,                    -- Nome da empresa (quando TERCEIRO)
  empresa_terceira_id   uuid REFERENCES public.empresas_terceiras(id),

  -- Vínculos com módulos
  vinculos              text[] DEFAULT '{"TODOS"}',  -- RDO, ROLO, EQUIPAMENTOS, etc.
  vinculo_rdo           text DEFAULT 'TODOS',

  -- Operação
  status                text NOT NULL DEFAULT 'ativo',  -- ativo, inativo, manutencao, vendido
  setor                 text,                    -- Equipe/frente a que está designado
  condutor_atual        text,                    -- Para veículos com motorista fixo
  local_atual           text,                    -- Obra/canteiro atual
  horímetro_atual       numeric,
  km_atual              numeric,
  observacoes           text,
  motivo_manutencao     text,
  previsao_liberacao    date,

  -- Financeiro — próprio
  valor_aquisicao       numeric,                 -- Valor pago na compra
  data_aquisicao        date,
  nf_aquisicao_url      text,                    -- Arquivo da nota fiscal de compra

  -- Financeiro — terceiro
  valor_mensal          numeric,                 -- Valor de locação mensal
  data_inicio_locacao   date,
  data_fim_locacao      date,
  periodo_medicao       text DEFAULT 'MENSAL',   -- MENSAL, QUINZENAL, SEMANAL, OBRA
  dia_fechamento        integer DEFAULT 30,       -- Dia do mês para gerar medição

  -- Manutenção preventiva
  intervalo_troca_oleo_h  integer,               -- Intervalo em horas para troca de óleo
  ultimo_horímetro_oleo   numeric,               -- Horímetro da última troca

  -- Metadados
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equip_company_member" ON public.equipamentos;
CREATE POLICY "equip_company_member" ON public.equipamentos
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_equipamentos_frota ON public.equipamentos(frota);
CREATE INDEX IF NOT EXISTS idx_equipamentos_company ON public.equipamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_condicao ON public.equipamentos(condicao);
CREATE INDEX IF NOT EXISTS idx_equipamentos_status ON public.equipamentos(status);

-- ============================================================
-- MIGRAÇÃO: maquinas_frota → equipamentos
-- ============================================================
INSERT INTO public.equipamentos (
  id, company_id, frota, nome, tipo, categoria_rdo, condicao,
  empresa_proprietaria, vinculos, vinculo_rdo, status, created_at, updated_at
)
SELECT
  id,
  company_id,
  frota,
  nome,
  tipo,
  categoria,
  condicao,
  CASE WHEN upper(empresa) IN ('PRÓPRIO','PROPRIO','') OR empresa IS NULL THEN NULL ELSE empresa END,
  vinculos,
  vinculo_rdo,
  CASE WHEN lower(status) IN ('ativo','operando','operacional') THEN 'ativo'
       WHEN lower(status) LIKE '%manuten%' THEN 'manutencao'
       ELSE 'ativo' END,
  created_at,
  now()
FROM public.maquinas_frota
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- MIGRAÇÃO: frotas_gestao → equipamentos
-- Merge nos duplicados (mesmo código de frota): complementa dados
-- ============================================================
INSERT INTO public.equipamentos (
  id, company_id, frota, nome, modelo_completo, tipo, tipo_veiculo,
  ano, placa, condicao, empresa_proprietaria, empresa_terceira_id,
  setor, condutor_atual, status, valor_mensal,
  motivo_manutencao, previsao_liberacao,
  vinculos, vinculo_rdo, created_at, updated_at
)
SELECT
  fg.id,
  fg.company_id,
  fg.codigo_custo,
  COALESCE(fg.modelo, fg.codigo_custo),
  fg.modelo,
  fg.tipo_veiculo,
  fg.tipo_veiculo,
  fg.ano,
  fg.placa,
  fg.condicao,
  fg.locadora,
  fg.empresa_terceira_id,
  fg.setor,
  fg.condutor_atual,
  CASE WHEN fg.status = 'ativo' THEN 'ativo' ELSE fg.status END,
  fg.valor_mensal,
  fg.motivo_manutencao,
  fg.previsao_liberacao,
  '{"TODOS"}',
  'TODOS',
  fg.created_at,
  now()
FROM public.frotas_gestao fg
-- Só insere se não existe ainda (evita duplicar os 20 sobrepostos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipamentos e WHERE e.frota = fg.codigo_custo AND e.company_id = fg.company_id
)
ON CONFLICT (id) DO NOTHING;

-- Complementa os 20 duplicados: adiciona placa, modelo_completo, ano, setor, condutor de frotas_gestao
UPDATE public.equipamentos e
SET
  modelo_completo   = COALESCE(e.modelo_completo, fg.modelo),
  placa             = COALESCE(e.placa, fg.placa),
  ano               = COALESCE(e.ano, fg.ano),
  setor             = COALESCE(e.setor, fg.setor),
  condutor_atual    = COALESCE(e.condutor_atual, fg.condutor_atual),
  valor_mensal      = COALESCE(e.valor_mensal, fg.valor_mensal),
  tipo_veiculo      = COALESCE(e.tipo_veiculo, fg.tipo_veiculo),
  updated_at        = now()
FROM public.frotas_gestao fg
WHERE e.frota = fg.codigo_custo
  AND e.company_id = fg.company_id;

-- ============================================================
-- TABELA: equipamentos_documentos (CRLV, licenças, seguros, NF)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipamentos_documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id  uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL,
  tipo            text NOT NULL,  -- CRLV, SEGURO, LICENCA, NF_AQUISICAO, CONTRATO_LOCACAO, OUTRO
  descricao       text,
  numero          text,
  data_emissao    date,
  data_vencimento date,
  arquivo_url     text,
  alerta_dias     integer DEFAULT 30,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equip_docs_member" ON public.equipamentos_documentos
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_eq_docs_equipamento ON public.equipamentos_documentos(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_eq_docs_vencimento ON public.equipamentos_documentos(data_vencimento);

-- ============================================================
-- TABELA: equipamentos_manutencoes (histórico de manutenções)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipamentos_manutencoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id  uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL,
  tipo            text NOT NULL,  -- TROCA_OLEO, PNEU, CORRETIVA, PREVENTIVA, REVISAO
  descricao       text,
  data            date NOT NULL,
  horímetro       numeric,
  km              numeric,
  custo           numeric,
  fornecedor      text,
  mecanico        text,
  pecas           jsonb,          -- [{nome, qtd, valor}]
  arquivo_url     text,
  observacoes     text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos_manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equip_manut_member" ON public.equipamentos_manutencoes
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_eq_manut_equipamento ON public.equipamentos_manutencoes(equipamento_id);

-- ============================================================
-- TABELA: equipamentos_medicoes (medições mensais de terceiros)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipamentos_medicoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id  uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL,
  periodo_inicio  date NOT NULL,
  periodo_fim     date NOT NULL,
  dias_trabalhados integer,
  horímetro_inicio numeric,
  horímetro_fim    numeric,
  valor_base      numeric,
  valor_total     numeric,
  status          text DEFAULT 'PENDENTE',  -- PENDENTE, APROVADA, PAGA, CANCELADA
  observacoes     text,
  arquivo_url     text,
  gerado_em       timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos_medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equip_med_member" ON public.equipamentos_medicoes
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_eq_med_equipamento ON public.equipamentos_medicoes(equipamento_id);

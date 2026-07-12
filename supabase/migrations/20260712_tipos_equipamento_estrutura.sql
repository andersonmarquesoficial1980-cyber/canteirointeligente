-- ============================================================
-- MIGRAÇÃO: Estrutura completa de Tipos de Equipamento
-- 2026-07-12
-- ============================================================

-- 1. CORRIGIR DUPLICATAS DE GRAFIA em equipamentos
-- ============================================================

-- MICROONIBUS → MICROÔNIBUS (unificar)
UPDATE equipamentos SET tipo = 'MICROÔNIBUS' WHERE tipo = 'MICROONIBUS';

-- PA CARREGADEIRA → PÁ CARREGADEIRA
UPDATE equipamentos SET tipo = 'PÁ CARREGADEIRA' WHERE tipo = 'PA CARREGADEIRA';

-- SERRA CLIPER → SERRA CLIPPER (grafia correta com 2 Ps)
UPDATE equipamentos SET tipo = 'SERRA CLIPPER' WHERE tipo = 'SERRA CLIPER';

-- 2. REORGANIZAR categorias existentes em equipamento_tipos
-- ============================================================

-- Categoria ROLO passa a ser PAVIMENTACAO (rolos ficam em Pavimentação)
UPDATE equipamento_tipos SET categoria = 'PAVIMENTACAO' WHERE categoria = 'ROLO';

-- Categoria VEICULO → VEICULOS (padronizar)
UPDATE equipamento_tipos SET categoria = 'VEICULOS' WHERE categoria = 'VEICULO';

-- 3. INSERIR TIPOS FALTANTES
-- ============================================================

-- Caminhões faltantes
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CAMINHOES', 'CAMINHAO_COMBOIO',    'Caminhão Comboio',    '🚛', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CAMINHOES', 'CAMINHAO_PLATAFORMA', 'Caminhão Plataforma', '🚚', true)
ON CONFLICT DO NOTHING;

-- Carretas (categoria nova)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CARRETAS', 'CAVALO_MECANICO', 'Cavalo Mecânico',  '🚛', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CARRETAS', 'PRANCHA_REBOQUE', 'Prancha Reboque',  '🚚', true)
ON CONFLICT DO NOTHING;

-- Pavimentação — adicionar Vibro Acabadora (Rolos já foram migrados acima)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAVIMENTACAO', 'VIBRO_ACABADORA', 'Vibro Acabadora', '🛣️', true)
ON CONFLICT DO NOTHING;

-- Fresagem (categoria nova)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FRESAGEM', 'FRESADORA', 'Fresadora', '⚒️', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'FRESAGEM', 'BOBCAT',    'Bobcat',    '🟠', true)
ON CONFLICT DO NOTHING;

-- Usinagem (categoria nova)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'USINAGEM', 'USINA_MOVEL', 'Usina Móvel', '🏭', true)
ON CONFLICT DO NOTHING;

-- Pequeno Porte (categoria nova)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'COMPRESSOR',           'Compressor',             '🔧', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'GERADOR',              'Gerador',                '⚡', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'ROMPEDOR_ELETRICO',    'Rompedor Elétrico',      '🔩', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'ROMPEDOR_PNEUMATICO',  'Rompedor Pneumático',    '🔩', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'PLACA_VIBRATORIA',     'Placa Vibratória',       '📳', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'MISTURADOR_ARGAMASSA', 'Misturador de Argamassa','🔄', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'SERRA_CLIPPER',        'Serra Clipper',          '🪚', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PEQUENO_PORTE', 'TORRE_ILUMINACAO',     'Torre de Iluminação',    '💡', true)
ON CONFLICT DO NOTHING;

-- Sanitários e Apoio (categoria nova)
INSERT INTO equipamento_tipos (company_id, categoria, subtipo, label, icone, ativo)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SANITARIO', 'BANHEIRO_QUIMICO',    'Banheiro Químico',    '🚽', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SANITARIO', 'CARRETINHA_BANHEIRO', 'Carretinha Banheiro', '🚛', true)
ON CONFLICT DO NOTHING;

-- 4. VERIFICAR RESULTADO
-- ============================================================
SELECT categoria, COUNT(*) as qtd_tipos
FROM equipamento_tipos
GROUP BY categoria
ORDER BY categoria;

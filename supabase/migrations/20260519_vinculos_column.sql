-- Adiciona coluna vinculos (array) nas tabelas que usam vínculo multi-seleção
ALTER TABLE maquinas_frota ADD COLUMN IF NOT EXISTS vinculos text[] DEFAULT '{"TODOS"}';
ALTER TABLE truck_registry ADD COLUMN IF NOT EXISTS vinculos text[] DEFAULT '{"TODOS"}';
ALTER TABLE tipos_servico ADD COLUMN IF NOT EXISTS vinculos text[] DEFAULT '{"TODOS"}';
ALTER TABLE empreiteiros ADD COLUMN IF NOT EXISTS vinculos text[] DEFAULT '{"TODOS"}';

-- Popula vinculos a partir de vinculo_rdo existente para não perder dados
UPDATE maquinas_frota SET vinculos = ARRAY[vinculo_rdo] WHERE vinculos IS NULL OR vinculos = '{}';
UPDATE truck_registry SET vinculos = ARRAY[vinculo_rdo] WHERE vinculos IS NULL OR vinculos = '{}';
UPDATE tipos_servico SET vinculos = ARRAY[vinculo_rdo] WHERE vinculos IS NULL OR vinculos = '{}';
UPDATE empreiteiros SET vinculos = ARRAY[vinculo_rdo] WHERE vinculos IS NULL OR vinculos = '{}';

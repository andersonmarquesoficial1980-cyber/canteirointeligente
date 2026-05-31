-- Unifica funcionários próprios e terceirizados em employees (fonte única)
-- Adiciona origem: PROPRIO (default) ou TERCEIRO
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'PROPRIO',
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas_terceiras(id),
  ADD COLUMN IF NOT EXISTS funcao_terceiro text;

-- Índice para busca por origem
CREATE INDEX IF NOT EXISTS idx_employees_origem ON public.employees(origem);

-- Migra funcionarios_terceiros existentes para employees (exceto registros de teste)
-- (executar manualmente se houver dados reais em funcionarios_terceiros)
-- INSERT INTO public.employees (name, empresa_id, company_id, origem, status)
-- SELECT nome, empresa_id, company_id, 'TERCEIRO', 'ativo' FROM public.funcionarios_terceiros WHERE nome != 'teste';

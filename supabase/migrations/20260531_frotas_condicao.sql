-- Adiciona campo condicao (PROPRIO/TERCEIRO) e FK para empresa terceira em frotas_gestao
ALTER TABLE public.frotas_gestao
  ADD COLUMN IF NOT EXISTS condicao text NOT NULL DEFAULT 'PROPRIO',
  ADD COLUMN IF NOT EXISTS empresa_terceira_id uuid REFERENCES public.empresas_terceiras(id);

-- Migra dados existentes a partir do campo categoria
UPDATE public.frotas_gestao SET condicao = 'TERCEIRO' WHERE categoria = 'locado';
UPDATE public.frotas_gestao SET condicao = 'PROPRIO' WHERE categoria = 'proprio' OR categoria IS NULL;

-- Índice para buscas por condição
CREATE INDEX IF NOT EXISTS idx_frotas_gestao_condicao ON public.frotas_gestao(condicao);

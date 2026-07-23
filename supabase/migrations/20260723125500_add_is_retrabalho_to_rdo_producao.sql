-- Adiciona flag de retrabalho por trecho na produção do RDO (Infraestrutura)
ALTER TABLE public.rdo_producao
ADD COLUMN IF NOT EXISTS is_retrabalho boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rdo_producao.is_retrabalho IS
'Indica se o trecho de produção foi lançado como retrabalho (true/false).';

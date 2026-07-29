-- Permite registrar explicitamente quando o dia não teve nota fiscal e/ou produção
ALTER TABLE public.rdo_diarios
  ADD COLUMN IF NOT EXISTS sem_nota boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sem_producao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rdo_diarios.sem_nota IS
  'Quando true, indica que o RDO foi enviado sem notas fiscais no dia.';

COMMENT ON COLUMN public.rdo_diarios.sem_producao IS
  'Quando true, indica que o RDO foi enviado sem produção no dia.';
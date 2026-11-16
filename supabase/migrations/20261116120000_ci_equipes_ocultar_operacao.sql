-- Oculta equipes/setores administrativos das operações (RDO, Diário de Equipamentos, relatórios de equipe).
-- Aditiva e não destrutiva: default false não altera nada até marcar em Admin > Equipes.
ALTER TABLE public.ci_equipes
  ADD COLUMN IF NOT EXISTS ocultar_operacao boolean NOT NULL DEFAULT false;

-- Marca as equipes administrativas indicadas (apenas UPDATE de flag; sem excluir dados).
UPDATE public.ci_equipes
   SET ocultar_operacao = true
 WHERE upper(btrim(nome)) IN (
   'ADMINISTRATIVO','COMERCIAL','CONTABILIDADE','DEPARTAMENTO DE TI','FACILITIES','FINANCEIRO',
   'GESTÃO DE PESSOAS','JURÍDICO','MANUTENÇÃO / FROTA','MASSA FRIA','SEGURANÇA DO TRABALHO','SUPRIMENTOS'
 );

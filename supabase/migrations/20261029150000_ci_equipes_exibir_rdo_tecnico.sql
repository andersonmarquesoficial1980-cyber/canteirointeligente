-- Permite escolher quais equipes/setores aparecem no campo "Equipe / Setor" do RDO Técnico.
-- Aditiva e não destrutiva: default true mantém tudo visível até o admin desmarcar.
ALTER TABLE public.ci_equipes
  ADD COLUMN IF NOT EXISTS exibir_rdo_tecnico boolean NOT NULL DEFAULT true;

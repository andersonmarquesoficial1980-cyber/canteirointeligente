-- Fase 1 (não destrutiva): adicionar referências estáveis por employee.id
-- Escopo: ci_equipes, employees, rdo_diarios, ci_programacoes, sst_inspections
-- Observação: sem UPDATE/INSERT/DELETE de dados de negócio nesta migration.

begin;

-- =====================================================
-- 1) Novas colunas
-- =====================================================

alter table public.ci_equipes
  add column if not exists responsavel_employee_id uuid;

alter table public.employees
  add column if not exists responsavel_employee_id uuid;

alter table public.rdo_diarios
  add column if not exists encarregado_employee_id uuid,
  add column if not exists responsavel_employee_id uuid,
  add column if not exists engenheiro_responsavel_employee_id uuid;

alter table public.ci_programacoes
  add column if not exists responsavel_employee_id uuid,
  add column if not exists engenheiro_responsavel_employee_id uuid;

alter table public.sst_inspections
  add column if not exists encarregado_employee_id uuid,
  add column if not exists engenheiro_employee_id uuid,
  add column if not exists tecnico_responsavel_employee_id uuid,
  add column if not exists administrativo_employee_id uuid;

-- =====================================================
-- 2) Foreign keys (NOT VALID para rollout seguro)
-- =====================================================

-- ci_equipes.responsavel_employee_id -> employees.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ci_equipes_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.ci_equipes
      ADD CONSTRAINT ci_equipes_responsavel_employee_id_fkey
      FOREIGN KEY (responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;
END $$;

-- employees.responsavel_employee_id -> employees.id (self reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_responsavel_employee_id_fkey
      FOREIGN KEY (responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;
END $$;

-- rdo_diarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rdo_diarios_encarregado_employee_id_fkey'
  ) THEN
    ALTER TABLE public.rdo_diarios
      ADD CONSTRAINT rdo_diarios_encarregado_employee_id_fkey
      FOREIGN KEY (encarregado_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rdo_diarios_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.rdo_diarios
      ADD CONSTRAINT rdo_diarios_responsavel_employee_id_fkey
      FOREIGN KEY (responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rdo_diarios_engenheiro_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.rdo_diarios
      ADD CONSTRAINT rdo_diarios_engenheiro_responsavel_employee_id_fkey
      FOREIGN KEY (engenheiro_responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;
END $$;

-- ci_programacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ci_programacoes_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.ci_programacoes
      ADD CONSTRAINT ci_programacoes_responsavel_employee_id_fkey
      FOREIGN KEY (responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ci_programacoes_engenheiro_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.ci_programacoes
      ADD CONSTRAINT ci_programacoes_engenheiro_responsavel_employee_id_fkey
      FOREIGN KEY (engenheiro_responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;
END $$;

-- sst_inspections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sst_inspections_encarregado_employee_id_fkey'
  ) THEN
    ALTER TABLE public.sst_inspections
      ADD CONSTRAINT sst_inspections_encarregado_employee_id_fkey
      FOREIGN KEY (encarregado_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sst_inspections_engenheiro_employee_id_fkey'
  ) THEN
    ALTER TABLE public.sst_inspections
      ADD CONSTRAINT sst_inspections_engenheiro_employee_id_fkey
      FOREIGN KEY (engenheiro_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sst_inspections_tecnico_responsavel_employee_id_fkey'
  ) THEN
    ALTER TABLE public.sst_inspections
      ADD CONSTRAINT sst_inspections_tecnico_responsavel_employee_id_fkey
      FOREIGN KEY (tecnico_responsavel_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sst_inspections_administrativo_employee_id_fkey'
  ) THEN
    ALTER TABLE public.sst_inspections
      ADD CONSTRAINT sst_inspections_administrativo_employee_id_fkey
      FOREIGN KEY (administrativo_employee_id)
      REFERENCES public.employees(id)
      NOT VALID;
  END IF;
END $$;

-- =====================================================
-- 3) Índices para filtros/joins por ID
-- =====================================================

create index if not exists idx_ci_equipes_responsavel_employee_id
  on public.ci_equipes(responsavel_employee_id);

create index if not exists idx_employees_responsavel_employee_id
  on public.employees(responsavel_employee_id);

create index if not exists idx_rdo_diarios_encarregado_employee_id
  on public.rdo_diarios(encarregado_employee_id);

create index if not exists idx_rdo_diarios_responsavel_employee_id
  on public.rdo_diarios(responsavel_employee_id);

create index if not exists idx_rdo_diarios_engenheiro_responsavel_employee_id
  on public.rdo_diarios(engenheiro_responsavel_employee_id);

create index if not exists idx_ci_programacoes_responsavel_employee_id
  on public.ci_programacoes(responsavel_employee_id);

create index if not exists idx_ci_programacoes_engenheiro_responsavel_employee_id
  on public.ci_programacoes(engenheiro_responsavel_employee_id);

create index if not exists idx_sst_inspections_encarregado_employee_id
  on public.sst_inspections(encarregado_employee_id);

create index if not exists idx_sst_inspections_engenheiro_employee_id
  on public.sst_inspections(engenheiro_employee_id);

create index if not exists idx_sst_inspections_tecnico_responsavel_employee_id
  on public.sst_inspections(tecnico_responsavel_employee_id);

create index if not exists idx_sst_inspections_administrativo_employee_id
  on public.sst_inspections(administrativo_employee_id);

commit;

-- Próximas fases (fora desta migration):
-- 1) diagnóstico de match por tabela
-- 2) backfill controlado por lotes
-- 3) validação das FKs (VALIDATE CONSTRAINT) após saneamento

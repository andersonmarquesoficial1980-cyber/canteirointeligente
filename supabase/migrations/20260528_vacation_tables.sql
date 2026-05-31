-- ─── Módulo de Férias — Workflux ──────────────────────────────────────────────
-- Criado em: 2026-05-28

-- Períodos aquisitivos de férias (1 por ano por funcionário)
CREATE TABLE IF NOT EXISTS vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  dias_direito INTEGER NOT NULL DEFAULT 30,
  dias_gozados INTEGER NOT NULL DEFAULT 0,
  dias_coletiva INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'parcial', 'gozado', 'vencido')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, periodo_inicio)
);

-- Registros individuais de férias (individual ou coletiva)
CREATE TABLE IF NOT EXISTS vacation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  vacation_period_id UUID REFERENCES vacation_periods(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('individual', 'coletiva')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  dias INTEGER NOT NULL,
  observacao TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vacation_periods_employee ON vacation_periods(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_periods_company ON vacation_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_vacation_records_employee ON vacation_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_records_period ON vacation_records(vacation_period_id);

-- RLS
ALTER TABLE vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacation_periods_all" ON vacation_periods;
DROP POLICY IF EXISTS "vacation_records_all" ON vacation_records;

CREATE POLICY "vacation_periods_all" ON vacation_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "vacation_records_all" ON vacation_records FOR ALL USING (true) WITH CHECK (true);

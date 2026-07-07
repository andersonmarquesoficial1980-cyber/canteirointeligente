-- Tabela de saldo persistente por comboio
-- Mantém o saldo vivo entre turnos (diurno/noturno)

CREATE TABLE IF NOT EXISTS comboio_saldo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid,
  comboio_fleet text NOT NULL,
  saldo_atual numeric DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  UNIQUE(company_id, comboio_fleet)
);

-- RLS permissiva (igual ao padrão Workflux)
ALTER TABLE comboio_saldo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_comboio_saldo" ON comboio_saldo
  FOR ALL USING (true) WITH CHECK (true);

-- Histórico de reposições (para auditoria)
CREATE TABLE IF NOT EXISTS comboio_reposicoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid,
  comboio_fleet text NOT NULL,
  litros numeric NOT NULL,
  data date NOT NULL,
  hora text,
  fornecedor text,
  observacao text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comboio_reposicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_comboio_reposicoes" ON comboio_reposicoes
  FOR ALL USING (true) WITH CHECK (true);

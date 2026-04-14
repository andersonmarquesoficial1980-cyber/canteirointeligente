-- Módulo CI Demandas
-- Rodar no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  solicitante_nome text NOT NULL,
  solicitante_departamento text NOT NULL,
  funcionario_id uuid,
  funcionario_nome text,
  equipamento text,
  centro_de_custo text NOT NULL,
  data_prevista date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'em_execucao', 'concluida', 'cancelada')),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_demandas" ON demandas
  FOR ALL USING (auth.role() = 'authenticated');

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Só aceita chamadas autorizadas
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No auth' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const sqls = [
    `CREATE TABLE IF NOT EXISTS sst_funcionario_documentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid,
      funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
      tipo_documento text NOT NULL,
      arquivo_url text,
      arquivo_nome text,
      validade date,
      observacao text,
      created_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS sst_obras_integracao (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid,
      nome_obra text NOT NULL,
      concessionaria text,
      local text,
      data_inicio date,
      data_fim date,
      status text DEFAULT 'ativa',
      documentos_exigidos text[] DEFAULT '{}',
      validade_meses integer DEFAULT 12,
      tem_credenciamento boolean DEFAULT false,
      observacoes text,
      created_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS sst_funcionarios_integracao (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid,
      obra_id uuid NOT NULL REFERENCES sst_obras_integracao(id) ON DELETE CASCADE,
      funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
      status_integracao text DEFAULT 'pendente',
      data_integracao date,
      data_vencimento date,
      status_credenciamento text,
      data_credenciamento date,
      vencimento_credenciamento date,
      documentos_pendentes text[] DEFAULT '{}',
      documentos_extras text[] DEFAULT '{}',
      observacoes text,
      created_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(obra_id, funcionario_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sst_func_docs_funcionario ON sst_funcionario_documentos(funcionario_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sst_obras_company ON sst_obras_integracao(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sst_func_integ_obra ON sst_funcionarios_integracao(obra_id)`,
    `ALTER TABLE sst_funcionario_documentos ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE sst_obras_integracao ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE sst_funcionarios_integracao ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN CREATE POLICY "sel_sst_func_docs" ON sst_funcionario_documentos FOR SELECT USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "ins_sst_func_docs" ON sst_funcionario_documentos FOR INSERT WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "upd_sst_func_docs" ON sst_funcionario_documentos FOR UPDATE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "del_sst_func_docs" ON sst_funcionario_documentos FOR DELETE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "sel_sst_obras" ON sst_obras_integracao FOR SELECT USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "ins_sst_obras" ON sst_obras_integracao FOR INSERT WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "upd_sst_obras" ON sst_obras_integracao FOR UPDATE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "del_sst_obras" ON sst_obras_integracao FOR DELETE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "sel_sst_fi" ON sst_funcionarios_integracao FOR SELECT USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "ins_sst_fi" ON sst_funcionarios_integracao FOR INSERT WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "upd_sst_fi" ON sst_funcionarios_integracao FOR UPDATE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE POLICY "del_sst_fi" ON sst_funcionarios_integracao FOR DELETE USING (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ]

  const results = []
  for (const sql of sqls) {
    try {
      const { error } = await supabase.rpc('exec_sql_admin', { query: sql }).single()
      if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
        results.push({ sql: sql.slice(0, 60), error: error.message })
      } else {
        results.push({ sql: sql.slice(0, 60), ok: true })
      }
    } catch(e) {
      results.push({ sql: sql.slice(0, 60), error: String(e) })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

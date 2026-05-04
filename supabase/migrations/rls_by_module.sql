-- Helper function para verificar módulo
CREATE OR REPLACE FUNCTION has_module(module_name text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND (
      role = 'superadmin'
      OR (module_name = 'obras' AND modulo_obras = true)
      OR (module_name = 'equipamentos' AND modulo_equipamentos = true)
      OR (module_name = 'admin' AND perfil = 'Administrador')
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS para equipment_diary_entries
ALTER TABLE equipment_diary_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modulo_equipamentos_only" ON equipment_diary_entries;
CREATE POLICY "modulo_equipamentos_only" ON equipment_diary_entries
  FOR ALL USING (has_module('equipamentos'));

-- RLS para demandas (isolamento por empresa)
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_isolation_demandas" ON demandas;
CREATE POLICY "company_isolation_demandas" ON demandas
  FOR ALL USING (
    company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    OR (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1) = 'superadmin'
  );

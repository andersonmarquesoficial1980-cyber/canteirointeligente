-- ATENÇÃO: aplicar esta migration via Supabase CLI (ex.: supabase db push). Não aplicar via curl.

-- Tabela de destinatários específicos por usuário-origem
-- "quando usuario_origem lança, notificar usuario_destino"
CREATE TABLE IF NOT EXISTS notification_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- "rdo", "diario_equipamento", "diario_carreta"
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_user_id, target_user_id, event_type)
);

ALTER TABLE notification_targets ENABLE ROW LEVEL SECURITY;

-- Admin e superadmin gerenciam
CREATE POLICY "admin_manage_targets" ON notification_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.role = 'superadmin' OR p.perfil = 'Administrador')
    )
  );

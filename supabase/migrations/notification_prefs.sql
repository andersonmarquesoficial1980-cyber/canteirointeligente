-- Tabela para preferências de notificação por usuário
CREATE TABLE IF NOT EXISTS notification_prefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  -- Tipos de evento que o usuário quer receber push notification
  notify_rdo boolean DEFAULT false,           -- quando apontador envia RDO
  notify_diario_equipamento boolean DEFAULT false, -- quando operador envia diário de equipamento
  notify_diario_carreta boolean DEFAULT false, -- quando motorista envia diário de carreta
  notify_demanda boolean DEFAULT true,         -- quando recebe demanda delegada (já existe, manter)
  -- Configuração extra: se true, recebe notif mesmo sem ser destinatário direto
  notify_todos_carretas boolean DEFAULT false, -- Motoristas de carreta recebem notif de todos os outros motoristas
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_prefs" ON notification_prefs
  FOR ALL USING (auth.uid() = user_id);

-- Admins e superadmin veem tudo da empresa
CREATE POLICY "admin_company_prefs" ON notification_prefs
  FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT perfil FROM profiles WHERE user_id = auth.uid() LIMIT 1) IN ('Administrador', 'superadmin')
  );

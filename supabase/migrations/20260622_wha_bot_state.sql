-- Estado do bot por conversa
ALTER TABLE wha_conversations
  ADD COLUMN IF NOT EXISTS bot_state text DEFAULT 'menu_principal',
  ADD COLUMN IF NOT EXISTS bot_active boolean DEFAULT true;

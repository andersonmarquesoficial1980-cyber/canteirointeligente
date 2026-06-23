-- Migration: Checklist report + granular report permissions
-- 2026-06-23

-- 1. Adicionar submitted_at na tabela equipment_diaries
--    Indica quando o checklist foi enviado formalmente
ALTER TABLE public.equipment_diaries
  ADD COLUMN IF NOT EXISTS checklist_submitted_at timestamptz DEFAULT NULL;

-- 2. Adicionar relatorios_permitidos em user_permissions
--    Array de IDs de tipos de relatório que o usuário pode acessar
--    Null = acesso a todos (admin), array vazio = nenhum, array preenchido = somente os listados
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS relatorios_permitidos text[] DEFAULT NULL;

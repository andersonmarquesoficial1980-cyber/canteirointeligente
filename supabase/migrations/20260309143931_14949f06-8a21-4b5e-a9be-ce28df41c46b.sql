
-- Fix Anderson's profile to Administrador
UPDATE profiles SET perfil = 'Administrador' WHERE email = 'anderson@fremix.com.br';

-- Remove duplicate apontador role, keep only admin
DELETE FROM user_roles WHERE user_id = '06e738e0-9e1d-4792-8bcb-0c5cacd8edbf' AND role = 'apontador';

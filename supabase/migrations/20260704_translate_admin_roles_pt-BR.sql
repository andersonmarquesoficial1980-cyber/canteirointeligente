-- =====================================================
-- TRANSLATION: admin_roles descriptions to Portuguese (pt-BR)
-- Date: 2026-07-04
-- Purpose: Translate admin role descriptions from English to Portuguese
-- =====================================================

-- Super_Admin role
UPDATE public.admin_roles 
SET description = 'Acesso total a todos os recursos e funções de administração'
WHERE name = 'Super_Admin' AND description = 'Full access to all resources and admin functions';

-- RDO_Admin role
UPDATE public.admin_roles 
SET description = 'Pode gerenciar apenas o setor RDO (Diários de Obra)'
WHERE name = 'RDO_Admin' AND description = 'Can manage RDO (Diários de Obra) sector only';

-- Equipment_Admin role
UPDATE public.admin_roles 
SET description = 'Pode gerenciar apenas o setor de Equipamentos'
WHERE name = 'Equipment_Admin' AND description = 'Can manage Equipment sector only';

-- Fuel_Admin role (Abastecimento)
UPDATE public.admin_roles 
SET description = 'Pode gerenciar apenas o setor de Abastecimento (Combustível)'
WHERE name = 'Fuel_Admin' AND description = 'Can manage Abastecimento (Fuel) sector only';

-- Maintenance_Admin role
UPDATE public.admin_roles 
SET description = 'Pode gerenciar apenas o setor de Manutenção'
WHERE name = 'Maintenance_Admin' AND description = 'Can manage Maintenance sector only';

-- HR_Admin role
UPDATE public.admin_roles 
SET description = 'Pode gerenciar apenas o setor de RH'
WHERE name = 'HR_Admin' AND description = 'Can manage HR sector only';

-- =====================================================
-- VERIFICATION: Check the updated records
-- =====================================================
-- Run this query to verify the translations were applied:
-- SELECT id, name, description FROM public.admin_roles ORDER BY created_at;

-- Add EGL and RACHÃO production columns to rdo_engenheiro table
-- Supports new application types: APLICAÇÃO DE EGL, APLICAÇÃO DE RACHÃO

ALTER TABLE rdo_engenheiro
ADD COLUMN egl_ton NUMERIC(10, 2) NULL,
ADD COLUMN rachao_ton NUMERIC(10, 2) NULL;

-- Add comment for documentation
COMMENT ON COLUMN rdo_engenheiro.egl_ton IS 'Production in tons for application type: Aplicação de EGL';
COMMENT ON COLUMN rdo_engenheiro.rachao_ton IS 'Production in tons for application type: Aplicação de Rachão';

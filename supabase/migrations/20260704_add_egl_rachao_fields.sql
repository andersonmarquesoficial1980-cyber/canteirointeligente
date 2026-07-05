-- Migration: Add EGL e RACHÃO fields to rdo_engenheiro table
-- Created: 2026-07-04
-- Purpose: Add missing production quantity fields for EGL and RACHÃO applications

-- Add new columns to rdo_engenheiro table
ALTER TABLE rdo_engenheiro
ADD COLUMN IF NOT EXISTS egl_ton numeric,
ADD COLUMN IF NOT EXISTS rachao_ton numeric;

-- Add comments to explain the new columns
COMMENT ON COLUMN rdo_engenheiro.egl_ton IS 'Quantidade de EGL aplicada em toneladas';
COMMENT ON COLUMN rdo_engenheiro.rachao_ton IS 'Quantidade de RACHÃO aplicada em toneladas';

-- Migration: Create inspections table
-- Description: Creates the 'inspections' table with 9 fields to match remote
-- Author: Property Management System
-- Date: 2025-08-26

CREATE TABLE public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id),
    type inspection_type_enum NOT NULL,
    property CHARACTER VARYING NOT NULL,
    unit CHARACTER VARYING NOT NULL,
    inspection_date DATE NOT NULL,
    status inspection_status_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspections_updated_at ON public.inspections;
CREATE TRIGGER trg_inspections_updated_at
BEFORE UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inspections_unit_id ON public.inspections(unit_id);
CREATE INDEX IF NOT EXISTS idx_inspections_type ON public.inspections(type);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON public.inspections(inspection_date);

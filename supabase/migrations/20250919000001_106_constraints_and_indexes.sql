-- Migration: Add missing constraints and performance indexes
-- Description: Adds various constraints and indexes for data integrity and performance
-- Date: 2025-09-19
-- Add missing foreign key constraints
DO $$ BEGIN -- Add foreign key constraints if they don't exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_lease_property_id'
        AND table_name = 'lease'
) THEN
ALTER TABLE public.lease
ADD CONSTRAINT fk_lease_property_id FOREIGN KEY (property_id) REFERENCES public.properties(id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_lease_unit_id'
        AND table_name = 'lease'
) THEN
ALTER TABLE public.lease
ADD CONSTRAINT fk_lease_unit_id FOREIGN KEY (unit_id) REFERENCES public.units(id);
END IF;
END $$;
-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_lease_property_id ON public.lease(property_id);
CREATE INDEX IF NOT EXISTS idx_lease_unit_id ON public.lease(unit_id);
CREATE INDEX IF NOT EXISTS idx_lease_status ON public.lease(status);
CREATE INDEX IF NOT EXISTS idx_lease_dates ON public.lease(lease_from_date, lease_to_date);
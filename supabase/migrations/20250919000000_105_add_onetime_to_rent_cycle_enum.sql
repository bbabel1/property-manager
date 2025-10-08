-- Migration: Add OneTime to rent_cycle_enum for one-off templates
-- Description: Adds 'OneTime' value to rent_cycle_enum to support one-off lease templates
-- Date: 2025-09-19
-- Add OneTime to rent_cycle_enum for one-off templates
DO $$ BEGIN ALTER TYPE public.rent_cycle_enum
ADD VALUE IF NOT EXISTS 'OneTime';
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
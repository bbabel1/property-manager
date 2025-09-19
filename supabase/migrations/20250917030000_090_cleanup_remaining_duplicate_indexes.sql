-- Cleanup remaining duplicate indexes that are constraints
-- This migration removes duplicate unique constraints on lease and units tables

-- lease: Remove duplicate unique constraints
-- We have both Lease_buildium_lease_id_key and buildium_lease_id_unique and lease_buildium_lease_id_unique
-- Keep buildium_lease_id_unique as it's the most descriptive name
ALTER TABLE public.lease DROP CONSTRAINT IF EXISTS "Lease_buildium_lease_id_key";
ALTER TABLE public.lease DROP CONSTRAINT IF EXISTS lease_buildium_lease_id_unique;

-- units: Remove duplicate unique constraints  
-- We have both units_buildium_unit_id_key and units_buildium_unit_id_unique
-- Keep units_buildium_unit_id_unique as it's the most descriptive name
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_buildium_unit_id_key;

-- Add comment for tracking
COMMENT ON SCHEMA public IS 'Remaining duplicate indexes cleaned up - all unique constraints optimized';

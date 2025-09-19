-- Drop legacy rental_sub_type from properties
-- Assumes application now uses property_type (enum) as canonical field

BEGIN;

-- Drop dependent index if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_properties_rental_sub_type'
  ) THEN
    EXECUTE 'DROP INDEX public.idx_properties_rental_sub_type';
  END IF;
END $$;

-- Drop the column if present
ALTER TABLE public.properties DROP COLUMN IF EXISTS rental_sub_type;

COMMIT;


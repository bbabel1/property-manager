-- Migration: Remove vacant_units_count artifacts
-- Drops trigger, functions, index, constraints, and column tied to vacant_units_count

BEGIN;

-- Drop trigger on units if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trigger_update_property_vacant_units_count'
      AND c.relname = 'units'
  ) THEN
    EXECUTE 'DROP TRIGGER "trigger_update_property_vacant_units_count" ON public.units';
  END IF;
END $$;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS public.update_property_vacant_units_count();
DROP FUNCTION IF EXISTS public.populate_all_property_vacant_units_count();

-- Drop index if it exists
DROP INDEX IF EXISTS public.idx_properties_vacant_units_count;

-- Drop constraints if they exist
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS check_vacant_units_count_non_negative,
  DROP CONSTRAINT IF EXISTS check_vacant_units_count_not_exceed_total;

-- Drop the column if it exists
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS vacant_units_count;

COMMIT;


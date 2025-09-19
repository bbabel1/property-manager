-- Migration: Remove vacant_units_count and ensure occupancy_rate
-- Purpose:
--  - Drop legacy vacant_units_count column and its related trigger/function/index/constraints
--  - Ensure properties.occupancy_rate exists as a generated percentage:
--      (total_active_units - total_vacant_units) / total_active_units * 100
--    with safe handling for division by zero.

BEGIN;

-- Drop trigger that maintained vacant_units_count (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trigger_update_property_vacant_units_count'
      AND c.relname = 'units'
  ) THEN
    EXECUTE 'DROP TRIGGER "trigger_update_property_vacant_units_count" ON public.units';
  END IF;
END $$;

-- Drop function used by that trigger (if present)
DROP FUNCTION IF EXISTS public.update_property_vacant_units_count() CASCADE;

-- Drop index on properties.vacant_units_count (if present)
DROP INDEX IF EXISTS public.idx_properties_vacant_units_count;

-- Drop any constraints referencing vacant_units_count (if present)
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS check_vacant_units_count_non_negative,
  DROP CONSTRAINT IF EXISTS check_vacant_units_count_not_exceed_total;

-- Finally, drop the column if it exists
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS vacant_units_count;

-- Ensure occupancy_rate exists with the requested formula as a percentage (0–100)
-- If the column already exists, this will be a no-op.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS occupancy_rate DECIMAL(5,2)
  GENERATED ALWAYS AS (
    CASE
      WHEN total_active_units > 0 THEN
        ROUND(((total_active_units - total_vacant_units)::numeric / total_active_units::numeric) * 100, 2)
      ELSE 0
    END
  ) STORED;

COMMENT ON COLUMN public.properties.occupancy_rate IS 'Calculated occupancy rate as percentage: (total_active_units - total_vacant_units) / total_active_units * 100';

COMMIT;


-- Replace dwelling_unit_count with residential_units in buildings table
-- This consolidates residential unit information into a single field instead of
-- storing it in multiple places (dwelling_unit_count, pluto->Residential_Units, pluto->unitsres)

-- 1) Add new residential_units column
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS residential_units integer;

-- 2) Migrate data from dwelling_unit_count to residential_units
-- Also extract from pluto JSONB if dwelling_unit_count is null
UPDATE public.buildings
SET residential_units = COALESCE(
  dwelling_unit_count,
  CASE
    WHEN pluto IS NOT NULL THEN
      COALESCE(
        (pluto->>'Residential_Units')::integer,
        (pluto->>'unitsres')::integer,
        (pluto->>'residential_units')::integer
      )
    ELSE NULL
  END
)
WHERE residential_units IS NULL;

-- 3) Drop the old dwelling_unit_count column
ALTER TABLE public.buildings
  DROP COLUMN IF EXISTS dwelling_unit_count;

-- 4) Add comment for documentation
COMMENT ON COLUMN public.buildings.residential_units IS 'Total number of residential units in the building. This is the canonical field for residential unit count, replacing dwelling_unit_count and pluto JSONB fields.';







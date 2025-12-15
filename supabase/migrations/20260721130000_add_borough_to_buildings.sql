-- Add borough text column to buildings table
-- This stores the borough name (e.g., "Manhattan") instead of just the code

-- 1) Add borough column
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS borough text;

-- 2) Populate borough from existing borough_code values
UPDATE public.buildings
SET borough = CASE
  WHEN borough_code = '1' THEN 'Manhattan'
  WHEN borough_code = '2' THEN 'Bronx'
  WHEN borough_code = '3' THEN 'Brooklyn'
  WHEN borough_code = '4' THEN 'Queens'
  WHEN borough_code = '5' THEN 'Staten Island'
  ELSE NULL
END
WHERE borough IS NULL AND borough_code IS NOT NULL;

-- 3) Add comment for documentation
COMMENT ON COLUMN public.buildings.borough IS 'Borough name (e.g., "Manhattan", "Brooklyn"). Populated from borough_code when available.';



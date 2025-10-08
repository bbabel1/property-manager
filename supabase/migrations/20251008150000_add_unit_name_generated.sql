-- Add unit_name as a generated column combining address_line1 and unit_number
-- Example output: "99 John Street - 5A"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'units'
      AND column_name = 'unit_name'
  ) THEN
    ALTER TABLE public.units
      ADD COLUMN unit_name text
      GENERATED ALWAYS AS (
        CASE
          WHEN address_line1 IS NULL OR address_line1 = '' THEN unit_number
          ELSE address_line1 || ' - ' || unit_number
        END
      ) STORED;
  END IF;
END $$;


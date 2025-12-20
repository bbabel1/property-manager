-- Require service assignment level for all properties.
-- No default is set; callers must explicitly provide the value.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'service_assignment'
  ) THEN
    RAISE EXCEPTION 'public.properties.service_assignment column is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.properties
    WHERE service_assignment IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL: existing properties have NULL service_assignment';
  END IF;

  EXECUTE 'ALTER TABLE public.properties ALTER COLUMN service_assignment SET NOT NULL';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';


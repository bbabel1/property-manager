-- Ensure the property_type_enum includes the "Rental Building" value.
-- This migration is idempotent so it can run safely on environments where the value already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'property_type_enum'
      AND e.enumlabel = 'Rental Building'
  ) THEN
    ALTER TYPE public.property_type_enum ADD VALUE 'Rental Building';
  END IF;
END
$$;

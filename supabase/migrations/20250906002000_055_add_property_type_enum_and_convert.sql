-- Create property_type_enum and convert properties.property_type to use it
-- Requirements provided by user:
-- - Enum name: public.property_type_enum
-- - Values: 'Condo', 'Co-op', 'Condop', 'Rental Building', 'Townhouse', 'Mult-Family'
-- - Column remains nullable (NULL means None)
-- - Skip backfill/normalization beyond safe conversion (only copy exact matches)

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'property_type_enum'
  ) THEN
    CREATE TYPE public.property_type_enum AS ENUM (
      'Condo',
      'Co-op',
      'Condop',
      'Rental Building',
      'Townhouse',
      'Mult-Family'
    );
  END IF;
END $$;

-- Add temp enum column
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_type_new public.property_type_enum NULL;

-- Copy values only when they exactly match one of the enum values; otherwise leave NULL
UPDATE public.properties p
SET property_type_new = p.property_type::public.property_type_enum
WHERE p.property_type IN ('Condo','Co-op','Condop','Rental Building','Townhouse','Mult-Family');

-- Drop dependent index if it exists (it will be dropped automatically with column, but ensure idempotence)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_properties_type'
  ) THEN
    EXECUTE 'DROP INDEX public.idx_properties_type';
  END IF;
END $$;

-- Swap columns
ALTER TABLE public.properties DROP COLUMN IF EXISTS property_type;
ALTER TABLE public.properties RENAME COLUMN property_type_new TO property_type;

-- Recreate index on new enum column
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties(property_type);

COMMENT ON COLUMN public.properties.property_type IS 'UI property type (enum). NULL represents None.';

COMMIT;


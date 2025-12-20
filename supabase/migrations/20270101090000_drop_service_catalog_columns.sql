-- Drop unused service catalog fields: code, applies_to, bill_on
-- Removes bill_on from plan defaults and property pricing as well as related enums

BEGIN;

-- Drop dependent columns first
ALTER TABLE IF EXISTS public.service_plan_default_pricing
  DROP COLUMN IF EXISTS bill_on;

ALTER TABLE IF EXISTS public.property_service_pricing
  DROP COLUMN IF EXISTS bill_on;

-- Drop indexes tied to removed columns
DROP INDEX IF EXISTS public.idx_service_offerings_code;

-- Drop columns from service_offerings
ALTER TABLE IF EXISTS public.service_offerings
  DROP COLUMN IF EXISTS bill_on,
  DROP COLUMN IF EXISTS applies_to,
  DROP COLUMN IF EXISTS code;

-- Drop enums now unused
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_on_enum') THEN
    DROP TYPE bill_on_enum;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'applies_to_enum') THEN
    DROP TYPE applies_to_enum;
  END IF;
END $$;

COMMIT;

-- Add 'Custom' to service_plan_enum
-- Part of Phase 1.1: Service Catalog Expansion

BEGIN;

-- Add 'Custom' value to service_plan_enum
DO $$ 
BEGIN
  -- Check if 'Custom' already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'Custom' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'service_plan_enum')
  ) THEN
    ALTER TYPE service_plan_enum ADD VALUE 'Custom';
  END IF;
END $$;

COMMENT ON TYPE service_plan_enum IS 'Service plan options for a property (Full, Basic, A-la-carte, Custom).';

COMMIT;


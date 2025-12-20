-- Drop legacy management/service/fee columns and enums now superseded by Service Plans v2

BEGIN;

-- Remove legacy columns from properties
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS management_scope,
  DROP COLUMN IF EXISTS service_assignment,
  DROP COLUMN IF EXISTS service_plan,
  DROP COLUMN IF EXISTS active_services,
  DROP COLUMN IF EXISTS fee_assignment,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS fee_percentage,
  DROP COLUMN IF EXISTS fee_dollar_amount,
  DROP COLUMN IF EXISTS billing_frequency,
  DROP COLUMN IF EXISTS bill_pay_list,
  DROP COLUMN IF EXISTS bill_pay_notes;

-- Remove legacy columns from units
ALTER TABLE public.units
  DROP COLUMN IF EXISTS service_plan,
  DROP COLUMN IF EXISTS active_services,
  DROP COLUMN IF EXISTS fee_assignment,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS fee_percentage,
  DROP COLUMN IF EXISTS fee_dollar_amount,
  DROP COLUMN IF EXISTS billing_frequency,
  DROP COLUMN IF EXISTS bill_pay_list,
  DROP COLUMN IF EXISTS bill_pay_notes;

-- Drop legacy enums no longer used
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'management_services_enum'
  ) THEN
    DROP TYPE IF EXISTS management_services_enum;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'assignment_level_enum'
  ) THEN
    DROP TYPE IF EXISTS assignment_level_enum;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'assignment_level'
  ) THEN
    DROP TYPE IF EXISTS assignment_level;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'service_plan_enum'
  ) THEN
    DROP TYPE IF EXISTS service_plan_enum;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'fee_type_enum'
  ) THEN
    DROP TYPE IF EXISTS fee_type_enum;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typname = 'billing_frequency_enum'
  ) THEN
    DROP TYPE IF EXISTS billing_frequency_enum;
  END IF;
END $$;

COMMIT;

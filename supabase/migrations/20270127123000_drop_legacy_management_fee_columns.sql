-- Drop legacy management fee/service columns now superseded by Service Plans v2 assignments.
-- Keep: properties.management_scope, properties.service_assignment, bill_pay_* fields, and service_plan_enum
-- (service_plan_enum is still referenced by transactions/billing_events plan_id).

BEGIN;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS service_plan,
  DROP COLUMN IF EXISTS active_services,
  DROP COLUMN IF EXISTS fee_assignment,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS fee_percentage,
  DROP COLUMN IF EXISTS fee_dollar_amount,
  DROP COLUMN IF EXISTS billing_frequency;

ALTER TABLE public.units
  DROP COLUMN IF EXISTS service_plan,
  DROP COLUMN IF EXISTS active_services,
  DROP COLUMN IF EXISTS fee_assignment,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS fee_percentage,
  DROP COLUMN IF EXISTS fee_percent,
  DROP COLUMN IF EXISTS fee_dollar_amount,
  DROP COLUMN IF EXISTS fee_frequency,
  DROP COLUMN IF EXISTS fee_notes,
  DROP COLUMN IF EXISTS billing_frequency;

-- Drop enum only used by the removed active_services columns (best-effort).
DO $$
BEGIN
  BEGIN
    DROP TYPE IF EXISTS public.management_services_enum;
  EXCEPTION
    WHEN dependent_objects_still_exist THEN
      -- Leave the type in place if any remaining objects still depend on it.
      NULL;
  END;
END $$;

COMMIT;


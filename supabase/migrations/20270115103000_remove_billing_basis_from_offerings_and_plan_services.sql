-- Remove billing basis/rent basis fields from service offerings and plan services.
-- Auto-posting is handled only via service plans; these columns are no longer needed.
BEGIN;

-- service_plan_services cleanup
ALTER TABLE public.service_plan_services
  DROP COLUMN IF EXISTS billing_basis,
  DROP COLUMN IF EXISTS rent_basis;

-- service_offerings cleanup
DROP INDEX IF EXISTS idx_service_offerings_billing_basis;

ALTER TABLE public.service_offerings
  DROP CONSTRAINT IF EXISTS check_percent_rent_has_rate,
  DROP CONSTRAINT IF EXISTS check_job_cost_has_markup,
  DROP CONSTRAINT IF EXISTS check_hourly_has_rate;

ALTER TABLE public.service_offerings
  DROP COLUMN IF EXISTS billing_basis,
  DROP COLUMN IF EXISTS default_rent_basis;

COMMIT;

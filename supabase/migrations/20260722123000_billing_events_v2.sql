-- Billing events v2: idempotency keys, charge types, applied periods.

BEGIN;

-- Add new columns
ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS charge_type text CHECK (charge_type IN ('plan_fee', 'service_fee', 'per_occurrence')),
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.service_plan_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_period_start date,
  ADD COLUMN IF NOT EXISTS service_period_end date;

-- Backfill service_period_* from period_* when null
UPDATE public.billing_events
SET service_period_start = period_start,
    service_period_end = period_end
WHERE service_period_start IS NULL OR service_period_end IS NULL;

-- Create unique key for idempotency (scoped by org)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_events_unique_period_assignment'
  ) THEN
    ALTER TABLE public.billing_events
      ADD CONSTRAINT billing_events_unique_period_assignment UNIQUE (
        org_id,
        unit_id,
        offering_id,
        assignment_id,
        charge_type,
        service_period_start,
        service_period_end
      );
  END IF;
END $$;

COMMENT ON COLUMN public.billing_events.charge_type IS 'plan_fee | service_fee | per_occurrence';
COMMENT ON COLUMN public.billing_events.assignment_id IS 'Foreign key to service_plan_assignments';
COMMENT ON COLUMN public.billing_events.service_period_start IS 'Start of service period for idempotency';
COMMENT ON COLUMN public.billing_events.service_period_end IS 'End of service period for idempotency';

COMMIT;

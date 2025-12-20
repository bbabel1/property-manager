-- Restore legacy management/service/fee columns on properties and units that recent schema changes removed.
-- These fields are still required by the app (monthly logs, management fee tooling, services UI).

BEGIN;

-- Ensure enums exist (idempotent guards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_level_enum') THEN
    CREATE TYPE public.assignment_level_enum AS ENUM ('Building', 'Unit');
    COMMENT ON TYPE public.assignment_level_enum IS 'Assignment level (Building or Unit) for management scope.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_level') THEN
    CREATE TYPE public.assignment_level AS ENUM ('Property Level', 'Unit Level');
    COMMENT ON TYPE public.assignment_level IS 'Assignment level for services/fees (Property Level or Unit Level).';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_plan_enum') THEN
    CREATE TYPE public.service_plan_enum AS ENUM ('Full', 'Basic', 'A-la-carte', 'Custom');
    COMMENT ON TYPE public.service_plan_enum IS 'Service plan options for management.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'management_services_enum') THEN
    CREATE TYPE public.management_services_enum AS ENUM (
      'Rent Collection',
      'Maintenance',
      'Turnovers',
      'Compliance',
      'Bill Pay',
      'Condition Reports',
      'Renewals'
    );
    COMMENT ON TYPE public.management_services_enum IS 'Menu of management services included for a property or unit.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_type_enum') THEN
    CREATE TYPE public.fee_type_enum AS ENUM ('Percentage', 'Flat Rate');
    COMMENT ON TYPE public.fee_type_enum IS 'Fee type for management fees (Percentage or Flat Rate).';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_frequency_enum') THEN
    CREATE TYPE public.billing_frequency_enum AS ENUM ('Annual', 'Monthly');
    COMMENT ON TYPE public.billing_frequency_enum IS 'Billing frequency for management fees.';
  END IF;
END $$;

-- Properties: add back management/service/fee fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS management_scope public.assignment_level_enum NULL,
  ADD COLUMN IF NOT EXISTS service_assignment public.assignment_level NULL,
  ADD COLUMN IF NOT EXISTS service_plan public.service_plan_enum NULL,
  ADD COLUMN IF NOT EXISTS active_services public.management_services_enum[] NULL,
  ADD COLUMN IF NOT EXISTS fee_assignment public.assignment_level NULL,
  ADD COLUMN IF NOT EXISTS fee_type public.fee_type_enum NULL,
  ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) NULL CHECK (fee_percentage IS NULL OR (fee_percentage >= 0 AND fee_percentage <= 100)),
  ADD COLUMN IF NOT EXISTS fee_dollar_amount numeric(12,2) NULL CHECK (fee_dollar_amount IS NULL OR fee_dollar_amount >= 0),
  ADD COLUMN IF NOT EXISTS billing_frequency public.billing_frequency_enum NULL,
  ADD COLUMN IF NOT EXISTS bill_pay_list text NULL,
  ADD COLUMN IF NOT EXISTS bill_pay_notes text NULL;

COMMENT ON COLUMN public.properties.management_scope IS 'Scope at which management applies (Building or Unit).';
COMMENT ON COLUMN public.properties.service_assignment IS 'Scope at which services are assigned (Property Level or Unit Level).';
COMMENT ON COLUMN public.properties.service_plan IS 'Selected service plan for the property.';
COMMENT ON COLUMN public.properties.active_services IS 'List of included management services.';
COMMENT ON COLUMN public.properties.fee_assignment IS 'Scope at which management fees are assigned (Property or Unit level).';
COMMENT ON COLUMN public.properties.fee_type IS 'Type of management fee (Percentage or Flat Rate).';
COMMENT ON COLUMN public.properties.fee_percentage IS 'Management fee percentage (0-100).';
COMMENT ON COLUMN public.properties.fee_dollar_amount IS 'Management fee dollar amount.';
COMMENT ON COLUMN public.properties.billing_frequency IS 'Billing frequency for management fees.';
COMMENT ON COLUMN public.properties.bill_pay_list IS 'Vendors included in bill-pay list.';
COMMENT ON COLUMN public.properties.bill_pay_notes IS 'Notes for bill-pay setup.';

-- Units: add back management/service/fee fields
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS service_plan public.service_plan_enum NULL,
  ADD COLUMN IF NOT EXISTS active_services public.management_services_enum[] NULL,
  ADD COLUMN IF NOT EXISTS fee_assignment public.assignment_level NULL,
  ADD COLUMN IF NOT EXISTS fee_type public.fee_type_enum NULL,
  ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) NULL CHECK (fee_percentage IS NULL OR (fee_percentage >= 0 AND fee_percentage <= 100)),
  ADD COLUMN IF NOT EXISTS fee_dollar_amount numeric(12,2) NULL CHECK (fee_dollar_amount IS NULL OR fee_dollar_amount >= 0),
  ADD COLUMN IF NOT EXISTS billing_frequency public.billing_frequency_enum NULL,
  ADD COLUMN IF NOT EXISTS bill_pay_list text NULL,
  ADD COLUMN IF NOT EXISTS bill_pay_notes text NULL;

COMMENT ON COLUMN public.units.service_plan IS 'Selected service plan for the unit (overrides property when unit-level).';
COMMENT ON COLUMN public.units.active_services IS 'List of included management services at the unit level.';
COMMENT ON COLUMN public.units.fee_assignment IS 'Scope at which management fees are assigned (Property or Unit level).';
COMMENT ON COLUMN public.units.fee_type IS 'Type of management fee (Percentage or Flat Rate).';
COMMENT ON COLUMN public.units.fee_percentage IS 'Management fee percentage (0-100) at the unit level.';
COMMENT ON COLUMN public.units.fee_dollar_amount IS 'Management fee dollar amount at the unit level.';
COMMENT ON COLUMN public.units.billing_frequency IS 'Billing frequency for management fees at the unit level.';
COMMENT ON COLUMN public.units.bill_pay_list IS 'Vendors included in bill-pay list for the unit.';
COMMENT ON COLUMN public.units.bill_pay_notes IS 'Notes for bill-pay setup at the unit level.';

COMMIT;

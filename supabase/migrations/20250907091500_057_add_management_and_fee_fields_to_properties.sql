-- Add management/service/fee fields to properties
-- Creates required enums and adds columns with idempotent guards

BEGIN;

-- Enum: assignment_level_enum ['Building','Unit']
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'assignment_level_enum'
  ) THEN
    CREATE TYPE public.assignment_level_enum AS ENUM ('Building','Unit');
    COMMENT ON TYPE public.assignment_level_enum IS 'Assignment level (Building or Unit) for management scope, service and fee assignment.';
  END IF;
END $$;

-- Enum: service_plan_enum ['Full','Basic','A-la-carte']
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'service_plan_enum'
  ) THEN
    CREATE TYPE public.service_plan_enum AS ENUM ('Full','Basic','A-la-carte');
    COMMENT ON TYPE public.service_plan_enum IS 'Service plan options for a property (Full, Basic, A-la-carte).';
  END IF;
END $$;

-- Enum: management_services_enum ['Rent Collection','Maintenance','Turnovers','Compliance','Bill Pay','Condition Reports','Renewals']
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'management_services_enum'
  ) THEN
    CREATE TYPE public.management_services_enum AS ENUM (
      'Rent Collection',
      'Maintenance',
      'Turnovers',
      'Compliance',
      'Bill Pay',
      'Condition Reports',
      'Renewals'
    );
    COMMENT ON TYPE public.management_services_enum IS 'Menu of management services included for a property.';
  END IF;
END $$;

-- Enum: fee_type_enum ['Percentage','Flat Rate']
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'fee_type_enum'
  ) THEN
    CREATE TYPE public.fee_type_enum AS ENUM ('Percentage','Flat Rate');
    COMMENT ON TYPE public.fee_type_enum IS 'Fee type for management fees (Percentage or Flat Rate).';
  END IF;
END $$;

-- Enum: billing_frequency_enum ['Annual','Monthly']
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'billing_frequency_enum'
  ) THEN
    CREATE TYPE public.billing_frequency_enum AS ENUM ('Annual','Monthly');
    COMMENT ON TYPE public.billing_frequency_enum IS 'Billing frequency for management fees (Annual or Monthly).';
  END IF;
END $$;

-- Add columns to public.properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS management_scope public.assignment_level_enum NULL,
  ADD COLUMN IF NOT EXISTS service_assignment public.assignment_level_enum NULL,
  ADD COLUMN IF NOT EXISTS service_plan public.service_plan_enum NULL,
  ADD COLUMN IF NOT EXISTS included_services public.management_services_enum[] NULL,
  ADD COLUMN IF NOT EXISTS fee_assignment public.assignment_level_enum NULL,
  ADD COLUMN IF NOT EXISTS fee_type public.fee_type_enum NULL,
  ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  ADD COLUMN IF NOT EXISTS management_fee numeric(12,2) NULL CHECK (management_fee >= 0),
  ADD COLUMN IF NOT EXISTS billing_frequency public.billing_frequency_enum NULL;

-- Comments on columns
COMMENT ON COLUMN public.properties.management_scope IS 'Scope at which management applies (Building or Unit).';
COMMENT ON COLUMN public.properties.service_assignment IS 'Scope at which services are assigned (Building or Unit).';
COMMENT ON COLUMN public.properties.service_plan IS 'Selected service plan for the property.';
COMMENT ON COLUMN public.properties.included_services IS 'List of included management services (enum array).';
COMMENT ON COLUMN public.properties.fee_assignment IS 'Scope at which fees are assigned (Building or Unit).';
COMMENT ON COLUMN public.properties.fee_type IS 'Type of management fee (Percentage or Flat Rate).';
COMMENT ON COLUMN public.properties.fee_percentage IS 'Management fee percentage (0-100).';
COMMENT ON COLUMN public.properties.management_fee IS 'Management fee dollar amount.';
COMMENT ON COLUMN public.properties.billing_frequency IS 'Billing frequency for fees (Annual or Monthly).';

COMMIT;


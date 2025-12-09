-- Expand service offerings catalog
-- Part of Phase 1.2: Service Catalog Expansion
-- Creates enums, service_offerings table, service_plan_offerings mapping table, and seeds data

BEGIN;

-- Ensure btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create enums for type safety
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'billing_basis_enum'
  ) THEN
    CREATE TYPE billing_basis_enum AS ENUM (
      'per_property', 'per_unit', 'percent_rent', 'job_cost', 'hourly', 'one_time'
    );
    COMMENT ON TYPE billing_basis_enum IS 'Billing basis for service offerings (per property, per unit, percentage of rent, job cost, hourly, or one-time).';
  END IF;
END $$;

-- Extend existing billing_frequency_enum to include new values for service offerings
-- Note: We'll add new values but use existing 'Monthly' and 'Annual' where possible
-- PostgreSQL requires committing before using newly added enum values, so we add them here
-- but use 'Monthly' for the legacy fee (existing value)
DO $$ 
BEGIN
  -- Add new enum values if they don't exist (these can't be used in same transaction)
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'monthly' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'annually' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'annually';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'one_time' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'one_time';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'per_event' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'per_event';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'per_job' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'per_job';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'quarterly' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'billing_frequency_enum')) THEN
    ALTER TYPE billing_frequency_enum ADD VALUE IF NOT EXISTS 'quarterly';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'applies_to_enum'
  ) THEN
    CREATE TYPE applies_to_enum AS ENUM (
      'property', 'unit', 'owner', 'building'
    );
    COMMENT ON TYPE applies_to_enum IS 'Scope at which service offering applies (property, unit, owner, or building).';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'bill_on_enum'
  ) THEN
    CREATE TYPE bill_on_enum AS ENUM (
      'calendar_day', 'event', 'job_close', 'lease_event', 'time_log'
    );
    COMMENT ON TYPE bill_on_enum IS 'Trigger for when billing occurs (calendar day, event, job close, lease event, or time log).';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'rent_basis_enum'
  ) THEN
    CREATE TYPE rent_basis_enum AS ENUM (
      'scheduled', 'billed', 'collected'
    );
    COMMENT ON TYPE rent_basis_enum IS 'Basis for percentage-of-rent calculations (scheduled rent, billed rent, or collected rent).';
  END IF;
END $$;

-- Create service_offerings table
CREATE TABLE IF NOT EXISTS service_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  category varchar(50) NOT NULL, -- 'Property Care', 'Financial Management', 'Resident Services', 'Compliance & Legal'
  description text,
  billing_basis billing_basis_enum NOT NULL,
  default_rate numeric(12,2), -- Flat rate or percentage value
  default_freq billing_frequency_enum NOT NULL,
  min_amount numeric(12,2), -- Minimum fee cap
  max_amount numeric(12,2), -- Maximum fee cap
  applies_to applies_to_enum NOT NULL,
  bill_on bill_on_enum NOT NULL,
  markup_pct numeric(5,2), -- For job-cost basis
  markup_pct_cap numeric(5,2), -- Maximum markup percentage
  hourly_rate numeric(12,2), -- For hourly basis
  hourly_min_hours numeric(5,2), -- Minimum billable hours
  default_rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Check constraints for basis-specific fields
  CONSTRAINT check_percent_rent_has_rate CHECK (
    billing_basis != 'percent_rent' OR default_rate IS NOT NULL
  ),
  CONSTRAINT check_job_cost_has_markup CHECK (
    billing_basis != 'job_cost' OR markup_pct IS NOT NULL
  ),
  CONSTRAINT check_hourly_has_rate CHECK (
    billing_basis != 'hourly' OR (hourly_rate IS NOT NULL AND hourly_min_hours IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_service_offerings_category ON service_offerings(category);
CREATE INDEX IF NOT EXISTS idx_service_offerings_billing_basis ON service_offerings(billing_basis);
CREATE INDEX IF NOT EXISTS idx_service_offerings_code ON service_offerings(code);
CREATE INDEX IF NOT EXISTS idx_service_offerings_active ON service_offerings(is_active) WHERE is_active = true;

COMMENT ON TABLE service_offerings IS 'Catalog of all available service offerings with pricing defaults and configuration.';
COMMENT ON COLUMN service_offerings.code IS 'Unique code identifier for the service offering.';
COMMENT ON COLUMN service_offerings.category IS 'Service category: Property Care, Financial Management, Resident Services, or Compliance & Legal.';
COMMENT ON COLUMN service_offerings.billing_basis IS 'How the service is billed (per property, per unit, percentage of rent, job cost, hourly, or one-time).';
COMMENT ON COLUMN service_offerings.default_rent_basis IS 'Basis for percentage-of-rent calculations (scheduled, billed, or collected).';

-- Create service_plan_offerings junction table
CREATE TABLE IF NOT EXISTS service_plan_offerings (
  service_plan service_plan_enum NOT NULL,
  offering_id uuid REFERENCES service_offerings(id) ON DELETE CASCADE,
  is_included boolean DEFAULT true,
  is_optional boolean DEFAULT false,
  PRIMARY KEY (service_plan, offering_id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_offerings_plan ON service_plan_offerings(service_plan);
CREATE INDEX IF NOT EXISTS idx_service_plan_offerings_offering ON service_plan_offerings(offering_id);

COMMENT ON TABLE service_plan_offerings IS 'Mapping of service offerings to service plans, indicating which offerings are included in each plan.';
COMMENT ON COLUMN service_plan_offerings.is_included IS 'Whether this offering is included in the plan by default.';
COMMENT ON COLUMN service_plan_offerings.is_optional IS 'Whether this offering is optional (can be deselected) for this plan.';

-- Create pseudo-offering for legacy fees (inactive, excluded from plan mappings)
-- Use 'Monthly' (existing enum value) instead of 'monthly' to avoid transaction issues
-- Provide default_rate = 0 to satisfy check constraint (will be overridden by plan defaults)
INSERT INTO service_offerings (
  code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, is_active, description
) VALUES (
  'LEGACY_MGMT_FEE', 
  'Legacy Management Fee', 
  'Financial Management', 
  'percent_rent', 
  0, 
  'Monthly', 
  'property', 
  'calendar_day', 
  false,
  'Legacy management fee placeholder for backward compatibility. This offering is inactive and excluded from all plan mappings.'
) ON CONFLICT (code) DO UPDATE SET
  is_active = false,
  description = EXCLUDED.description;

-- Seed service offerings from brochure mapping
-- Note: Using 'Monthly' and 'Annual' (existing enum values) as placeholders for now
-- New enum values will be used in a follow-up migration after enum values are committed
-- Financial Management
INSERT INTO service_offerings (code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, default_rent_basis, description) VALUES
  ('RENT_COLLECTION', 'Rent Collection', 'Financial Management', 'percent_rent', 0, 'Monthly', 'unit', 'calendar_day', 'scheduled', 'Rent invoicing and collection services.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_offerings (code, name, category, billing_basis, markup_pct, default_freq, applies_to, bill_on, description) VALUES
  ('MAINTENANCE_REPAIR', 'Maintenance/Repair', 'Property Care', 'job_cost', 10, 'Monthly', 'unit', 'job_close', 'Repair and maintenance services (includes Preventative Maintenance).')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_offerings (code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, description) VALUES
  ('BUDGET_PLANNING', 'Budget Planning', 'Financial Management', 'one_time', 0, 'Annual', 'property', 'calendar_day', 'Annual budget planning and long-term capital planning.'),
  ('REPORTING', 'Reporting', 'Financial Management', 'per_property', 0, 'Monthly', 'property', 'calendar_day', 'Monthly and annual financial reporting.'),
  ('BILL_PAY_ESCROW', 'Bill Pay & Escrow', 'Financial Management', 'per_property', 0, 'Monthly', 'property', 'calendar_day', 'Automated bill pay and escrow management.'),
  ('ESCROW_AUDIT', 'Escrow Audit', 'Financial Management', 'per_property', 0, 'Annual', 'property', 'calendar_day', 'Mortgage escrow audit and reconciliation.')
ON CONFLICT (code) DO NOTHING;

-- Property Care
INSERT INTO service_offerings (code, name, category, billing_basis, hourly_rate, hourly_min_hours, default_freq, applies_to, bill_on, description) VALUES
  ('EMERGENCY_RESPONSE', 'Emergency Response', 'Property Care', 'hourly', 150.00, 1, 'Monthly', 'property', 'event', '24/7 emergency response services.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_offerings (code, name, category, billing_basis, markup_pct, default_freq, applies_to, bill_on, description) VALUES
  ('TURNOVER', 'Turnover', 'Property Care', 'job_cost', 10, 'Monthly', 'unit', 'job_close', 'Apartment turnover services (10% of job cost).')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_offerings (code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, description) VALUES
  ('INSPECTIONS', 'Inspections', 'Property Care', 'one_time', 250.00, 'Monthly', 'unit', 'lease_event', 'Condition reports and inspections (move-in, move-out, annual).'),
  ('PROPERTY_INSURANCE', 'Property Insurance', 'Property Care', 'per_property', 0, 'Annual', 'property', 'calendar_day', 'Property insurance coverage (up to $100,000 liability).')
ON CONFLICT (code) DO NOTHING;

-- Resident Services
INSERT INTO service_offerings (code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, description) VALUES
  ('RESIDENT_SUPPORT', 'Resident Support Desk', 'Resident Services', 'per_property', 0, 'Monthly', 'property', 'calendar_day', 'Resident support and inquiry resolution.'),
  ('PORTAL', 'Portal', 'Resident Services', 'per_property', 0, 'Monthly', 'property', 'calendar_day', 'Resident portal and mobile app access.'),
  ('LEASING_PLACEMENT', 'Leasing/Placement', 'Resident Services', 'one_time', 0, 'Monthly', 'unit', 'lease_event', 'Leasing services and tenant placement.'),
  ('BOARD_PACKAGE', 'Board Package', 'Resident Services', 'one_time', 0, 'Monthly', 'unit', 'lease_event', 'Board package preparation for condo/co-op units.'),
  ('RENEWAL', 'Renewal', 'Resident Services', 'one_time', 250.00, 'Monthly', 'unit', 'lease_event', 'Lease renewal management.'),
  ('MOVE_COORDINATION', 'Move Coordination', 'Resident Services', 'one_time', 0, 'Monthly', 'unit', 'lease_event', 'Move-in/out coordination services.'),
  ('RENTERS_INSURANCE', 'Renters Insurance', 'Resident Services', 'per_unit', 0, 'Monthly', 'unit', 'calendar_day', 'Renters insurance coverage ($100,000 liability protection).')
ON CONFLICT (code) DO NOTHING;

-- Compliance & Legal
INSERT INTO service_offerings (code, name, category, billing_basis, default_rate, default_freq, applies_to, bill_on, description) VALUES
  ('COMPLIANCE_AUDIT', 'Compliance Audit', 'Compliance & Legal', 'one_time', 500.00, 'Annual', 'property', 'calendar_day', 'Regulatory compliance management and audits.'),
  ('TAX_1099', 'Tax & 1099', 'Compliance & Legal', 'per_property', 0, 'Annual', 'property', 'calendar_day', 'Tax and 1099 support services.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_offerings (code, name, category, billing_basis, hourly_rate, hourly_min_hours, default_freq, applies_to, bill_on, description) VALUES
  ('LEGAL_EVICTION', 'Legal/Eviction Liaison', 'Compliance & Legal', 'hourly', 150.00, 1, 'Monthly', 'property', 'event', 'Legal support and eviction liaison services.')
ON CONFLICT (code) DO NOTHING;

-- Seed service_plan_offerings mappings
-- Basic Plan: Rent Collection, Bill Pay & Escrow, Escrow Audit, Reporting, Resident Support, Portal, Board Package, Renewal, Move Coordination, Turnover, Inspections, Budget Planning
DO $$
DECLARE
  basic_offerings TEXT[] := ARRAY[
    'RENT_COLLECTION', 'BILL_PAY_ESCROW', 'ESCROW_AUDIT', 'REPORTING', 
    'RESIDENT_SUPPORT', 'PORTAL', 'BOARD_PACKAGE', 'RENEWAL', 
    'MOVE_COORDINATION', 'TURNOVER', 'INSPECTIONS', 'BUDGET_PLANNING'
  ];
  offering_code TEXT;
  offering_uuid uuid;
BEGIN
  FOREACH offering_code IN ARRAY basic_offerings
  LOOP
    SELECT id INTO offering_uuid FROM service_offerings WHERE code = offering_code;
    IF offering_uuid IS NOT NULL THEN
      INSERT INTO service_plan_offerings (service_plan, offering_id, is_included, is_optional)
      VALUES ('Basic', offering_uuid, true, false)
      ON CONFLICT (service_plan, offering_id) DO UPDATE SET
        is_included = true,
        is_optional = false;
    END IF;
  END LOOP;
END $$;

-- Full Plan: All Basic services + Emergency Response, Maintenance/Repair, Compliance Audit, Tax & 1099, Legal/Eviction Liaison
DO $$
DECLARE
  full_additional_offerings TEXT[] := ARRAY[
    'EMERGENCY_RESPONSE', 'MAINTENANCE_REPAIR', 'COMPLIANCE_AUDIT', 
    'TAX_1099', 'LEGAL_EVICTION'
  ];
  offering_code TEXT;
  offering_uuid uuid;
BEGIN
  -- First, copy all Basic offerings to Full
  INSERT INTO service_plan_offerings (service_plan, offering_id, is_included, is_optional)
  SELECT 'Full', offering_id, is_included, is_optional
  FROM service_plan_offerings
  WHERE service_plan = 'Basic'
  ON CONFLICT (service_plan, offering_id) DO NOTHING;
  
  -- Then add Full-specific offerings
  FOREACH offering_code IN ARRAY full_additional_offerings
  LOOP
    SELECT id INTO offering_uuid FROM service_offerings WHERE code = offering_code;
    IF offering_uuid IS NOT NULL THEN
      INSERT INTO service_plan_offerings (service_plan, offering_id, is_included, is_optional)
      VALUES ('Full', offering_uuid, true, false)
      ON CONFLICT (service_plan, offering_id) DO UPDATE SET
        is_included = true,
        is_optional = false;
    END IF;
  END LOOP;
END $$;

-- A-la-Carte Plan: All services available individually (is_included = false, is_optional = true)
DO $$
DECLARE
  offering_rec RECORD;
BEGIN
  FOR offering_rec IN SELECT id FROM service_offerings WHERE code != 'LEGACY_MGMT_FEE' AND is_active = true
  LOOP
    INSERT INTO service_plan_offerings (service_plan, offering_id, is_included, is_optional)
    VALUES ('A-la-carte', offering_rec.id, false, true)
    ON CONFLICT (service_plan, offering_id) DO UPDATE SET
      is_included = false,
      is_optional = true;
  END LOOP;
END $$;

-- Custom Plan: No default offerings (none by default; configured per property)
-- No seed data needed for Custom plan

COMMIT;


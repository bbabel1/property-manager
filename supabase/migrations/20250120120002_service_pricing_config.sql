-- Create pricing configuration tables
-- Part of Phase 2.1: Pricing Model Implementation
-- Creates service_plan_default_pricing, property_service_pricing, and billing_events tables

BEGIN;

-- Ensure btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create service_plan_default_pricing table for plan-level defaults
CREATE TABLE IF NOT EXISTS service_plan_default_pricing (
  service_plan service_plan_enum NOT NULL,
  offering_id uuid REFERENCES service_offerings(id) ON DELETE CASCADE,
  billing_basis billing_basis_enum NOT NULL,
  default_rate numeric(12,2),
  default_freq billing_frequency_enum NOT NULL,
  min_amount numeric(12,2), -- Minimum fee cap
  max_amount numeric(12,2), -- Maximum fee cap
  bill_on bill_on_enum NOT NULL,
  rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis
  min_monthly_fee numeric(12,2), -- For percent_rent plans (Basic/Full)
  plan_fee_percent numeric(5,2), -- For Basic (2.5%) and Full (4%) plans
  markup_pct numeric(5,2), -- For job-cost basis
  markup_pct_cap numeric(5,2), -- Maximum markup percentage
  hourly_rate numeric(12,2), -- For hourly basis
  hourly_min_hours numeric(5,2), -- Minimum billable hours
  is_included boolean DEFAULT true,
  is_required boolean DEFAULT false,
  PRIMARY KEY (service_plan, offering_id),
  -- Ensure plan_fee_percent is set for Basic/Full plan fees when billing_basis is percent_rent
  CONSTRAINT check_plan_fee_percent CHECK (
    (service_plan NOT IN ('Basic', 'Full') AND billing_basis != 'percent_rent') 
    OR plan_fee_percent IS NOT NULL
  ),
  -- Ensure rent_basis is NOT NULL for percent_rent
  CONSTRAINT check_rent_basis_not_null CHECK (
    billing_basis != 'percent_rent' OR rent_basis IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_plan_default_pricing_plan ON service_plan_default_pricing(service_plan);
CREATE INDEX IF NOT EXISTS idx_plan_default_pricing_offering ON service_plan_default_pricing(offering_id);

COMMENT ON TABLE service_plan_default_pricing IS 'Default pricing configuration for service offerings by plan.';
COMMENT ON COLUMN service_plan_default_pricing.plan_fee_percent IS 'Percentage fee for Basic (2.5%) and Full (4%) plans when billing_basis is percent_rent.';
COMMENT ON COLUMN service_plan_default_pricing.min_monthly_fee IS 'Minimum monthly fee for percent_rent plans.';
COMMENT ON COLUMN service_plan_default_pricing.rent_basis IS 'Basis for percentage-of-rent calculations (scheduled, billed, or collected).';

-- Create property_service_pricing table with effective dating and enum consistency
CREATE TABLE IF NOT EXISTS property_service_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE, -- NULL for property-level
  offering_id uuid NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  billing_basis billing_basis_enum NOT NULL,
  rate numeric(12,2), -- Flat rate or percentage value
  billing_frequency billing_frequency_enum NOT NULL,
  min_amount numeric(12,2), -- Minimum fee cap
  max_amount numeric(12,2), -- Maximum fee cap
  bill_on bill_on_enum NOT NULL,
  rent_basis rent_basis_enum DEFAULT 'scheduled', -- For percent_rent basis; NOT NULL when billing_basis='percent_rent'
  min_monthly_fee numeric(12,2), -- For percent_rent plans
  markup_pct numeric(5,2), -- For job-cost basis
  markup_pct_cap numeric(5,2), -- Maximum markup percentage
  hourly_rate numeric(12,2), -- For hourly basis
  hourly_min_hours numeric(5,2), -- Minimum billable hours
  is_active boolean DEFAULT true,
  effective_start timestamptz NOT NULL DEFAULT now(),
  effective_end timestamptz, -- NULL means currently active
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure rent_basis is NOT NULL for percent_rent
  CONSTRAINT check_rent_basis_not_null CHECK (
    billing_basis != 'percent_rent' OR rent_basis IS NOT NULL
  ),
  -- Exclusion constraint to prevent overlapping effective periods (requires btree_gist)
  EXCLUDE USING gist (
    property_id WITH =,
    unit_id WITH =,
    offering_id WITH =,
    tstzrange(effective_start, effective_end, '[)') WITH &&
  ) WHERE (unit_id IS NOT NULL),
  EXCLUDE USING gist (
    property_id WITH =,
    offering_id WITH =,
    tstzrange(effective_start, effective_end, '[)') WITH &&
  ) WHERE (unit_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_property_service_pricing_property ON property_service_pricing(property_id);
CREATE INDEX IF NOT EXISTS idx_property_service_pricing_unit ON property_service_pricing(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_service_pricing_offering ON property_service_pricing(offering_id);
CREATE INDEX IF NOT EXISTS idx_property_service_pricing_active ON property_service_pricing(property_id, unit_id, offering_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_property_service_pricing_effective ON property_service_pricing USING gist (tstzrange(effective_start, effective_end));

COMMENT ON TABLE property_service_pricing IS 'Property and unit-level pricing overrides for service offerings with effective dating.';
COMMENT ON COLUMN property_service_pricing.property_id IS 'Property ID (required).';
COMMENT ON COLUMN property_service_pricing.unit_id IS 'Unit ID (NULL for property-level pricing).';
COMMENT ON COLUMN property_service_pricing.effective_start IS 'Start of effective period for this pricing configuration.';
COMMENT ON COLUMN property_service_pricing.effective_end IS 'End of effective period (NULL means currently active).';
COMMENT ON COLUMN property_service_pricing.rent_basis IS 'Basis for percentage-of-rent calculations (scheduled, billed, or collected).';

-- Create billing_events table early for dashboard and invoice generation
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE, -- NULL for property-level
  offering_id uuid REFERENCES service_offerings(id) ON DELETE SET NULL,
  plan_id service_plan_enum, -- For plan-level fees
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(12,2) NOT NULL,
  source_basis billing_basis_enum NOT NULL, -- How amount was calculated
  rent_basis rent_basis_enum, -- For percent_rent calculations
  rent_amount numeric(12,2), -- Base rent used for calculation
  calculated_at timestamptz DEFAULT now(),
  invoiced_at timestamptz, -- When included in invoice
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL, -- Link to actual transaction
  created_at timestamptz DEFAULT now(),
  -- Prevent double-billing (includes org_id in uniqueness)
  UNIQUE(org_id, period_start, offering_id, property_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org_period ON billing_events(org_id, period_start, offering_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_offering ON billing_events(offering_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_property ON billing_events(property_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_unit ON billing_events(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_plan ON billing_events(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_transaction ON billing_events(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_invoiced ON billing_events(invoiced_at) WHERE invoiced_at IS NOT NULL;

COMMENT ON TABLE billing_events IS 'Source of truth for all service fee billing events. Used for revenue tracking and invoice generation.';
COMMENT ON COLUMN billing_events.org_id IS 'Organization ID (required for multi-tenant isolation).';
COMMENT ON COLUMN billing_events.period_start IS 'Start date of billing period.';
COMMENT ON COLUMN billing_events.period_end IS 'End date of billing period.';
COMMENT ON COLUMN billing_events.source_basis IS 'How the amount was calculated (per_property, per_unit, percent_rent, job_cost, hourly, one_time).';
COMMENT ON COLUMN billing_events.rent_basis IS 'Basis used for percent_rent calculations (scheduled, billed, or collected).';
COMMENT ON COLUMN billing_events.rent_amount IS 'Base rent amount used for percentage calculation.';
COMMENT ON COLUMN billing_events.invoiced_at IS 'Timestamp when this billing event was included in an invoice.';

COMMIT;


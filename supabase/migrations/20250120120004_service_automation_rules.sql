-- Create service automation rules tables
-- Part of Phase 4.1: Automation Logic Extension
-- Creates enums, extends monthly_log_task_rules, creates service_automation_rules and property_automation_overrides

BEGIN;

-- Create enums for automation rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'automation_rule_type_enum'
  ) THEN
    CREATE TYPE automation_rule_type_enum AS ENUM (
      'recurring_task', 'recurring_charge', 'workflow_trigger'
    );
    COMMENT ON TYPE automation_rule_type_enum IS 'Type of automation rule (recurring task, recurring charge, or workflow trigger).';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'automation_frequency_enum'
  ) THEN
    CREATE TYPE automation_frequency_enum AS ENUM (
      'monthly', 'quarterly', 'annually', 'on_event', 'weekly', 'biweekly'
    );
    COMMENT ON TYPE automation_frequency_enum IS 'Frequency for automation rules.';
  END IF;
END $$;

-- Extend monthly_log_task_rules table
ALTER TABLE monthly_log_task_rules
  ADD COLUMN IF NOT EXISTS service_offering_id uuid REFERENCES service_offerings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_on_service_activation boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_monthly_log_task_rules_offering 
  ON monthly_log_task_rules(service_offering_id) 
  WHERE service_offering_id IS NOT NULL;

COMMENT ON COLUMN monthly_log_task_rules.service_offering_id IS 'Service offering that triggers this task rule.';
COMMENT ON COLUMN monthly_log_task_rules.trigger_on_service_activation IS 'Whether to trigger this task when the service is activated.';

-- Create service_automation_rules table
CREATE TABLE IF NOT EXISTS service_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  rule_type automation_rule_type_enum NOT NULL,
  frequency automation_frequency_enum NOT NULL,
  task_template jsonb,
  charge_template jsonb,
  conditions jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_offering ON service_automation_rules(offering_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON service_automation_rules(offering_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON service_automation_rules(rule_type);

COMMENT ON TABLE service_automation_rules IS 'Automation rules for service offerings. Defines when and how tasks/charges are generated.';
COMMENT ON COLUMN service_automation_rules.task_template IS 'JSON template for generating recurring tasks.';
COMMENT ON COLUMN service_automation_rules.charge_template IS 'JSON template for generating recurring charges.';
COMMENT ON COLUMN service_automation_rules.conditions IS 'JSON conditions for when this rule applies.';

-- Create property_automation_overrides table for per-property/unit automation rule overrides
CREATE TABLE IF NOT EXISTS property_automation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE, -- NULL for property-level
  offering_id uuid NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES service_automation_rules(id) ON DELETE CASCADE,
  override_config jsonb NOT NULL, -- Specific override configuration (bounded schema)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, unit_id, offering_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_overrides_property ON property_automation_overrides(property_id);
CREATE INDEX IF NOT EXISTS idx_automation_overrides_unit ON property_automation_overrides(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_overrides_offering ON property_automation_overrides(offering_id);
CREATE INDEX IF NOT EXISTS idx_automation_overrides_rule ON property_automation_overrides(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_overrides_active ON property_automation_overrides(property_id, unit_id, offering_id, is_active) WHERE is_active = true;

COMMENT ON TABLE property_automation_overrides IS 'Property/unit-level overrides for service automation rules.';
COMMENT ON COLUMN property_automation_overrides.override_config IS 'Bounded JSON schema for override configuration (frequency, timing, conditions, etc.).';

COMMIT;


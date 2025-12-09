-- Add service fee tracking to transactions
-- Part of Phase 5.3: Fee Transaction Schema Updates
-- Adds service_offering_id, plan_id, fee_category, and legacy_memo to transactions table

BEGIN;

-- Create enum for fee categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'fee_category_enum'
  ) THEN
    CREATE TYPE fee_category_enum AS ENUM (
      'plan_fee', 'service_fee', 'override', 'legacy'
    );
    COMMENT ON TYPE fee_category_enum IS 'Category of fee transaction (plan fee, service fee, override, or legacy).';
  END IF;
END $$;

-- Add columns to transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS service_offering_id uuid REFERENCES service_offerings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id service_plan_enum,
  ADD COLUMN IF NOT EXISTS fee_category fee_category_enum,
  ADD COLUMN IF NOT EXISTS legacy_memo text; -- Preserve original memo for backward compatibility

-- Create indexes for service fee queries
CREATE INDEX IF NOT EXISTS idx_transactions_service_offering 
  ON transactions(service_offering_id) 
  WHERE service_offering_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_plan_id 
  ON transactions(plan_id) 
  WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_fee_category 
  ON transactions(fee_category) 
  WHERE fee_category IS NOT NULL;

COMMENT ON COLUMN transactions.service_offering_id IS 'Service offering associated with this fee transaction.';
COMMENT ON COLUMN transactions.plan_id IS 'Service plan associated with this fee transaction (for plan-level fees).';
COMMENT ON COLUMN transactions.fee_category IS 'Category of fee (plan_fee, service_fee, override, or legacy).';
COMMENT ON COLUMN transactions.legacy_memo IS 'Original memo text for backward compatibility.';

-- Create view for backward compatibility (aggregates plan fees)
CREATE OR REPLACE VIEW v_legacy_management_fees AS
SELECT 
  monthly_log_id,
  SUM(total_amount) as total_management_fee,
  plan_id,
  array_agg(DISTINCT service_offering_id) FILTER (WHERE service_offering_id IS NOT NULL) as offering_ids
FROM transactions
WHERE fee_category IN ('plan_fee', 'legacy')
  AND (memo ILIKE '%management fee%' OR legacy_memo ILIKE '%management fee%')
GROUP BY monthly_log_id, plan_id;

COMMENT ON VIEW v_legacy_management_fees IS 'Backward compatibility view aggregating plan fees for legacy code.';

-- Create service_fee_history table for audit trail
CREATE TABLE IF NOT EXISTS service_fee_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  billing_event_id uuid REFERENCES billing_events(id) ON DELETE SET NULL,
  offering_id uuid REFERENCES service_offerings(id) ON DELETE SET NULL,
  plan_id service_plan_enum,
  amount numeric(12,2) NOT NULL,
  calculation_details jsonb, -- Store calculation inputs for audit
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_history_transaction ON service_fee_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fee_history_billing_event ON service_fee_history(billing_event_id);
CREATE INDEX IF NOT EXISTS idx_fee_history_offering ON service_fee_history(offering_id) WHERE offering_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fee_history_plan ON service_fee_history(plan_id) WHERE plan_id IS NOT NULL;

COMMENT ON TABLE service_fee_history IS 'Audit trail for service fee calculations and transactions.';
COMMENT ON COLUMN service_fee_history.calculation_details IS 'JSON storing calculation inputs (rent amount, percentage, min fee, etc.) for audit purposes.';

COMMIT;


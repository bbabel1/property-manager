-- Migration: Add previous_lease_balance to monthly_logs with triggers and reconciliation function
-- Purpose: Track lease balance from prior month for rent owed calculations
-- Add column (nullable first, will add NOT NULL after backfill)
ALTER TABLE monthly_logs
ADD COLUMN IF NOT EXISTS previous_lease_balance NUMERIC(14, 2) DEFAULT 0;
COMMENT ON COLUMN monthly_logs.previous_lease_balance IS 'Lease balance carried forward from prior month for rent owed calculation. Recalculated on log creation and stage completion. See reconcile_monthly_log_balance() function.';
-- Reconciliation function
CREATE OR REPLACE FUNCTION reconcile_monthly_log_balance(p_monthly_log_id UUID) RETURNS VOID AS $$
DECLARE v_unit_id UUID;
v_period_start DATE;
v_prior_month DATE;
v_prior_balance NUMERIC(14, 2);
BEGIN -- Get unit and period for this log
SELECT unit_id,
    period_start INTO v_unit_id,
    v_period_start
FROM monthly_logs
WHERE id = p_monthly_log_id;
-- Calculate prior month date
v_prior_month := v_period_start - INTERVAL '1 month';
-- Get prior month's balance (charges - payments)
SELECT COALESCE(charges_amount - payments_amount, 0) INTO v_prior_balance
FROM monthly_logs
WHERE unit_id = v_unit_id
    AND period_start = DATE_TRUNC('month', v_prior_month)::DATE
LIMIT 1;
-- Update this log's previous balance
UPDATE monthly_logs
SET previous_lease_balance = COALESCE(v_prior_balance, 0)
WHERE id = p_monthly_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION reconcile_monthly_log_balance(UUID) IS 'Recalculates the previous_lease_balance field by looking up the prior month''s charges minus payments. Called automatically on log creation and stage transitions.';
-- Trigger function: set previous balance on INSERT
CREATE OR REPLACE FUNCTION trg_set_previous_balance() RETURNS TRIGGER AS $$ BEGIN PERFORM reconcile_monthly_log_balance(NEW.id);
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger for INSERT
DROP TRIGGER IF EXISTS monthly_log_set_previous_balance ON monthly_logs;
CREATE TRIGGER monthly_log_set_previous_balance
AFTER
INSERT ON monthly_logs FOR EACH ROW EXECUTE FUNCTION trg_set_previous_balance();
-- Trigger function: recalculate balance on stage change
CREATE OR REPLACE FUNCTION trg_recalc_balance_on_stage_update() RETURNS TRIGGER AS $$ BEGIN -- Recalculate when transitioning to payments or complete stage
    IF (
        NEW.stage IN ('payments', 'complete')
        AND OLD.stage <> NEW.stage
    ) THEN PERFORM reconcile_monthly_log_balance(NEW.id);
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS monthly_log_recalc_balance_on_stage ON monthly_logs;
CREATE TRIGGER monthly_log_recalc_balance_on_stage
AFTER
UPDATE OF stage ON monthly_logs FOR EACH ROW EXECUTE FUNCTION trg_recalc_balance_on_stage_update();
-- Backfill existing monthly_logs with calculated previous balance
DO $$
DECLARE log_record RECORD;
BEGIN FOR log_record IN
SELECT id
FROM monthly_logs
ORDER BY period_start ASC LOOP PERFORM reconcile_monthly_log_balance(log_record.id);
END LOOP;
RAISE NOTICE 'Backfilled previous_lease_balance for all existing monthly logs';
END $$;
-- Now add NOT NULL constraint after backfill
ALTER TABLE monthly_logs
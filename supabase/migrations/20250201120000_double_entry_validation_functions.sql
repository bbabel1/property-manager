-- Double-entry bookkeeping validation functions and triggers
-- Implements Phase 1 fixes: SQL functions for atomic operations and database-level validation

-- Function to validate transaction balance (debits = credits within tolerance)
CREATE OR REPLACE FUNCTION validate_transaction_balance(
  p_transaction_id uuid,
  p_tolerance numeric DEFAULT 0.01
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_count int;
  v_credit_count int;
  v_debit_total numeric;
  v_credit_total numeric;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE posting_type = 'Debit'),
    COUNT(*) FILTER (WHERE posting_type = 'Credit'),
    COALESCE(SUM(amount) FILTER (WHERE posting_type = 'Debit'), 0),
    COALESCE(SUM(amount) FILTER (WHERE posting_type = 'Credit'), 0)
  INTO v_debit_count, v_credit_count, v_debit_total, v_credit_total
  FROM transaction_lines
  WHERE transaction_id = p_transaction_id;

  -- Require at least one debit and one credit
  IF v_debit_count = 0 OR v_credit_count = 0 THEN
    RAISE EXCEPTION 'Transaction % must have at least one debit and one credit line (found % debits, % credits)',
      p_transaction_id, v_debit_count, v_credit_count
      USING ERRCODE = '23514';
  END IF;

  -- Validate balance within tolerance
  IF ABS(v_debit_total - v_credit_total) > p_tolerance THEN
    RAISE EXCEPTION 'Transaction % unbalanced: debits=%, credits=%, difference=%, tolerance=%',
      p_transaction_id, v_debit_total, v_credit_total,
      ABS(v_debit_total - v_credit_total), p_tolerance
      USING ERRCODE = '23514';
  END IF;
END;
$$;

COMMENT ON FUNCTION validate_transaction_balance(uuid, numeric) IS
  'Validates that a transaction follows double-entry bookkeeping: requires at least one debit and one credit line, and debits must equal credits within tolerance';

-- Function to atomically replace transaction lines with locking and validation
CREATE OR REPLACE FUNCTION replace_transaction_lines(
  p_transaction_id uuid,
  p_lines jsonb,
  p_validate_balance boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_record jsonb;
  v_now timestamptz := now();
BEGIN
  -- Lock transaction row to prevent concurrent modifications
  PERFORM 1
  FROM transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Delete existing lines
  DELETE FROM transaction_lines
  WHERE transaction_id = p_transaction_id;

  -- Insert new lines from JSONB array
  FOR v_line_record IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO transaction_lines (
      transaction_id,
      gl_account_id,
      amount,
      posting_type,
      memo,
      account_entity_type,
      account_entity_id,
      property_id,
      unit_id,
      lease_id,
      buildium_property_id,
      buildium_unit_id,
      buildium_lease_id,
      date,
      created_at,
      updated_at,
      reference_number,
      is_cash_posting
    ) VALUES (
      p_transaction_id,
      (v_line_record->>'gl_account_id')::uuid,
      (v_line_record->>'amount')::numeric,
      (v_line_record->>'posting_type')::text,
      NULLIF(v_line_record->>'memo', 'null'),
      (v_line_record->>'account_entity_type')::text,
      NULLIF((v_line_record->>'account_entity_id')::text, 'null')::uuid,
      NULLIF((v_line_record->>'property_id')::text, 'null')::uuid,
      NULLIF((v_line_record->>'unit_id')::text, 'null')::uuid,
      NULLIF((v_line_record->>'lease_id')::text, 'null')::uuid,
      NULLIF((v_line_record->>'buildium_property_id')::text, 'null')::integer,
      NULLIF((v_line_record->>'buildium_unit_id')::text, 'null')::integer,
      NULLIF((v_line_record->>'buildium_lease_id')::text, 'null')::integer,
      COALESCE((v_line_record->>'date')::date, CURRENT_DATE),
      COALESCE((v_line_record->>'created_at')::timestamptz, v_now),
      COALESCE((v_line_record->>'updated_at')::timestamptz, v_now),
      NULLIF(v_line_record->>'reference_number', 'null'),
      COALESCE((v_line_record->>'is_cash_posting')::boolean, false)
    );
  END LOOP;

  -- Validate balance if requested
  IF p_validate_balance THEN
    PERFORM validate_transaction_balance(p_transaction_id);
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on any error
    RAISE;
END;
$$;

COMMENT ON FUNCTION replace_transaction_lines(uuid, jsonb, boolean) IS
  'Atomically replaces all transaction lines for a transaction with locking to prevent race conditions. Validates balance by default.';

-- Trigger function that validates balance after line changes
CREATE OR REPLACE FUNCTION trg_validate_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- Determine transaction_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_transaction_id := OLD.transaction_id;
  ELSE
    v_transaction_id := NEW.transaction_id;
  END IF;

  -- Validate balance for the transaction
  PERFORM validate_transaction_balance(v_transaction_id);

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION trg_validate_transaction_balance() IS
  'Trigger function that validates transaction balance after any line insert/update/delete';

-- Create constraint trigger (deferrable to allow multi-line inserts in one transaction)
DROP TRIGGER IF EXISTS trg_transaction_lines_validate_balance ON transaction_lines;
CREATE CONSTRAINT TRIGGER trg_transaction_lines_validate_balance
AFTER INSERT OR UPDATE OR DELETE ON transaction_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_validate_transaction_balance();

COMMENT ON TRIGGER trg_transaction_lines_validate_balance ON transaction_lines IS
  'Validates double-entry balance after any transaction line change. Deferred to allow multi-line inserts.';


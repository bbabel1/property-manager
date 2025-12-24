-- Function to safely delete a transaction (including unbalanced ones)
-- Temporarily disables the balance validation trigger to allow deletion
-- This is needed for cleaning up invalid/test data

CREATE OR REPLACE FUNCTION delete_transaction_safe(
  p_transaction_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the balance validation trigger
  ALTER TABLE transaction_lines DISABLE TRIGGER trg_transaction_lines_validate_balance;
  
  -- Delete transaction (lines will cascade delete automatically due to FK constraint)
  DELETE FROM transactions WHERE id = p_transaction_id;
  
  -- Re-enable the trigger
  ALTER TABLE transaction_lines ENABLE TRIGGER trg_transaction_lines_validate_balance;
  
  -- If transaction doesn't exist, that's fine - just return
EXCEPTION
  WHEN OTHERS THEN
    -- Re-enable trigger even on error
    ALTER TABLE transaction_lines ENABLE TRIGGER trg_transaction_lines_validate_balance;
    RAISE;
END;
$$;

COMMENT ON FUNCTION delete_transaction_safe(uuid) IS
  'Safely deletes a transaction by temporarily disabling balance validation trigger. Use for cleaning up invalid/test data.';


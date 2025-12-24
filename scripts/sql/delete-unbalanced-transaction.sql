-- Delete unbalanced transaction by temporarily disabling trigger
-- This allows deletion of transactions that violate double-entry rules

BEGIN;

-- Temporarily disable the balance validation trigger
ALTER TABLE transaction_lines DISABLE TRIGGER trg_transaction_lines_validate_balance;

-- Delete transaction (lines will cascade delete automatically)
DELETE FROM transactions WHERE id = '11a700a4-f9c7-4bd9-9f6d-3a9a23be212a';

-- Re-enable the trigger
ALTER TABLE transaction_lines ENABLE TRIGGER trg_transaction_lines_validate_balance;

COMMIT;

-- Verify deletion
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM transactions WHERE id = '11a700a4-f9c7-4bd9-9f6d-3a9a23be212a') 
    THEN 'Transaction still exists'
    ELSE 'Transaction deleted successfully'
  END as status;


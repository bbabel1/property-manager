-- Check balance drift between local book balance and Buildium ending balance
-- Usage: Replace <bank_gl_account_id> and <as_of> with actual values
-- Example:
--   bank_gl_account_id: '123e4567-e89b-12d3-a456-426614174000'
--   as_of: '2024-01-31'

-- First, find a reconciliation to check:
SELECT 
  rl.id,
  rl.bank_gl_account_id,
  rl.statement_ending_date,
  rl.ending_balance as buildium_ending_balance,
  rl.is_finished,
  ga.account_name,
  ga.account_number
FROM reconciliation_log rl
JOIN gl_accounts ga ON ga.id = rl.bank_gl_account_id
WHERE rl.ending_balance IS NOT NULL
  AND rl.statement_ending_date IS NOT NULL
ORDER BY rl.statement_ending_date DESC
LIMIT 10;

-- Then check drift for a specific reconciliation:
-- Replace <bank_gl_account_id> and <as_of> with values from above query
/*
SELECT
  calculate_book_balance('<bank_gl_account_id>'::uuid, '<as_of>'::date) as local_cleared_balance,
  ending_balance as buildium_ending_balance,
  (ending_balance - calculate_book_balance('<bank_gl_account_id>'::uuid, '<as_of>'::date))::numeric(12,2) as drift,
  statement_ending_date,
  is_finished,
  ga.account_name
FROM reconciliation_log rl
JOIN gl_accounts ga ON ga.id = rl.bank_gl_account_id
WHERE rl.bank_gl_account_id = '<bank_gl_account_id>'::uuid
  AND rl.statement_ending_date = '<as_of>'::date
ORDER BY rl.statement_ending_date DESC
LIMIT 1;
*/

-- Check all reconciliations with drift > 0.01:
SELECT
  rl.bank_gl_account_id,
  rl.statement_ending_date,
  calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date) as local_cleared_balance,
  rl.ending_balance as buildium_ending_balance,
  (rl.ending_balance - calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date))::numeric(12,2) as drift,
  rl.is_finished,
  ga.account_name
FROM reconciliation_log rl
JOIN gl_accounts ga ON ga.id = rl.bank_gl_account_id
WHERE rl.ending_balance IS NOT NULL
  AND rl.statement_ending_date IS NOT NULL
  AND ABS(rl.ending_balance - calculate_book_balance(rl.bank_gl_account_id, rl.statement_ending_date)) > 0.01
ORDER BY ABS(drift) DESC;



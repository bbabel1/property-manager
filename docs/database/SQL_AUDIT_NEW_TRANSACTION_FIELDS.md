-- Audit: Verify new Buildium transaction fields are populated and balanced after backfill.
-- Run this read-only script in Supabase SQL editor or psql.

-- 1) Missing bank lines on payments/apply-deposits
SELECT
t.id,
t.buildium_transaction_id,
t.transaction_type,
t.date,
t.total_amount,
COUNT(_) FILTER (WHERE tl.is_bank_account) AS bank_lines,
COUNT(_) FILTER (WHERE tl.is_cash_posting) AS cash_lines
FROM transactions t
LEFT JOIN (
SELECT transaction_id, gl_account_id, is_cash_posting,
(SELECT is_bank_account FROM gl_accounts g WHERE g.id = tl.gl_account_id) AS is_bank_account
FROM transaction_lines tl
) tl ON tl.transaction_id = t.id
WHERE t.transaction_type IN ('Payment', 'ApplyDeposit')
GROUP BY 1,2,3,4,5
HAVING COUNT(\*) FILTER (WHERE tl.is_bank_account) = 0;

-- 2) Unbalanced transactions (double-entry)
SELECT
t.id,
t.buildium_transaction_id,
t.transaction_type,
SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END) AS debits,
SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END) AS credits
FROM transactions t
JOIN transaction_lines tl ON tl.transaction_id = t.id
GROUP BY 1,2,3
HAVING ABS(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END) -
SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END)) > 0.0001;

-- 3) Orphaned payment splits (transaction deleted)
SELECT s.\*
FROM transaction_payment_transactions s
LEFT JOIN transactions t ON t.id = s.transaction_id
WHERE t.id IS NULL;

-- 4) Missing splits on deposits with BankGLAccountId
SELECT
t.id,
t.buildium_transaction_id,
t.bank_gl_account_buildium_id,
COUNT(s.id) AS split_count
FROM transactions t
LEFT JOIN transaction_payment_transactions s ON s.transaction_id = t.id
WHERE t.bank_gl_account_buildium_id IS NOT NULL
GROUP BY 1,2,3
HAVING COUNT(s.id) = 0;

-- Audit script to find unbalanced transactions
-- Run this in Supabase SQL Editor or via psql
-- Finds transactions that violate double-entry bookkeeping rules:
--   - Missing debit or credit lines
--   - Unbalanced debits/credits (difference > 0.01)

SELECT
  t.id,
  t.transaction_type,
  t.date,
  COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') as debit_count,
  COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') as credit_count,
  COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) as debit_total,
  COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0) as credit_total,
  ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
      COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) as difference,
  CASE
    WHEN COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') = 0 THEN 'Missing debits'
    WHEN COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') = 0 THEN 'Missing credits'
    ELSE 'Unbalanced amount'
  END as violation_type
FROM transactions t
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
GROUP BY t.id, t.transaction_type, t.date
HAVING
  COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') = 0 OR
  COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') = 0 OR
  ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
      COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) > 0.01
ORDER BY difference DESC, t.date DESC
LIMIT 100;

-- Summary counts
SELECT
  COUNT(*) FILTER (WHERE debit_count = 0 OR credit_count = 0) as one_sided_count,
  COUNT(*) FILTER (WHERE debit_count > 0 AND credit_count > 0 AND difference > 0.01) as unbalanced_count,
  COUNT(*) as total_violations
FROM (
  SELECT
    t.id,
    COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') as debit_count,
    COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') as credit_count,
    ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
        COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) as difference
  FROM transactions t
  LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
  GROUP BY t.id
  HAVING
    COUNT(*) FILTER (WHERE tl.posting_type = 'Debit') = 0 OR
    COUNT(*) FILTER (WHERE tl.posting_type = 'Credit') = 0 OR
    ABS(COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Debit'), 0) -
        COALESCE(SUM(tl.amount) FILTER (WHERE tl.posting_type = 'Credit'), 0)) > 0.01
) violations;


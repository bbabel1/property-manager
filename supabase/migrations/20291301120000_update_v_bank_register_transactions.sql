-- Phase 6: Update v_bank_register_transactions to include local bank register status
-- Drop and recreate to handle column structure changes
-- Note: Must drop dependent views first

DROP VIEW IF EXISTS public.v_reconciliation_transactions;
DROP VIEW IF EXISTS public.v_bank_register_transactions;

CREATE VIEW public.v_bank_register_transactions AS
WITH bank_lines AS (
  SELECT
    tl.transaction_id,
    tl.gl_account_id,
    tl.amount,
    tl.posting_type
  FROM public.transaction_lines tl
  JOIN public.gl_accounts ga
    ON ga.id = tl.gl_account_id
   AND ga.is_bank_account = true
)
SELECT
  t.id,
  t.date,
  (COALESCE(t.reference_number, t.check_number)::varchar(255)) AS reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.vendor_id,
  bl.gl_account_id AS bank_gl_account_id,
  bl.amount AS bank_amount,
  bl.posting_type::varchar(10) AS bank_posting_type,
  COALESCE(brs.status, 'uncleared'::bank_entry_status_enum) AS bank_entry_status,
  brs.current_reconciliation_log_id,
  brs.cleared_at,
  brs.reconciled_at,
  t.paid_by_label,
  t.paid_to_name,
  t.paid_to_type,
  t.paid_to_buildium_id,
  t.payee_name,
  t.payee_buildium_type,
  t.payee_buildium_id,
  CASE
    WHEN bl.gl_account_id IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.transaction_lines tl2
      JOIN public.gl_accounts ga2 ON ga2.id = tl2.gl_account_id AND ga2.is_bank_account = true
      WHERE tl2.transaction_id = t.id
        AND tl2.gl_account_id <> bl.gl_account_id
    ) THEN true
    ELSE false
  END AS is_transfer,
  (
    SELECT tl2.gl_account_id
    FROM public.transaction_lines tl2
    JOIN public.gl_accounts ga2 ON ga2.id = tl2.gl_account_id AND ga2.is_bank_account = true
    WHERE tl2.transaction_id = t.id
      AND tl2.gl_account_id <> bl.gl_account_id
    ORDER BY tl2.id ASC
    LIMIT 1
  ) AS transfer_other_bank_gl_account_id
FROM public.transactions t
JOIN bank_lines bl
  ON bl.transaction_id = t.id
LEFT JOIN public.bank_register_state brs
  ON brs.transaction_id = t.id
 AND brs.bank_gl_account_id = bl.gl_account_id

UNION ALL

SELECT
  t.id,
  t.date,
  (COALESCE(t.reference_number, t.check_number)::varchar(255)) AS reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.vendor_id,
  t.bank_gl_account_id AS bank_gl_account_id,
  NULL::numeric AS bank_amount,
  NULL::varchar(10) AS bank_posting_type,
  COALESCE(brs.status, 'uncleared'::bank_entry_status_enum) AS bank_entry_status,
  brs.current_reconciliation_log_id,
  brs.cleared_at,
  brs.reconciled_at,
  t.paid_by_label,
  t.paid_to_name,
  t.paid_to_type,
  t.paid_to_buildium_id,
  t.payee_name,
  t.payee_buildium_type,
  t.payee_buildium_id,
  false AS is_transfer,
  NULL::uuid AS transfer_other_bank_gl_account_id
FROM public.transactions t
LEFT JOIN public.bank_register_state brs
  ON brs.transaction_id = t.id
 AND brs.bank_gl_account_id = t.bank_gl_account_id
WHERE t.bank_gl_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM bank_lines bl
    WHERE bl.transaction_id = t.id
  );

-- Recreate dependent view
CREATE VIEW public.v_reconciliation_transactions AS
SELECT
  rl.id AS reconciliation_id,
  rl.statement_start_date,
  rl.statement_ending_date,
  rl.locked_at,
  brs.transaction_id,
  brs.bank_gl_account_id,
  brs.status,
  brs.cleared_at,
  brs.reconciled_at,
  vbrt.bank_amount,
  vbrt.bank_posting_type,
  vbrt.date AS entry_date,
  vbrt.memo
FROM public.reconciliation_log rl
JOIN public.bank_register_state brs
  ON brs.current_reconciliation_log_id = rl.id
LEFT JOIN public.v_bank_register_transactions vbrt
  ON vbrt.id = brs.transaction_id
 AND vbrt.bank_gl_account_id = brs.bank_gl_account_id;

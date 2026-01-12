-- Phase 2: Extend reconciliation_log with lock/snapshot fields and add reconciliation-aware helpers

-- 1) Extend reconciliation_log with lock and snapshot metadata
ALTER TABLE public.reconciliation_log
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS statement_start_date date,
  ADD COLUMN IF NOT EXISTS book_balance_snapshot numeric(15,2);

COMMENT ON COLUMN public.reconciliation_log.locked_at IS 'Timestamp when reconciliation was locked/finalized. After this, bank-side transaction amounts cannot be changed.';
COMMENT ON COLUMN public.reconciliation_log.locked_by_user_id IS 'User who locked/finalized the reconciliation.';
COMMENT ON COLUMN public.reconciliation_log.book_balance_snapshot IS 'Book balance (cleared/reconciled transactions) at time of reconciliation finalize.';
COMMENT ON COLUMN public.reconciliation_log.statement_start_date IS 'Statement period start date for the reconciliation.';
-- ending_balance already represents the bank statement ending balance

-- 2) View: transactions linked to reconciliations using bank_register_state
CREATE OR REPLACE VIEW public.v_reconciliation_transactions AS
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
 AND vbrt.bank_gl_account_id = brs.bank_gl_account_id
;

-- 3) Function: calculate book balance from cleared/reconciled bank register state
CREATE OR REPLACE FUNCTION public.calculate_book_balance(
  p_bank_gl_account_id uuid,
  p_as_of date DEFAULT current_date,
  p_org_id uuid DEFAULT NULL
)
RETURNS numeric(15,2)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN vbrt.bank_posting_type = 'Debit' THEN vbrt.bank_amount
        WHEN vbrt.bank_posting_type = 'Credit' THEN -vbrt.bank_amount
        ELSE 0
      END
    ),
    0
  )::numeric(15,2)
  FROM public.v_bank_register_transactions vbrt
  JOIN public.bank_register_state brs
    ON brs.transaction_id = vbrt.id
   AND brs.bank_gl_account_id = vbrt.bank_gl_account_id
  JOIN public.gl_accounts ga
    ON ga.id = vbrt.bank_gl_account_id
  WHERE vbrt.bank_gl_account_id = p_bank_gl_account_id
    AND vbrt.date <= p_as_of::date
    AND brs.status IN ('cleared', 'reconciled')
    AND (p_org_id IS NULL OR ga.org_id = p_org_id);
$$;

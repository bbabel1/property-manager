-- Trust accounting views for Undeposited Funds warnings

CREATE OR REPLACE VIEW public.v_undeposited_payments AS
SELECT
  t.id AS transaction_id,
  t.org_id,
  t.date AS payment_date,
  t.total_amount,
  t.transaction_type,
  t.memo,
  t.tenant_id,
  t.paid_to_tenant_id,
  NOT EXISTS (
    SELECT 1 FROM public.deposit_items di
    WHERE di.payment_transaction_id = t.id
  ) AS is_undeposited,
  GREATEST(0, (CURRENT_DATE - t.date))::integer AS age_days
FROM public.transactions t
JOIN public.gl_accounts udf ON udf.id = t.bank_gl_account_id
WHERE t.transaction_type IN (
  'Payment',
  'ElectronicFundsTransfer',
  'ApplyDeposit',
  'RentalApplicationFeePayment'
)
AND udf.name ILIKE '%undeposited funds%'
AND NOT EXISTS (
  SELECT 1 FROM public.deposit_items di
  WHERE di.payment_transaction_id = t.id
);

COMMENT ON VIEW public.v_undeposited_payments IS 'All payments sitting in undeposited funds, excluding those already linked to deposits. Includes RentalApplicationFeePayment.';

CREATE OR REPLACE VIEW public.v_udf_warnings AS
SELECT
  org_id,
  COUNT(*) AS payment_count,
  SUM(total_amount) AS total_amount,
  MAX(age_days) AS max_age_days,
  AVG(age_days) AS avg_age_days,
  CASE
    WHEN MAX(age_days) >= 60 OR SUM(total_amount) >= 10000 THEN 'critical'
    WHEN MAX(age_days) >= 30 OR SUM(total_amount) >= 5000 THEN 'warning'
    ELSE 'info'
  END AS warning_level
FROM public.v_undeposited_payments
WHERE is_undeposited = true
GROUP BY org_id;

COMMENT ON VIEW public.v_udf_warnings IS 'Trust accounting warnings grouped by org: critical (>60 days or >$10k), warning (>30 days or >$5k), info otherwise';

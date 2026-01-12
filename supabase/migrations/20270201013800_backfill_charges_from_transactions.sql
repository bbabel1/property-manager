-- Backfill helper views and sanity queries for AR subledger vs GL

-- View: AR subledger per org
CREATE OR REPLACE VIEW public.v_ar_subledger AS
SELECT
  org_id,
  SUM(amount_open) AS ar_subledger_balance
FROM public.charges
WHERE status IN ('open', 'partial')
GROUP BY org_id;

-- View: AR GL balance per org (accounts receivable assets)
CREATE OR REPLACE VIEW public.v_ar_gl_balance AS
SELECT
  t.org_id,
  SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE -tl.amount END) AS ar_gl_balance
FROM public.transaction_lines tl
JOIN public.transactions t ON t.id = tl.transaction_id
JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
WHERE ga.type = 'asset'
  AND (ga.sub_type = 'AccountsReceivable' OR ga.name ILIKE '%accounts receivable%')
GROUP BY t.org_id;

-- View: reconciliation of subledger vs GL
CREATE OR REPLACE VIEW public.v_ar_reconciliation AS
SELECT
  COALESCE(s.org_id, g.org_id) AS org_id,
  s.ar_subledger_balance,
  g.ar_gl_balance,
  (s.ar_subledger_balance - g.ar_gl_balance) AS variance
FROM public.v_ar_subledger s
FULL OUTER JOIN public.v_ar_gl_balance g ON s.org_id = g.org_id;

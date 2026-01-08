-- Backfill bank_register_state from existing bank-side transaction lines
INSERT INTO public.bank_register_state (
  org_id,
  bank_gl_account_id,
  transaction_id,
  status
)
SELECT DISTINCT
  t.org_id,
  tl.gl_account_id,
  tl.transaction_id,
  'uncleared'::bank_entry_status_enum
FROM public.transaction_lines tl
JOIN public.transactions t ON t.id = tl.transaction_id
JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
WHERE ga.is_bank_account = true
ON CONFLICT (org_id, bank_gl_account_id, transaction_id) DO NOTHING;

-- Optionally seed bank_gl_account_id from transaction.bank_gl_account_id when no bank lines exist
INSERT INTO public.bank_register_state (
  org_id,
  bank_gl_account_id,
  transaction_id,
  status
)
SELECT DISTINCT
  t.org_id,
  t.bank_gl_account_id,
  t.id,
  'uncleared'::bank_entry_status_enum
FROM public.transactions t
JOIN public.gl_accounts ga ON ga.id = t.bank_gl_account_id
WHERE t.bank_gl_account_id IS NOT NULL
  AND ga.is_bank_account = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.bank_register_state brs
    WHERE brs.transaction_id = t.id
      AND brs.bank_gl_account_id = t.bank_gl_account_id
  )
ON CONFLICT (org_id, bank_gl_account_id, transaction_id) DO NOTHING;

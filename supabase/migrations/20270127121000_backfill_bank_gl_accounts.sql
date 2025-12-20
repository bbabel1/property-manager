-- Phase 2: Backfill new *_bank_gl_account_id columns and copy bank account fields onto gl_accounts.
-- This migration is designed to be safe and re-runnable.

BEGIN;

-- 1) Backfill properties.*_bank_gl_account_id from bank_accounts.gl_account
UPDATE public.properties p
SET operating_bank_gl_account_id = ba.gl_account
FROM public.bank_accounts ba
WHERE p.operating_bank_gl_account_id IS NULL
  AND p.operating_bank_account_id IS NOT NULL
  AND ba.id = p.operating_bank_account_id
  AND ba.gl_account IS NOT NULL;

UPDATE public.properties p
SET deposit_trust_gl_account_id = ba.gl_account
FROM public.bank_accounts ba
WHERE p.deposit_trust_gl_account_id IS NULL
  AND p.deposit_trust_account_id IS NOT NULL
  AND ba.id = p.deposit_trust_account_id
  AND ba.gl_account IS NOT NULL;

-- 2) Backfill transactions.bank_gl_account_id from bank_accounts.gl_account
UPDATE public.transactions t
SET bank_gl_account_id = ba.gl_account
FROM public.bank_accounts ba
WHERE t.bank_gl_account_id IS NULL
  AND t.bank_account_id IS NOT NULL
  AND ba.id = t.bank_account_id
  AND ba.gl_account IS NOT NULL;

-- 3) Backfill reconciliation_log.bank_gl_account_id from bank_accounts.gl_account
UPDATE public.reconciliation_log rl
SET bank_gl_account_id = ba.gl_account
FROM public.bank_accounts ba
WHERE rl.bank_gl_account_id IS NULL
  AND rl.bank_account_id IS NOT NULL
  AND ba.id = rl.bank_account_id
  AND ba.gl_account IS NOT NULL;

-- 4) Copy bank account detail fields from bank_accounts -> gl_accounts for bank GL accounts.
-- If multiple bank_accounts share a gl_account, we pick the most recently updated.
WITH ranked AS (
  SELECT DISTINCT ON (ba.gl_account)
    ba.gl_account,
    ba.buildium_bank_id,
    ba.bank_account_type,
    ba.account_number,
    ba.routing_number,
    ba.country,
    ba.check_printing_info,
    ba.electronic_payments,
    ba.balance,
    ba.buildium_balance,
    ba.last_source,
    ba.last_source_ts
  FROM public.bank_accounts ba
  WHERE ba.gl_account IS NOT NULL
  ORDER BY ba.gl_account, ba.updated_at DESC, ba.created_at DESC
)
UPDATE public.gl_accounts ga
SET
  is_bank_account = TRUE,
  buildium_bank_account_id = ranked.buildium_bank_id,
  bank_account_type = ranked.bank_account_type,
  bank_account_number = ranked.account_number,
  bank_routing_number = ranked.routing_number,
  bank_country = ranked.country,
  bank_check_printing_info = ranked.check_printing_info,
  bank_electronic_payments = ranked.electronic_payments,
  bank_balance = COALESCE(ranked.balance, ga.bank_balance),
  bank_buildium_balance = COALESCE(ranked.buildium_balance, ga.bank_buildium_balance),
  bank_last_source = ranked.last_source,
  bank_last_source_ts = ranked.last_source_ts
FROM ranked
WHERE ga.id = ranked.gl_account;

COMMIT;


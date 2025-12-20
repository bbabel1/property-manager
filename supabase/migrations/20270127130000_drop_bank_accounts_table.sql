-- Phase 5: Drop legacy public.bank_accounts and all remaining references.
-- Bank accounts are now modeled as public.gl_accounts rows where is_bank_account = true.

-- 1) Drop legacy FKs / columns that referenced public.bank_accounts

-- properties: operating_bank_account_id / deposit_trust_account_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_operating_bank_account_id_fkey') THEN
    ALTER TABLE public.properties DROP CONSTRAINT properties_operating_bank_account_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_deposit_trust_account_id_fkey') THEN
    ALTER TABLE public.properties DROP CONSTRAINT properties_deposit_trust_account_id_fkey;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

ALTER TABLE public.properties
  DROP COLUMN IF EXISTS operating_bank_account_id,
  DROP COLUMN IF EXISTS deposit_trust_account_id;

-- transactions: bank_account_id
-- Drop dependent view first
DROP VIEW IF EXISTS public.v_recent_transactions_ranked;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_bank_account_id_fkey') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_bank_account_id_fkey;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS bank_account_id;

-- Recreate the view (it will use t.* which no longer includes bank_account_id)
CREATE OR REPLACE VIEW public.v_recent_transactions_ranked AS
SELECT t.*, 
       ROW_NUMBER() OVER (PARTITION BY t.org_id ORDER BY t.date DESC, t.created_at DESC) AS rn
FROM public.transactions t;

-- reconciliation_log: bank_account_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reconciliation_log_bank_account_id_fkey') THEN
    ALTER TABLE public.reconciliation_log DROP CONSTRAINT reconciliation_log_bank_account_id_fkey;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

ALTER TABLE public.reconciliation_log
  DROP COLUMN IF EXISTS bank_account_id;

-- 2) Drop the legacy table itself (policies/indexes cascade with table)
DROP TABLE IF EXISTS public.bank_accounts CASCADE;


-- Phase 2: Introduce new foreign keys that reference gl_accounts for bank account selection.
-- We keep existing bank_accounts references for backwards compatibility during rollout.

BEGIN;

-- properties: operating + trust bank GL account ids
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS operating_bank_gl_account_id uuid,
  ADD COLUMN IF NOT EXISTS deposit_trust_gl_account_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_operating_bank_gl_account_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_operating_bank_gl_account_id_fkey
      FOREIGN KEY (operating_bank_gl_account_id)
      REFERENCES public.gl_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_deposit_trust_gl_account_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_deposit_trust_gl_account_id_fkey
      FOREIGN KEY (deposit_trust_gl_account_id)
      REFERENCES public.gl_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_operating_bank_gl_account_id
  ON public.properties (operating_bank_gl_account_id);

CREATE INDEX IF NOT EXISTS idx_properties_deposit_trust_gl_account_id
  ON public.properties (deposit_trust_gl_account_id);

-- transactions: bank GL account id (parallel to bank_account_id)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_gl_account_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_bank_gl_account_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_bank_gl_account_id_fkey
      FOREIGN KEY (bank_gl_account_id)
      REFERENCES public.gl_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_gl_account_id
  ON public.transactions (bank_gl_account_id);

-- reconciliation_log: bank GL account id (parallel to bank_account_id)
ALTER TABLE public.reconciliation_log
  ADD COLUMN IF NOT EXISTS bank_gl_account_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reconciliation_log_bank_gl_account_id_fkey'
  ) THEN
    ALTER TABLE public.reconciliation_log
      ADD CONSTRAINT reconciliation_log_bank_gl_account_id_fkey
      FOREIGN KEY (bank_gl_account_id)
      REFERENCES public.gl_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_bank_gl_account_id
  ON public.reconciliation_log (bank_gl_account_id);

COMMIT;


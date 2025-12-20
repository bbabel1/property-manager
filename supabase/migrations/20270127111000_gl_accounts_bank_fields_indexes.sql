-- Indexes and constraints to support bank accounts modeled as gl_accounts (is_bank_account = true).
-- This is Phase 1 of migrating off the public.bank_accounts table.

-- Fast dropdown/querying for org bank accounts
CREATE INDEX IF NOT EXISTS idx_gl_accounts_org_bank_accounts
  ON public.gl_accounts (org_id, name)
  WHERE is_bank_account IS TRUE;

-- Ensure we don't accidentally map the same Buildium bank account to multiple rows within an org.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gl_accounts_org_buildium_bank_account_id
  ON public.gl_accounts (org_id, buildium_bank_account_id)
  WHERE org_id IS NOT NULL
    AND buildium_bank_account_id IS NOT NULL
    AND buildium_bank_account_id > 0;

-- Optional lookup index for sync/webhook resolution
CREATE INDEX IF NOT EXISTS idx_gl_accounts_buildium_bank_account_id
  ON public.gl_accounts (buildium_bank_account_id)
  WHERE buildium_bank_account_id IS NOT NULL;

-- Guardrail: if a row has a Buildium bank account id, it must be flagged as a bank account.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_gl_accounts_buildium_bank_account_requires_bank_flag'
  ) THEN
    ALTER TABLE public.gl_accounts
      ADD CONSTRAINT chk_gl_accounts_buildium_bank_account_requires_bank_flag
      CHECK (buildium_bank_account_id IS NULL OR is_bank_account IS TRUE)
      NOT VALID;
  END IF;
END $$;


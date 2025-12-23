-- Remove deprecated Buildium bank account id column; bank account mappings now use buildium_gl_account_id.
DROP INDEX IF EXISTS uq_gl_accounts_org_buildium_bank_account_id;
DROP INDEX IF EXISTS idx_gl_accounts_buildium_bank_account_id;
ALTER TABLE public.gl_accounts
  DROP CONSTRAINT IF EXISTS chk_gl_accounts_buildium_bank_account_requires_bank_flag;
ALTER TABLE public.gl_accounts
  DROP COLUMN IF EXISTS buildium_bank_account_id;

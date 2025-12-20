-- Add bank-account specific fields to gl_accounts.
-- This is Phase 1 of migrating off the public.bank_accounts table.

ALTER TABLE public.gl_accounts
  ADD COLUMN IF NOT EXISTS buildium_bank_account_id integer,
  ADD COLUMN IF NOT EXISTS bank_account_type public.bank_account_type_enum,
  ADD COLUMN IF NOT EXISTS bank_account_number character varying(255),
  ADD COLUMN IF NOT EXISTS bank_routing_number character varying(255),
  ADD COLUMN IF NOT EXISTS bank_country public.countries,
  ADD COLUMN IF NOT EXISTS bank_check_printing_info jsonb,
  ADD COLUMN IF NOT EXISTS bank_electronic_payments jsonb,
  ADD COLUMN IF NOT EXISTS bank_balance numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS bank_buildium_balance numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS bank_last_source public.sync_source_enum,
  ADD COLUMN IF NOT EXISTS bank_last_source_ts timestamp with time zone;

COMMENT ON COLUMN public.gl_accounts.buildium_bank_account_id IS 'Buildium API bank account ID for synchronization (migrated from bank_accounts.buildium_bank_id).';
COMMENT ON COLUMN public.gl_accounts.bank_account_type IS 'Bank account type (checking/savings/money market/certificate of deposit).';
COMMENT ON COLUMN public.gl_accounts.bank_account_number IS 'Bank account number (sensitive).';
COMMENT ON COLUMN public.gl_accounts.bank_routing_number IS 'Bank routing number (sensitive).';
COMMENT ON COLUMN public.gl_accounts.bank_country IS 'Bank account country (Buildium payload Country).';
COMMENT ON COLUMN public.gl_accounts.bank_check_printing_info IS 'Buildium bank account CheckPrintingInfo payload (json).';
COMMENT ON COLUMN public.gl_accounts.bank_electronic_payments IS 'Buildium bank account ElectronicPayments payload (json).';
COMMENT ON COLUMN public.gl_accounts.bank_balance IS 'Current balance of the bank account in local system (migrated from bank_accounts.balance).';
COMMENT ON COLUMN public.gl_accounts.bank_buildium_balance IS 'Current balance of the bank account from Buildium API (migrated from bank_accounts.buildium_balance).';
COMMENT ON COLUMN public.gl_accounts.bank_last_source IS 'Origin of last update for bank fields (local/buildium).';
COMMENT ON COLUMN public.gl_accounts.bank_last_source_ts IS 'Timestamp of last source update for bank fields.';

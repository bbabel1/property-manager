-- Migration: Extend bank_accounts for Buildium parity and sync metadata
-- - Add JSONB columns for CheckPrintingInfo and ElectronicPayments
-- - Add Country (enum public.countries)
-- - Introduce enum public.bank_account_type_enum and convert bank_accounts.bank_account_type
-- - Introduce enum public.sync_source_enum and add last_source + last_source_ts

DO $$ BEGIN
  -- Create enum for normalized bank account types (snake_case)
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'bank_account_type_enum'
  ) THEN
    CREATE TYPE public.bank_account_type_enum AS ENUM (
      'checking',
      'savings',
      'money_market',
      'certificate_of_deposit'
    );
  END IF;
END $$;

DO $$ BEGIN
  -- Create enum for sync source
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'sync_source_enum'
  ) THEN
    CREATE TYPE public.sync_source_enum AS ENUM ('local', 'buildium');
  END IF;
END $$;

-- Add new columns if not present
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS country public.countries NULL,
  ADD COLUMN IF NOT EXISTS check_printing_info JSONB NULL,
  ADD COLUMN IF NOT EXISTS electronic_payments JSONB NULL,
  ADD COLUMN IF NOT EXISTS last_source public.sync_source_enum NULL,
  ADD COLUMN IF NOT EXISTS last_source_ts TIMESTAMPTZ NULL;

-- Convert bank_account_type to enum (non-destructive via temp column)
DO $$
DECLARE
  has_col BOOLEAN := EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'bank_account_type'
  );
BEGIN
  IF has_col THEN
    -- Add temp enum column
    ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS bank_account_type_new public.bank_account_type_enum;

    -- Map existing values into enum
    UPDATE public.bank_accounts
    SET bank_account_type_new = CASE lower(coalesce(bank_account_type::text, 'checking'))
      WHEN 'checking' THEN 'checking'::public.bank_account_type_enum
      WHEN 'savings' THEN 'savings'::public.bank_account_type_enum
      WHEN 'money_market' THEN 'money_market'::public.bank_account_type_enum
      WHEN 'moneymarket' THEN 'money_market'::public.bank_account_type_enum
      WHEN 'certificate_of_deposit' THEN 'certificate_of_deposit'::public.bank_account_type_enum
      WHEN 'certificateofdeposit' THEN 'certificate_of_deposit'::public.bank_account_type_enum
      ELSE 'checking'::public.bank_account_type_enum
    END
    WHERE bank_account_type_new IS NULL;

    -- Swap columns
    ALTER TABLE public.bank_accounts DROP COLUMN IF EXISTS bank_account_type;
    ALTER TABLE public.bank_accounts RENAME COLUMN bank_account_type_new TO bank_account_type;
  END IF;
END $$;

-- Indexes to help queries
CREATE INDEX IF NOT EXISTS idx_bank_accounts_last_source ON public.bank_accounts (last_source);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_last_source_ts ON public.bank_accounts (last_source_ts DESC);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_bank_account_type ON public.bank_accounts (bank_account_type);

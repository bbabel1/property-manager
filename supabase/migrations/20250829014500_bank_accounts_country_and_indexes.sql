-- Add country column to bank_accounts and supporting indexes
-- Country will reuse the existing public.countries enum used across the app

DO $$ BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.bank_accounts
      ADD COLUMN country public.countries NOT NULL DEFAULT 'United States';
  END IF;
END $$;

-- Helpful indexes for lookups and filtering
CREATE INDEX IF NOT EXISTS idx_bank_accounts_buildium_bank_id ON public.bank_accounts(buildium_bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_name ON public.bank_accounts(name);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_bank_account_type ON public.bank_accounts(bank_account_type);


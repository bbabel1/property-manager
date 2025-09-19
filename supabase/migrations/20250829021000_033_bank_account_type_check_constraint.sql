-- Enforce normalized snake_case bank_account_type values at the DB level
-- Allowed: checking, savings, money_market, certificate_of_deposit

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bank_accounts_type_allowed'
      AND conrelid = 'public.bank_accounts'::regclass
  ) THEN
    ALTER TABLE public.bank_accounts
      ADD CONSTRAINT chk_bank_accounts_type_allowed
      CHECK (bank_account_type IN ('checking','savings','money_market','certificate_of_deposit'));
  END IF;
END $$;


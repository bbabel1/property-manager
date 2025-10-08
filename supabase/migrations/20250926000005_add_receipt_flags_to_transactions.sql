-- Add receipt preference flags to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS email_receipt boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS print_receipt boolean DEFAULT false NOT NULL;

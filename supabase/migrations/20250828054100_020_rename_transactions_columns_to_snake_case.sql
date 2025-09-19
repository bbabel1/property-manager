-- Rename PascalCase columns in public.transactions to snake_case
-- Safe to run multiple times due to IF EXISTS checks

DO $$
BEGIN
  -- Date -> date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'Date'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "Date" TO date';
  END IF;

  -- TransactionType -> transaction_type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'TransactionType'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "TransactionType" TO transaction_type';
  END IF;

  -- TotalAmount -> total_amount
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'TotalAmount'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "TotalAmount" TO total_amount';
  END IF;

  -- CheckNumber -> check_number
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'CheckNumber'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "CheckNumber" TO check_number';
  END IF;

  -- PayeeTenantId -> payee_tenant_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'PayeeTenantId'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "PayeeTenantId" TO payee_tenant_id';
  END IF;

  -- PaymentMethod -> payment_method
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'PaymentMethod'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "PaymentMethod" TO payment_method';
  END IF;

  -- Memo -> memo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'Memo'
  ) THEN
    EXECUTE 'ALTER TABLE public.transactions RENAME COLUMN "Memo" TO memo';
  END IF;
END $$;


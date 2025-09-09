-- Migration: Create payment_method_enum and alter transactions.payment_method to use it
-- Description: Normalizes payment methods and converts column from text to enum, mapping known values and setting unknowns to NULL

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum'
  ) THEN
    CREATE TYPE public.payment_method_enum AS ENUM (
      'Check',
      'Cash',
      'MoneyOrder',
      'CashierCheck',
      'DirectDeposit',
      'CreditCard',
      'ElectronicPayment'
    );
    COMMENT ON TYPE public.payment_method_enum IS 'Normalized payment methods for transactions';
  END IF;
END $$;

-- Ensure the column exists and is varchar before casting
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'payment_method'
  ) THEN
    -- Remove any default prior to type change
    ALTER TABLE public.transactions ALTER COLUMN payment_method DROP DEFAULT;

    -- Cast with mapping; unknown values become NULL
    ALTER TABLE public.transactions
      ALTER COLUMN payment_method TYPE public.payment_method_enum
      USING (
        CASE
          WHEN payment_method ILIKE 'check' THEN 'Check'::public.payment_method_enum
          WHEN payment_method ILIKE 'cash' THEN 'Cash'::public.payment_method_enum
          WHEN payment_method ILIKE 'money order' OR payment_method ILIKE 'money_order' THEN 'MoneyOrder'::public.payment_method_enum
          WHEN payment_method ILIKE 'cashier check' OR payment_method ILIKE 'cashier_check' OR payment_method ILIKE 'cashiers check' THEN 'CashierCheck'::public.payment_method_enum
          WHEN payment_method ILIKE 'direct deposit' OR payment_method ILIKE 'banktransfer' OR payment_method ILIKE 'bank transfer' OR payment_method ILIKE 'ach' THEN 'DirectDeposit'::public.payment_method_enum
          WHEN payment_method ILIKE 'credit card' OR payment_method ILIKE 'creditcard' THEN 'CreditCard'::public.payment_method_enum
          WHEN payment_method ILIKE 'electronic payment' OR payment_method ILIKE 'online payment' OR payment_method ILIKE 'onlinepayment' OR payment_method ILIKE 'epayment' THEN 'ElectronicPayment'::public.payment_method_enum
          ELSE NULL
        END
      );
  END IF;
END $$;


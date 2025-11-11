-- Add default payment terms metadata to vendors for bill creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'payment_terms_days'
  ) THEN
    ALTER TABLE public.vendors
      ADD COLUMN payment_terms_days smallint;

    COMMENT ON COLUMN public.vendors.payment_terms_days IS
      'Default payment term length in days for vendor bills (null = due on receipt)';
  END IF;
END;
$$;


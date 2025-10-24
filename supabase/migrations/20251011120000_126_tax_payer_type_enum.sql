-- Migration: Add tax_payer_type enum and apply it to owners and vendors
-- Description: Introduce tax_payer_type enum (SSN, EIN) and align related columns

DO $$
BEGIN
  CREATE TYPE public.tax_payer_type AS ENUM ('SSN', 'EIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE public.tax_payer_type IS 'Supported tax payer identification types';

ALTER TABLE public.vendors
  ALTER COLUMN tax_payer_type TYPE public.tax_payer_type
  USING CASE
    WHEN tax_payer_type IS NULL THEN NULL
    WHEN upper(tax_payer_type::text) IN ('SSN', 'EIN')
      THEN upper(tax_payer_type::text)::public.tax_payer_type
    ELSE NULL
  END;

ALTER TABLE public.owners
  ALTER COLUMN tax_payer_type TYPE public.tax_payer_type
  USING CASE
    WHEN tax_payer_type IS NULL THEN NULL
    WHEN upper(tax_payer_type::text) IN ('SSN', 'EIN')
      THEN upper(tax_payer_type::text)::public.tax_payer_type
    ELSE NULL
  END;

COMMENT ON COLUMN public.vendors.tax_payer_type IS 'Tax payer type (SSN or EIN)';
COMMENT ON COLUMN public.owners.tax_payer_type IS 'Tax payer type (SSN or EIN)';

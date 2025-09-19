-- Migration: Update vendors schema (add website, insurance/tax fields, comments, account_number, 1099 flag, and gl_account FK; remove legacy contact/address fields)
-- Description:
-- 1) ADD column: website
-- 2) REMOVE columns: name, contact_name, email, phone_number, address_line1, address_line2, city, state, postal_code, country
-- 3) ADD columns: insurance_provider, insurance_policy_number, insurance_expiration_date,
--                 tax_address_line1, tax_address_line2, tax_address_line3,
--                 tax_address_city, tax_address_state, tax_address_postal_code, tax_address_country,
--                 comments, account_number, tax_payer_type, tax_payer_name1, tax_payer_name2,
--                 include_1099 (boolean), gl_account (FK to gl_accounts)

-- Note: 'insurance_policy_number' was listed twice in the request; only a single column is added.

-- 0) Safety: drop any constraints dependent on columns being removed (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
      AND table_name = 'vendors' 
      AND constraint_name = 'vendors_country_is_valid'
  ) THEN
    EXECUTE 'ALTER TABLE public.vendors DROP CONSTRAINT vendors_country_is_valid';
  END IF;
END $$;

-- 0a) Drop dependent view that references vendors.country
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'invalid_country_values'
  ) THEN
    EXECUTE 'DROP VIEW public.invalid_country_values';
  END IF;
END $$;

-- 1) Add new columns
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS website character varying(255),
  ADD COLUMN IF NOT EXISTS insurance_provider character varying(255),
  ADD COLUMN IF NOT EXISTS insurance_policy_number character varying(255),
  ADD COLUMN IF NOT EXISTS insurance_expiration_date date,
  ADD COLUMN IF NOT EXISTS tax_address_line1 character varying(255),
  ADD COLUMN IF NOT EXISTS tax_address_line2 character varying(255),
  ADD COLUMN IF NOT EXISTS tax_address_line3 character varying(255),
  ADD COLUMN IF NOT EXISTS tax_address_city character varying(100),
  ADD COLUMN IF NOT EXISTS tax_address_state character varying(100),
  ADD COLUMN IF NOT EXISTS tax_address_postal_code character varying(20),
  ADD COLUMN IF NOT EXISTS tax_address_country character varying(100),
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS account_number character varying(255),
  ADD COLUMN IF NOT EXISTS tax_payer_type character varying(50),
  ADD COLUMN IF NOT EXISTS tax_payer_name1 character varying(255),
  ADD COLUMN IF NOT EXISTS tax_payer_name2 character varying(255),
  ADD COLUMN IF NOT EXISTS include_1099 boolean,
  ADD COLUMN IF NOT EXISTS gl_account uuid REFERENCES public.gl_accounts(id);

-- 1a) Helpful index and comments for new columns
CREATE INDEX IF NOT EXISTS idx_vendors_gl_account ON public.vendors(gl_account);

COMMENT ON COLUMN public.vendors.website IS 'Vendor website URL';
COMMENT ON COLUMN public.vendors.insurance_provider IS 'Insurance provider for the vendor';
COMMENT ON COLUMN public.vendors.insurance_policy_number IS 'Insurance policy number for the vendor';
COMMENT ON COLUMN public.vendors.insurance_expiration_date IS 'Date when insurance coverage expires';
COMMENT ON COLUMN public.vendors.tax_address_line1 IS 'Tax address line 1';
COMMENT ON COLUMN public.vendors.tax_address_line2 IS 'Tax address line 2';
COMMENT ON COLUMN public.vendors.tax_address_line3 IS 'Tax address line 3';
COMMENT ON COLUMN public.vendors.tax_address_city IS 'Tax address city';
COMMENT ON COLUMN public.vendors.tax_address_state IS 'Tax address state or region';
COMMENT ON COLUMN public.vendors.tax_address_postal_code IS 'Tax address postal/ZIP code';
COMMENT ON COLUMN public.vendors.tax_address_country IS 'Tax address country (free text; consider enum constraint later)';
COMMENT ON COLUMN public.vendors.comments IS 'Internal comments about the vendor';
COMMENT ON COLUMN public.vendors.account_number IS 'Account or reference number with the vendor';
COMMENT ON COLUMN public.vendors.tax_payer_type IS 'Tax payer type (e.g., SSN, EIN, etc.)';
COMMENT ON COLUMN public.vendors.tax_payer_name1 IS 'Primary tax payer name';
COMMENT ON COLUMN public.vendors.tax_payer_name2 IS 'Secondary tax payer name';
COMMENT ON COLUMN public.vendors.include_1099 IS 'Whether the vendor should be included in 1099 reporting';
COMMENT ON COLUMN public.vendors.gl_account IS 'Reference to the associated general ledger account';

-- 1b) Optional: add staged country validation for tax_address_country (non-blocking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'is_valid_country'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.vendors ADD CONSTRAINT vendors_tax_address_country_is_valid CHECK (public.is_valid_country(tax_address_country::text)) NOT VALID';
    EXCEPTION WHEN duplicate_object THEN
      -- Constraint already exists; do nothing
      NULL;
    END;
  END IF;
END $$;

-- 2) Remove legacy fields (if they exist)
ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS country;

-- 3) Housekeeping: update table comment to reflect new structure
COMMENT ON TABLE public.vendors IS 'Vendors/suppliers with accounting linkage and tax/insurance metadata';

-- 4) Recreate reporting view without vendors.country (use vendors.tax_address_country instead)
CREATE OR REPLACE VIEW public.invalid_country_values AS
  SELECT 'contacts'::text AS table_name, id::text AS id, 'primary_country'::text AS column_name, primary_country::text AS value
  FROM public.contacts WHERE NOT public.is_valid_country(primary_country::text)
  UNION ALL
  SELECT 'contacts', id::text, 'alt_country', alt_country::text
  FROM public.contacts WHERE NOT public.is_valid_country(alt_country::text)
  UNION ALL
  SELECT 'owners', id::text, 'tax_country', tax_country::text
  FROM public.owners WHERE NOT public.is_valid_country(tax_country::text)
  UNION ALL
  SELECT 'properties', id::text, 'country', country::text
  FROM public.properties WHERE NOT public.is_valid_country(country::text)
  UNION ALL
  SELECT 'units', id::text, 'country', country::text
  FROM public.units WHERE NOT public.is_valid_country(country::text)
  UNION ALL
  SELECT 'vendors', id::text, 'tax_address_country', tax_address_country::text
  FROM public.vendors WHERE NOT public.is_valid_country(tax_address_country::text);

COMMENT ON VIEW public.invalid_country_values IS 'Lists rows/columns where country values are not valid enum labels; uses vendors.tax_address_country after vendor country removal.';

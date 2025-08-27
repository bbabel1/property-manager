-- Migration: Sync local owners schema with remote database
-- Remove all fields except the 10 that exist in remote database
-- Remote schema: id, contact_id, management_agreement_start_date, management_agreement_end_date, comment, etf_account_type, etf_account_number, etf_routing_number, created_at, updated_at

-- Remove contact fields (moved to contacts table)
ALTER TABLE public.owners DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.owners DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.owners DROP COLUMN IF EXISTS is_company;
ALTER TABLE public.owners DROP COLUMN IF EXISTS company_name;
ALTER TABLE public.owners DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.owners DROP COLUMN IF EXISTS email;
ALTER TABLE public.owners DROP COLUMN IF EXISTS alternate_email;

-- Remove phone fields
ALTER TABLE public.owners DROP COLUMN IF EXISTS phone_home;
ALTER TABLE public.owners DROP COLUMN IF EXISTS phone_work;
ALTER TABLE public.owners DROP COLUMN IF EXISTS phone_mobile;
ALTER TABLE public.owners DROP COLUMN IF EXISTS phone_fax;

-- Remove address fields
ALTER TABLE public.owners DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.owners DROP COLUMN IF EXISTS address_line2;
ALTER TABLE public.owners DROP COLUMN IF EXISTS address_line3;
ALTER TABLE public.owners DROP COLUMN IF EXISTS city;
ALTER TABLE public.owners DROP COLUMN IF EXISTS state;
ALTER TABLE public.owners DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.owners DROP COLUMN IF EXISTS country;

-- Remove tax fields
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_payer_id;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_payer_type;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_payer_name1;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_payer_name2;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_address_line1;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_address_line2;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_address_line3;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_city;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_state;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_postal_code;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_country;

-- Add contact_id column if missing (required field)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='owners' AND column_name='contact_id'
  ) THEN
    ALTER TABLE public.owners ADD COLUMN contact_id bigint NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Add ETF fields if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name='etf_account_type') THEN
    ALTER TABLE public.owners ADD COLUMN etf_account_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name='etf_account_number') THEN
    ALTER TABLE public.owners ADD COLUMN etf_account_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name='etf_routing_number') THEN
    ALTER TABLE public.owners ADD COLUMN etf_routing_number text;
  END IF;
END$$;

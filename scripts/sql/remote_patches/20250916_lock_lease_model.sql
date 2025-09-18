-- Lock data model for leases and related tables
-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.lease_contact_role_enum AS ENUM ('Tenant','Cosigner','Guarantor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lease_contact_status_enum AS ENUM ('Future','Active','Past');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rent_cycle_enum AS ENUM ('Monthly','Weekly','Biweekly','Quarterly','Annually');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.txn_type_enum AS ENUM ('Charge','Payment','Adjustment','Refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dr_cr_enum AS ENUM ('DR','CR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) leases table columns
ALTER TABLE public.lease
  ADD COLUMN IF NOT EXISTS prorated_first_month_rent numeric,
  ADD COLUMN IF NOT EXISTS prorated_last_month_rent numeric;

-- 3) lease_contacts enums
-- Drop defaults to allow cast
ALTER TABLE public.lease_contacts
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.lease_contacts
  ALTER COLUMN role TYPE public.lease_contact_role_enum USING (
    CASE
      WHEN role ILIKE 'tenant' THEN 'Tenant'::public.lease_contact_role_enum
      WHEN role ILIKE 'cosigner' THEN 'Cosigner'::public.lease_contact_role_enum
      WHEN role ILIKE 'guarantor' THEN 'Guarantor'::public.lease_contact_role_enum
      ELSE 'Tenant'::public.lease_contact_role_enum
    END
  ),
  ALTER COLUMN status TYPE public.lease_contact_status_enum USING (
    CASE
      WHEN status ILIKE 'future' THEN 'Future'::public.lease_contact_status_enum
      WHEN status ILIKE 'active' THEN 'Active'::public.lease_contact_status_enum
      WHEN status ILIKE 'past' THEN 'Past'::public.lease_contact_status_enum
      ELSE 'Active'::public.lease_contact_status_enum
    END
  );

-- Reapply sane defaults
ALTER TABLE public.lease_contacts
  ALTER COLUMN role SET DEFAULT 'Tenant',
  ALTER COLUMN status SET DEFAULT 'Active';

-- 4) rent_schedules (create if missing)
DO $$ BEGIN
  CREATE TABLE public.rent_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id integer NOT NULL REFERENCES public.lease(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date,
    total_amount numeric,
    rent_cycle public.rent_cycle_enum NOT NULL DEFAULT 'Monthly',
    backdate_charges boolean DEFAULT false,
    buildium_rent_id integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 5) recurring_transactions (create if missing)
DO $$ BEGIN
  CREATE TABLE public.recurring_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id integer REFERENCES public.lease(id) ON DELETE CASCADE,
    frequency public.rent_cycle_enum NOT NULL DEFAULT 'Monthly',
    amount numeric NOT NULL,
    memo text,
    start_date date,
    end_date date,
    buildium_recurring_id integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 6) lease_documents table (metadata only)
DO $$ BEGIN
  CREATE TABLE public.lease_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id integer NOT NULL REFERENCES public.lease(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text,
    storage_path text NOT NULL,
    mime_type text,
    size_bytes integer,
    is_private boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 7) Storage bucket for lease documents (private)
-- Requires Supabase storage; ignore failures if bucket exists
DO $$ BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'lease-documents';
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('lease-documents','lease-documents', false);
  END IF;
END $$;

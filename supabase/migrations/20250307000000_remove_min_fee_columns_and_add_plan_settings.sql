-- Remove legacy min/max fee columns and add plan management settings
-- Drops min_amount, max_amount, and min_monthly_fee across service pricing tables
-- Introduces org-scoped plan management settings for management fee configuration

BEGIN;

-- Drop min/max columns from service_plan_default_pricing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_plan_default_pricing' AND column_name = 'min_amount'
  ) THEN
    ALTER TABLE public.service_plan_default_pricing DROP COLUMN min_amount;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_plan_default_pricing' AND column_name = 'max_amount'
  ) THEN
    ALTER TABLE public.service_plan_default_pricing DROP COLUMN max_amount;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_plan_default_pricing' AND column_name = 'min_monthly_fee'
  ) THEN
    ALTER TABLE public.service_plan_default_pricing DROP COLUMN min_monthly_fee;
  END IF;
END $$;

-- Drop min/max/min_monthly_fee from property_service_pricing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_service_pricing' AND column_name = 'min_amount'
  ) THEN
    ALTER TABLE public.property_service_pricing DROP COLUMN min_amount;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_service_pricing' AND column_name = 'max_amount'
  ) THEN
    ALTER TABLE public.property_service_pricing DROP COLUMN max_amount;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_service_pricing' AND column_name = 'min_monthly_fee'
  ) THEN
    ALTER TABLE public.property_service_pricing DROP COLUMN min_monthly_fee;
  END IF;
END $$;

-- Drop min/max from service_offerings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_offerings' AND column_name = 'min_amount'
  ) THEN
    ALTER TABLE public.service_offerings DROP COLUMN min_amount;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_offerings' AND column_name = 'max_amount'
  ) THEN
    ALTER TABLE public.service_offerings DROP COLUMN max_amount;
  END IF;
END $$;

-- Create management_fee_type_enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'management_fee_type_enum'
  ) THEN
    CREATE TYPE public.management_fee_type_enum AS ENUM ('percentage', 'flat');
    COMMENT ON TYPE public.management_fee_type_enum IS 'Management fee billing type: percentage of rent or flat fee.';
  END IF;
END $$;

-- Org-scoped plan management settings
CREATE TABLE IF NOT EXISTS public.org_service_plan_settings (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_plan public.service_plan_enum NOT NULL,
  fee_type public.management_fee_type_enum NOT NULL,
  percentage_rate numeric(6,3),
  flat_rate numeric(12,2),
  gl_account_id uuid REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, service_plan),
  CONSTRAINT org_service_plan_settings_fee_check CHECK (
    (fee_type = 'percentage' AND percentage_rate IS NOT NULL AND flat_rate IS NULL)
    OR (fee_type = 'flat' AND flat_rate IS NOT NULL AND percentage_rate IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_org_service_plan_settings_gl
  ON public.org_service_plan_settings(gl_account_id)
  WHERE gl_account_id IS NOT NULL;

COMMENT ON TABLE public.org_service_plan_settings IS 'Org-scoped plan management fee configuration (percentage or flat, GL account).';
COMMENT ON COLUMN public.org_service_plan_settings.gl_account_id IS 'Expense GL account used when posting management fee transactions.';

COMMIT;
